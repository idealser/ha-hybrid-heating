"""What the module learns from the house: day tallies, the morning check of the curve, the marks.

It rides along with the control loop and never decides anything in it: a failure here is logged and the
tick goes on.
"""

import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import callback
from homeassistant.helpers.event import async_track_time_change
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
from .core.model import update_tally
from .core.types import Decision, Reason, Settings, Snapshot

if TYPE_CHECKING:
    from .coordinator import HybridHeatingCoordinator

LOGGER = logging.getLogger(__package__)


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
        entry.async_on_unload(
            async_track_time_change(
                self._c.hass, self._async_morning_end, hour=end.hour, minute=end.minute, second=0
            )
        )

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
