"""What the module learns from the house: day tallies, the morning check of the curve, the marks.

It rides along with the control loop and never decides anything in it: a failure here is logged and the
tick goes on.
"""

import logging
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.start import async_at_started
from homeassistant.util import dt as dt_util

from .codec import from_data, to_data
from .const import SAVE_DELAY_S
from .core.controller import ControllerState
from .core.learning import (
    LEARNING,
    LearningData,
    Suggestion,
    TickSample,
    curve_suggestion,
    morning_sample,
    prune,
    tick_sample,
    upsert_pending,
)
from .core.model import (
    HEAT_LOSS_MIN_DAYS,
    HEAT_LOSS_WINDOW_DAYS,
    HeatLossEstimate,
    day_stats,
    estimate_heat_loss,
    update_tally,
)
from .core.timeutil import before
from .core.types import Decision, Reason, Settings, Snapshot

if TYPE_CHECKING:
    from .coordinator import HybridHeatingCoordinator

LOGGER = logging.getLogger(__package__)
HEAT_LOSS_EVERY = timedelta(days=7)  # on Mondays at 04:30, or at a start when the last one is older
UNITS = {"power": "W", "temperature": "°C"}


def heat_loss_reason(e: HeatLossEstimate) -> Reason:
    data: dict[str, float | str | bool] = {"days_used": e.days_used}
    if e.w_per_k is not None:
        data["w_per_k"] = e.w_per_k
    if e.status == "ok":
        return Reason("system", "heat_loss_estimated", data)
    if e.status == "implausible":
        return Reason("system", "heat_loss_implausible", data)
    data["min_days"] = HEAT_LOSS_MIN_DAYS
    return Reason("system", "heat_loss_insufficient", data)


