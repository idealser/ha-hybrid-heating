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
from .const import DEFAULT_HEAT_LOSS_W_PER_K, SAVE_DELAY_S
from .core.controller import ControllerState
from .core.learning import (
    LEARNING,
    LearningData,
    MarkKind,
    Resolution,
    StaleSuggestion,
    Suggestion,
    TickSample,
    curve_suggestion,
    feedback_suggestion,
    is_fresh,
    lever_changes,
    make_mark,
    morning_sample,
    prune,
    suggestion_patch,
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
from .core.timeutil import before, elapsed_s
from .core.types import Decision, Reason, Room, Settings, Snapshot
from .suggestion_texts import heat_loss_view, suggestion_view

if TYPE_CHECKING:
    from .coordinator import HybridHeatingCoordinator

LOGGER = logging.getLogger(__package__)
HEAT_LOSS_EVERY = timedelta(days=7)  # on Mondays at 04:30, or at a start when the last one is older
UNITS = {"power": "W", "temperature": "°C"}
RESOLVED_SHOWN = timedelta(days=7)  # applied and dismissed suggestions stay in the list a week


class NotReady(Exception):
    """No decision yet (starting, or the module is off): a mark would have nothing to keep."""


class NoSuchSuggestion(Exception):
    """Not among the pending suggestions (decided already, withdrawn, or never there)."""


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
        self._saved_at: datetime | None = None

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
        """The last good estimate of the heat loss; None until there is one (estimates use the default)."""
        e = self.data.heat_loss_ok
        return e.w_per_k if e is not None else None

    def _to_data(self) -> dict[str, Any]:
        data: dict[str, Any] = to_data(self.data)
        return data

    async def async_save(self) -> None:
        self._saved_at = dt_util.now()
        await self._c.store.async_save_learning(self._to_data())

    def _save_soon(self) -> None:
        self._saved_at = dt_util.now()
        self._c.config_entry.async_create_task(self._c.hass, self.async_save())

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
        if self._saved_at is None or elapsed_s(snap.now, self._saved_at) >= SAVE_DELAY_S:
            self._save_soon()  # every few minutes, like the module's own state

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
        sg = curve_suggestion(
            self.data.mornings, settings, self.data.resolutions, now, changed=self.data.changed
        )
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
        estimate = estimate_heat_loss(days, now)
        self.data.heat_loss = estimate
        if estimate.status == "ok":
            self.data.heat_loss_ok = estimate
        self.revision += 1
        self._c.log.record_system(now, [heat_loss_reason(estimate)])
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

    def views(self, lang: str) -> list[dict[str, Any]]:
        """What the card lists: new suggestions, the heat loss, then what was decided this week."""
        now = dt_util.now()
        out = [suggestion_view(s, "new", lang) for s in reversed(self.data.pending)]
        if self.data.heat_loss is not None:
            used = self.heat_loss_w_per_k() or DEFAULT_HEAT_LOSS_W_PER_K
            out.append(
                heat_loss_view(self.data.heat_loss, lang, used=used, default=DEFAULT_HEAT_LOSS_W_PER_K)
            )
        out += [
            suggestion_view(r.suggestion, r.action, lang)
            for r in reversed(self.data.resolutions)
            if before(now - RESOLVED_SHOWN, r.at)
        ]
        return out

    def _pending(self, suggestion_id: str) -> Suggestion:
        sg = next((s for s in self.data.pending if s.id == suggestion_id), None)
        if sg is None:
            raise NoSuchSuggestion(suggestion_id)
        return sg

    def _withdraw(self, stale: list[Suggestion], now: datetime) -> None:
        self.data.pending = [p for p in self.data.pending if p not in stale]
        self.revision += 1
        for sg in stale:
            data: dict[str, float | str | bool] = {"setting": sg.setting}
            self._c.log.record_system(now, [Reason("system", "suggestion_stale", data)])

    @callback
    def on_settings_changed(self, old: Settings, new: Settings, now: datetime) -> None:
        """A setting changed: evidence about it starts afresh, and suggestions about it no longer apply."""
        try:
            changed = lever_changes(old, new)
            for setting in changed:
                self.data.changed[setting] = now
            stale = [p for p in self.data.pending if not is_fresh(new, p)]
            if stale:
                self._withdraw(stale, now)
            if changed or stale:
                self._save_soon()
        except Exception:
            LOGGER.exception("Could not note the settings change for learning; the settings are saved")

    async def _async_decided(self) -> None:
        self.revision += 1
        await self.async_save()
        await self._c.async_flush()

    async def async_apply(self, suggestion_id: str) -> None:
        """NoSuchSuggestion, or StaleSuggestion / ValueError if it no longer applies.

        The change is built from the settings found once the coordinator's lock is held, and the decision is
        recorded in the same step: whatever someone else changed while apply waited stays as they left it.
        """
        now = dt_util.now()
        sg = self._pending(suggestion_id)

        def patch(settings: Settings) -> dict[str, Any]:
            if sg not in self.data.pending:
                raise StaleSuggestion(sg.setting)  # withdrawn while waiting
            return suggestion_patch(settings, sg)

        def applied() -> None:
            self.data.pending.remove(sg)  # before the change is noted, so it is not withdrawn as stale
            self.data.resolutions.append(Resolution(sg, "applied", now))
            data: dict[str, float | str | bool] = {"setting": sg.setting, "old": sg.old, "new": sg.new}
            self._c.log.record_system(now, [Reason("system", "suggestion_applied", data)])

        try:
            await self._c.async_patch_settings(patch, "suggestion", on_merged=applied)
        except StaleSuggestion:
            if sg in self.data.pending:
                self._withdraw([sg], now)
            await self.async_save()
            raise
        await self._async_decided()

    async def async_dismiss(self, suggestion_id: str) -> None:
        now = dt_util.now()
        sg = self._pending(suggestion_id)
        self.data.pending.remove(sg)
        self.data.resolutions.append(Resolution(sg, "dismissed", now))
        data: dict[str, float | str | bool] = {"setting": sg.setting}
        self._c.log.record_system(now, [Reason("system", "suggestion_dismissed", data)])
        await self._async_decided()

    async def async_feedback(self, room: Room, kind: MarkKind) -> Suggestion | None:
        """Keep a Cold/Hot mark; the suggestion it leads to, if any. NotReady before the first decision."""
        result = self._c.data
        if result is None or result.decision is None:
            raise NotReady
        now = dt_util.now()
        settings = self._c.settings
        self.data.marks.append(make_mark(room, kind, settings, result.snapshot, result.decision, at=now))
        data: dict[str, float | str | bool] = {"room": room.value, "mark": kind}
        self._c.log.record_system(now, [Reason("system", "feedback_marked", data)])
        sg = feedback_suggestion(
            self.data.marks, room, kind, settings, self.data.resolutions, now, changed=self.data.changed
        )
        if sg is not None:
            self.offer(sg, now)
            sg = next(p for p in self.data.pending if p.key == sg.key)  # the one shown already, if the same
        await self.async_save()
        await self._c.async_flush()
        return sg

    def offer(self, sg: Suggestion, now: datetime) -> bool:
        """Add a suggestion (one per key); True if the card has something new to show."""
        shown = self.data.pending
        self.data.pending = upsert_pending(shown, sg)
        if self.data.pending == shown:
            return False
        self.revision += 1
        data: dict[str, float | str | bool] = {"setting": sg.setting, "old": sg.old, "new": sg.new}
        self._c.log.record_system(now, [Reason("system", "suggestion_created", data)])
        return True
