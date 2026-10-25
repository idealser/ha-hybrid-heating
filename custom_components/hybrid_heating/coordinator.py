"""The control loop: read the house, take over what ACTIVE layers need, tick, act, log and save."""

from __future__ import annotations

import asyncio
import copy
import logging
from collections import deque
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Literal

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import (
    Context,
    CoreState,
    Event,
    EventStateChangedData,
    HomeAssistant,
    State,
    callback,
)
from homeassistant.helpers.debounce import Debouncer
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .codec import merge_settings, to_data
from .commands import ActionOutcome, Command, commands_for, outcome_for
from .const import DEBOUNCE_S, DOMAIN, FAST_TICK_S, MAX_TICK_FAILURES, STARTUP_GRACE_S, TICK_S
from .core.controller import ControllerState, tick
from .core.types import ActionKind, Decision, Layer, LayerMode, Reason, Settings, Snapshot
from .decision_log import DecisionLog
from .entity_map import EntityMap
from .executor import async_run_commands
from .snapshot import build_snapshot
from .status import load_pending_any
from .storage import HybridStore
from .takeover import TakeoverState, Wants, apply_user_override, is_user_override, plan_takeover, wants_for
from .texts import lang_for, render_status
from .view import as_float, power_kw
from .window import OutdoorWindow

LOGGER = logging.getLogger(__package__)
OWN_CONTEXTS = 50
NOBODY = Wants(boiler=False, load=False, ac=False, automation_consent=False)
BOILER_WRITES = frozenset({ActionKind.BOILER_FLOW, ActionKind.BOILER_RODS})

type HybridHeatingConfigEntry = ConfigEntry[HybridHeatingCoordinator]


@dataclass(frozen=True)
class TickResult:
    now: datetime
    snapshot: Snapshot
    decision: Decision | None
    status: str
    outcomes: tuple[ActionOutcome, ...] = ()