class LearningManager:
    def __init__(self, coordinator: HybridHeatingCoordinator) -> None:
        self._c = coordinator
        self.data = LearningData()
        self.revision = 1  # +1 whenever what the card shows as suggestions changes
        self.morning_buffer: list[TickSample] = []
        self._last_minute: datetime | None = None

    async def async_load(self, now: datetime) -> None:
        raw = await self._c.store.async_load_learning()
        if raw is None:
            return
        try:
            self.data = from_data(LearningData, raw, strict=False)
        except ValueError, TypeError:
            self._c.log.record_system(now, [Reason("system", "store_section_reset", {"section": "learning"})])

    @callback
    def async_setup_jobs(self, entry: ConfigEntry[Any]) -> None:
        end = LEARNING.morning_end
        hass = self._c.hass
        entry.async_on_unload(
            async_track_time_change(hass, self._async_morning_end, hour=end.hour, minute=end.minute, second=0)
        )
        entry.async_on_unload(
            async_track_time_change(hass, self._async_heat_loss_time, hour=4, minute=30, second=0)
        )
        entry.async_on_unload(async_at_started(hass, self._async_heat_loss_at_start))

    def heat_loss_w_per_k(self) -> float | None:
        """The learned heat loss if the last estimate is good; else None (estimates use the default)."""
        e = self.data.heat_loss
        return e.w_per_k if e is not None and e.status == "ok" else None

    def _to_data(self) -> dict[str, Any]:
        data: dict[str, Any] = to_data(self.data)
        return data

    async def async_save(self) -> None:
        await self._c.store.async_save_learning(self._to_data())

    @callback
    def on_tick(self, settings: Settings, snap: Snapshot, d: Decision, state: ControllerState) -> None:
        try:
            self._on_tick(settings, snap, d, state)
        except Exception:
            LOGGER.exception("Learning from this tick failed; the heating goes on")

    def _on_tick(self, settings: Settings, snap: Snapshot, d: Decision, state: ControllerState) -> None:
        minute = snap.now.replace(second=0, microsecond=0)
        if minute == self._last_minute:
            return  # one count per minute, however often the loop ticks
        self._last_minute = minute
        update_tally(self.data.tallies, snap, d)
        if LEARNING.morning_start <= snap.now.time() < LEARNING.morning_end:
            if self.morning_buffer and self.morning_buffer[0].at.date() != snap.now.date():
                self.morning_buffer.clear()
            sample = tick_sample(settings, snap, d, state)
            if sample is not None:
                self.morning_buffer.append(sample)
        self._c.store.async_delay_save_learning(self._to_data, SAVE_DELAY_S)

    async def _async_morning_end(self, now: datetime) -> None:
        await self.async_morning_check(dt_util.as_local(now))

    async def async_morning_check(self, now: datetime) -> None:
        """At the end of the morning window: score the morning, then look for three in a row."""
        day = now.date()
        sample = morning_sample(day, [s for s in self.morning_buffer if s.at.date() == day])
        self.morning_buffer.clear()
        if sample is not None:
            self.data.mornings = [m for m in self.data.mornings if m.day != day] + [sample]
        settings = self._c.settings
        sg = curve_suggestion(self.data.mornings, settings, self.data.resolutions, now)
        if sg is not None:
            self.offer(sg, now)
        self.data = prune(self.data, settings, now)
        await self.async_save()
        await self._c.async_flush()

    # The heat loss, once a week

    def _heat_loss_due(self, now: datetime) -> bool:
        e = self.data.heat_loss
        return e is None or not before(now, e.computed_at + HEAT_LOSS_EVERY)

    async def _async_heat_loss_time(self, _fired: datetime) -> None:
        now = dt_util.now()  # the callback fires a fraction of a second late
        if now.weekday() == 0 or self._heat_loss_due(now):
            await self.async_heat_loss_job(now)

    async def _async_heat_loss_at_start(self, hass: HomeAssistant) -> None:
        now = dt_util.now()
        if self._heat_loss_due(now):
            await self.async_heat_loss_job(now)

    async def async_heat_loss_job(self, now: datetime) -> None:
        """Estimate the heat loss from the last four weeks of daily statistics."""
        if "recorder" not in self._c.hass.config.components:
            LOGGER.debug("No recorder: estimates keep the model's heat loss")
            return
        try:
            rows = await self._daily_means(now)
        except Exception:
            LOGGER.warning("Could not read the daily statistics for the heat loss", exc_info=True)
            return
        e = self._c.entities
        days = day_stats(
            rows,
            boiler_id=e.boiler_power,
            outdoor_id=e.outdoor,
            room_ids=list(e.rooms.values()),
            tallies=self.data.tallies,
            tz=dt_util.get_default_time_zone(),
        )
        self.data.heat_loss = estimate_heat_loss(days, now)
        self.revision += 1
        self._c.log.record_system(now, [heat_loss_reason(self.data.heat_loss)])
        await self.async_save()
        await self._c.async_flush()
        self._c.async_update_listeners()

    async def _daily_means(self, now: datetime) -> Any:
        # Imported here: the module also runs without the recorder.
        from homeassistant.components.recorder.statistics import statistics_during_period
        from homeassistant.helpers.recorder import get_instance

        hass, e = self._c.hass, self._c.entities
        end = dt_util.start_of_local_day(now)
        start = end - timedelta(days=HEAT_LOSS_WINDOW_DAYS)
        ids = {e.boiler_power, e.outdoor, *e.rooms.values()}
        return await get_instance(hass).async_add_executor_job(
            statistics_during_period, hass, start, end, ids, "day", UNITS, {"mean"}
        )

    # Suggestions

    def offer(self, sg: Suggestion, now: datetime) -> bool:
        """Add a suggestion (one per key); True if the card has something new to show."""
        before = self.data.pending
        self.data.pending = upsert_pending(before, sg)
        if self.data.pending == before:
            return False
        self.revision += 1
        data: dict[str, float | str | bool] = {"setting": sg.setting, "old": sg.old, "new": sg.new}
        self._c.log.record_system(now, [Reason("system", "suggestion_created", data)])
        return True