class HybridHeatingCoordinator(DataUpdateCoordinator[TickResult]):
    config_entry: HybridHeatingConfigEntry

    def __init__(self, hass: HomeAssistant, entry: HybridHeatingConfigEntry) -> None:
        super().__init__(
            hass,
            LOGGER,
            config_entry=entry,
            name=DOMAIN,
            update_interval=timedelta(seconds=TICK_S),
            request_refresh_debouncer=Debouncer(hass, LOGGER, cooldown=DEBOUNCE_S, immediate=True),
        )
        now = dt_util.now()
        self.entities = EntityMap.from_entry_dicts(entry.data, entry.options)
        self.store = HybridStore(hass, entry.entry_id)
        self.settings = Settings()
        self.enabled = True
        self.state = ControllerState.initial(now)
        self.takeover = TakeoverState()
        self.window = OutdoorWindow()
        self.log = DecisionLog()
        self._lock = asyncio.Lock()
        self._own: deque[str] = deque(maxlen=OWN_CONTEXTS)
        self._failures = 0
        # While Home Assistant starts, entities come up one by one: wait a grace period after it has started.
        self._starting = hass.state is not CoreState.running
        self._ready_at: datetime | None = None

    # Lifecycle

    async def _async_setup(self) -> None:
        now = dt_util.now()
        loaded = await self.store.async_load(now)
        self.enabled = loaded.enabled
        self.settings = loaded.settings
        self.state = loaded.state
        self.takeover = loaded.takeover
        self.window = loaded.window
        self.log = loaded.log
        if loaded.saved_at is not None:
            saved = {"saved_at": loaded.saved_at.isoformat()}
            self.log.record_system(now, [Reason("system", "restored_after_restart", saved)])
        for name in loaded.reset_sections:
            self.log.record_system(now, [Reason("system", "store_section_reset", {"section": name})])
        entry = self.config_entry
        # The coordinator polls only while something listens; the control loop must run even with
        # every entity disabled.
        entry.async_on_unload(self.async_add_listener(_keep_ticking))
        entry.async_on_unload(
            async_track_state_change_event(self.hass, self.entities.trigger_ids(), self._on_state_event)
        )
        if self._starting:
            entry.async_on_unload(async_at_started(self.hass, self._on_started))

    @callback
    def _on_started(self, hass: HomeAssistant) -> None:
        self._ready_at = dt_util.now() + timedelta(seconds=STARTUP_GRACE_S)

    def _is_ready(self, now: datetime) -> bool:
        if self._starting and self._ready_at is not None and now >= self._ready_at:
            self._starting = False
        return not self._starting

    async def async_flush(self) -> None:
        await self.store.async_save_now(self._state_data(), self._log_data())

    def _state_data(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "settings": to_data(self.settings),
            "controller": to_data(self.state),
            "takeover": to_data(self.takeover),
            "window": self.window.to_data(),
            "saved_at": dt_util.now().isoformat(),
        }

    def _log_data(self) -> dict[str, Any]:
        return {"entries": self.log.to_data()}

    def _schedule_save(self) -> None:
        self.store.schedule_save(self._state_data, self._log_data)

    # Own changes: every service call carries a context this module created

    def remember_context(self, ctx: Context) -> None:
        self._own.append(ctx.id)

    def is_own(self, ctx_id: str) -> bool:
        return ctx_id in self._own

    def _new_context(self) -> Context:
        ctx = Context()
        self.remember_context(ctx)  # before the call, so the resulting state change is recognised
        return ctx

    # The tick

    @property
    def lang(self) -> str:
        return lang_for(self.hass.config.language)

    def _snapshot(self, now: datetime) -> Snapshot:
        return build_snapshot(
            self.hass.states, self.entities, now, self._window_mean(now), self.settings.sensor_offsets
        )

    def _window_mean(self, now: datetime) -> float | None:
        return self.window.mean(now, self.settings.season.window_hours)

    def _status(self, decision: Decision | None, *, starting: bool = False) -> str:
        observe = self.settings.layers.get(Layer.BOILER) is LayerMode.OBSERVE
        return render_status(
            decision, self.lang, enabled=self.enabled, starting=starting, boiler_observe=observe
        )

    async def _async_update_data(self) -> TickResult:
        async with self._lock:
            try:
                return await self._tick()
            finally:
                # Ticks seconds apart while the load layer (live or observed) is over the limit or pausing.
                fast = self.enabled and not self._starting and load_pending_any(self.state, dt_util.now())
                self.update_interval = timedelta(seconds=FAST_TICK_S if fast else TICK_S)

    async def _tick(self) -> TickResult:
        now = dt_util.now()  # Home Assistant's time zone: the night window follows the house clock
        self.window.add(now, as_float(self.hass.states.get(self.entities.outdoor)))
        self.window.prune(now)
        snap = self._snapshot(now)
        if not self.enabled:
            self._schedule_save()
            return TickResult(now, snap, None, self._status(None))
        if not self._is_ready(now):
            return TickResult(now, snap, None, self._status(None, starting=True))

        if await self._apply_takeover(now, self._wants()):
            snap = self._snapshot(now)

        before = copy.deepcopy(self.state)
        try:
            decision = tick(self.settings, snap, self.state)
        except Exception as err:
            self.state = before  # a half-updated state would carry the bug into the next tick
            self.log.record_system(now, [Reason("system", "tick_failed", {"error": repr(err)})])
            self._failures += 1
            if self._failures >= MAX_TICK_FAILURES:
                self._failures = 0
                self.enabled = False
                await self._apply_takeover(now, NOBODY, [Reason("system", "failsafe_released")])
            else:
                self._schedule_save()
            raise UpdateFailed(f"tick failed: {err!r}") from err
        self._failures = 0

        outcomes = await self._execute(decision)
        self.log.record_tick(now, decision, outcomes)
        if any(o.status == "ok" and o.action.kind in BOILER_WRITES for o in outcomes):
            await self.async_flush()  # the daily write budget must survive a crash
        else:
            self._schedule_save()
        return TickResult(now, snap, decision, self._status(decision), tuple(outcomes))

    async def _execute(self, decision: Decision) -> list[ActionOutcome]:
        if not decision.actions:
            return []
        ctx = self._new_context()
        outcomes: list[ActionOutcome] = []
        for action in decision.actions:
            try:
                commands = commands_for(action, self.entities, self.hass.states)
            except ValueError as err:
                outcomes.append(ActionOutcome(action, "failed", repr(err)))
                continue
            outcomes.append(outcome_for(action, await async_run_commands(self.hass, commands, ctx)))
        return outcomes

    # Taking over and giving back

    def _wants(self) -> Wants:
        return wants_for(self.enabled, self.settings, self.entities.disable_overpower_automation)

    async def _run_system(
        self, now: datetime, commands: Sequence[Command], reasons: Sequence[Reason]
    ) -> None:
        results = await async_run_commands(self.hass, commands, self._new_context()) if commands else []
        if reasons or results:
            self.log.record_system(now, reasons, results)

    async def _apply_takeover(self, now: datetime, wants: Wants, extra: Sequence[Reason] = ()) -> bool:
        """Bring the house in line with `wants`; True if anything was sent or the takeover state changed."""
        before = to_data(self.takeover)
        commands, reasons = plan_takeover(
            self.takeover, wants, self.hass.states, self.entities, self.state, now
        )
        await self._run_system(now, commands, [*extra, *reasons])
        changed = bool(commands) or to_data(self.takeover) != before
        if changed or extra:
            await self.async_flush()
        return changed

    async def async_apply_takeover(self, now: datetime) -> None:
        async with self._lock:
            await self._apply_takeover(now, self._wants())

    async def async_release_all(self, code: str) -> None:
        """Give everything back, whatever the settings say, and log why."""
        async with self._lock:
            await self._apply_takeover(dt_util.now(), NOBODY, [Reason("system", code)])

    async def async_set_enabled(self, on: bool) -> None:
        self.enabled = on
        if on:
            async with self._lock:
                self.log.record_system(dt_util.now(), [Reason("system", "module_enabled")])
                await self.async_flush()
        else:
            await self.async_release_all("module_disabled")
        await self.async_refresh()

    async def async_patch_settings(
        self, patch: Mapping[str, Any], source: Literal["ws", "entity"]
    ) -> Settings:
        """Merge a partial settings change; ValueError leaves the settings as they were."""
        async with self._lock:
            new = await self._patch_settings(dt_util.now(), patch, source)
        await self.async_request_refresh()
        return new

    async def _patch_settings(
        self, now: datetime, patch: Mapping[str, Any], source: str, extra: Sequence[Reason] = ()
    ) -> Settings:
        new = merge_settings(self.settings, patch)
        self.settings = new
        changed = Reason("system", "settings_changed", {"keys": ",".join(sorted(patch)), "source": source})
        await self._apply_takeover(now, self._wants(), [*extra, changed])
        return new

    # Events

    @callback
    def _on_state_event(self, event: Event[EventStateChangedData]) -> None:
        entity_id = event.data["entity_id"]
        old, new = _state(event.data["old_state"]), _state(event.data["new_state"])
        own = self.is_own(event.context.id)
        if entity_id == self.entities.thermostat:
            if self.takeover.thermostat_prev is not None and is_user_override(old, new, own):
                self.config_entry.async_create_task(self.hass, self._async_user_override("thermostat"))
            return
        if entity_id == self.entities.overpower_automation:
            if self.takeover.automation_disabled and is_user_override(old, new, own):
                self.config_entry.async_create_task(self.hass, self._async_user_override("automation"))
            return
        if own:
            return  # one of our own commands landing: nothing new to decide
        if entity_id == self.entities.total_power:
            kw = power_kw(event.data["new_state"])
            over = kw is not None and kw > self.settings.load.limit_kw
            if not over and not load_pending_any(self.state, dt_util.now()):
                return  # power moves all the time; only an overload needs a tick before the next one
        self.config_entry.async_create_task(self.hass, self.async_request_refresh())

    async def _async_user_override(self, what: Literal["thermostat", "automation"]) -> None:
        """Someone switched on what this module had switched off: they win, and it stays theirs."""
        async with self._lock:
            now = dt_util.now()
            reason = apply_user_override(self.takeover, what)
            if what == "thermostat":
                # In the same lock, so no tick can take the thermostat back in between.
                observe = {"layers": {"boiler": LayerMode.OBSERVE.value}}
                await self._patch_settings(now, observe, "entity", [reason])
            else:
                self.log.record_system(now, [reason])
                await self.async_flush()
        await self.async_request_refresh()


def _state(s: State | None) -> str | None:
    return s.state if s is not None else None


@callback
def _keep_ticking() -> None:
    """A listener that does nothing, so the coordinator keeps its schedule."""
