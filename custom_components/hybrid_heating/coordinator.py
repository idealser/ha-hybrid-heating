"""The control loop: read the house, take over what ACTIVE layers need, tick, act, log and save."""

from __future__ import annotations

import asyncio
import copy
import logging
from collections import deque
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from types import MappingProxyType
from typing import Any, Literal

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_FINAL_WRITE
from homeassistant.core import (
    CALLBACK_TYPE,
    Context,
    CoreState,
    Event,
    EventStateChangedData,
    HomeAssistant,
    State,
    callback,
)
from homeassistant.helpers.debounce import Debouncer
from homeassistant.helpers.event import async_call_later, async_track_state_change_event
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from . import alerts
from .codec import merge_settings, to_data
from .commands import ActionOutcome, Command, CommandResult, commands_for, outcome_for
from .const import (
    DEBOUNCE_S,
    DOMAIN,
    FAST_TICK_S,
    MAX_TICK_FAILURES,
    SAVE_DELAY_S,
    STARTUP_GRACE_S,
    TICK_S,
)
from .core.controller import ControllerState, tick
from .core.timeutil import elapsed_s
from .core.types import Decision, Layer, LayerMode, Reason, Settings, Snapshot
from .decision_log import DecisionLog
from .entity_map import EntityMap
from .executor import async_run_commands
from .snapshot import build_snapshot
from .status import load_pending_any, next_load_deadline
from .storage import HybridStore
from .takeover import (
    TakeoverState,
    Wants,
    apply_user_override,
    is_user_override,
    plan_reassert,
    plan_takeover,
    wants_for,
)
from .texts import lang_for, render_status
from .view import as_float, power_kw
from .window import OutdoorWindow

LOGGER = logging.getLogger(__package__)
OWN_CONTEXTS = 50
NOBODY = Wants(boiler=False, load=False, ac=False, automation_consent=False)
DEADLINE_SLACK_S = 0.05  # land just after a hold time ends, not just before it

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
        self._reassert_pending = False
        self._stopping = False  # set once on unload or a failed setup; nothing may take over afterwards
        self._last_saved: datetime | None = None
        self._deadline_unsub: CALLBACK_TYPE | None = None
        self._alerted: set[str] = set()

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
        self._failures = loaded.failures
        # A thermostat held before this start may have been switched back on by Home Assistant itself.
        self._reassert_pending = loaded.takeover.thermostat_prev is not None
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
        entry.async_on_unload(
            self.hass.bus.async_listen(EVENT_HOMEASSISTANT_FINAL_WRITE, self._on_final_write)
        )
        entry.async_on_unload(self._cancel_deadline)
        if self._starting:
            entry.async_on_unload(async_at_started(self.hass, self._on_started))

    @callback
    def _on_started(self, hass: HomeAssistant) -> None:
        self._ready_at = dt_util.now() + timedelta(seconds=STARTUP_GRACE_S)

    def _is_ready(self, now: datetime) -> bool:
        if self._starting and self._ready_at is not None and now >= self._ready_at:
            self._starting = False
        return not self._starting

    async def async_stop(self, code: str) -> None:
        """Stop the loop for good, then give everything back. Nothing takes over again afterwards.

        The flag comes first: a refresh already waiting for the lock must not run a tick after the release.
        """
        self._stopping = True
        self._cancel_deadline()
        await self.async_shutdown()
        async with self._lock:
            await self._apply_takeover(dt_util.now(), NOBODY, [Reason("system", code)])

    async def async_flush(self) -> None:
        self._last_saved = dt_util.now()
        await self.store.async_save_now(self._state_data(), self._log_data())

    async def _maybe_save(self, now: datetime) -> None:
        if self._last_saved is None or elapsed_s(now, self._last_saved) >= SAVE_DELAY_S:
            await self.async_flush()

    async def _on_final_write(self, event: Event) -> None:
        await self.async_flush()

    def _state_data(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "settings": to_data(self.settings),
            "controller": to_data(self.state),
            "takeover": to_data(self.takeover),
            "window": self.window.to_data(),
            "failures": self._failures,
            "saved_at": dt_util.now().isoformat(),
        }

    def _log_data(self) -> dict[str, Any]:
        return {"entries": self.log.to_data()}

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
        enabled = self.enabled and not self._stopping
        return render_status(decision, self.lang, enabled=enabled, starting=starting, boiler_observe=observe)

    def _load_live(self) -> bool:
        return self.settings.layers.get(Layer.LOAD) is LayerMode.ACTIVE

    def _load_may_act(self) -> bool:
        """The load layer runs during the start-up grace too: acting on a valid overload is always safe."""
        return self.enabled and not self._stopping and (not self._starting or self._load_live())

    def _grace_settings(self) -> Settings:
        """During the start-up grace only the load layer acts; the boiler and the ACs wait."""
        layers = {
            layer: LayerMode.OBSERVE if layer is not Layer.LOAD and mode is LayerMode.ACTIVE else mode
            for layer, mode in self.settings.layers.items()
        }
        return replace(self.settings, layers=MappingProxyType(layers))

    async def _async_update_data(self) -> TickResult:
        async with self._lock:
            try:
                return await self._tick()
            finally:
                now = dt_util.now()
                # Ticks seconds apart while the load layer (live or observed) is over the limit or pausing,
                # and one exactly when a hold time or a pause ends.
                fast = self._load_may_act() and load_pending_any(self.state, now)
                self.update_interval = timedelta(seconds=FAST_TICK_S if fast else TICK_S)
                self._arm_deadline(now)

    async def _tick(self) -> TickResult:
        now = dt_util.now()  # Home Assistant's time zone: the night window follows the house clock
        self.window.add(now, as_float(self.hass.states.get(self.entities.outdoor)))
        self.window.prune(now)
        snap = self._snapshot(now)
        if self._stopping:
            return TickResult(now, snap, None, self._status(None))
        if not self.enabled:
            await self._apply_takeover(now, NOBODY)  # retry whatever could not be given back yet
            await self._maybe_save(now)
            return TickResult(now, snap, None, self._status(None))
        if not self._is_ready(now):
            outcomes: list[ActionOutcome] = []
            if self._load_live():
                decision = await self._run_tick(now, self._grace_settings(), snap)
                outcomes = await self._execute(decision)
                self.log.record_tick(now, decision, outcomes)
                await self._save_after(now, outcomes)
            return TickResult(now, snap, None, self._status(None, starting=True), tuple(outcomes))

        if self._reassert_pending:
            self._reassert_pending = False
            commands, reasons = plan_reassert(self.takeover, self._wants(), self.hass.states, self.entities)
            if commands:
                await self._run_system(now, commands, reasons)
        if await self._apply_takeover(now, self._wants()):
            snap = self._snapshot(now)

        decision = await self._run_tick(now, self.settings, snap)
        outcomes = await self._execute(decision)
        self.log.record_tick(now, decision, outcomes)
        await self._save_after(now, outcomes)
        return TickResult(now, snap, decision, self._status(decision), tuple(outcomes))

    async def _run_tick(self, now: datetime, settings: Settings, snap: Snapshot) -> Decision:
        before = copy.deepcopy(self.state)
        try:
            decision = tick(settings, snap, self.state)
        except Exception as err:
            self.state = before  # a half-updated state would carry the bug into the next tick
            self.log.record_system(now, [Reason("system", "tick_failed", {"error": repr(err)})])
            self._failures += 1
            if self._failures >= MAX_TICK_FAILURES:
                self._failures = 0
                self.enabled = False
                alerts.notify_failsafe(self.hass)
                await self._apply_takeover(now, NOBODY, [Reason("system", "failsafe_released")])
            else:
                await self.async_flush()  # the count must survive a setup retry or a restart
            raise UpdateFailed(f"tick failed: {err!r}") from err
        if self._failures:
            self._failures = 0
            await self.async_flush()
        return decision

    async def _save_after(self, now: datetime, outcomes: Sequence[ActionOutcome]) -> None:
        if any(o.status == "ok" for o in outcomes):
            await (
                self.async_flush()
            )  # what was just done (writes, shed water heater, owned ACs) must survive a crash
        else:
            await self._maybe_save(now)

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
            outcome = outcome_for(action, await async_run_commands(self.hass, commands, ctx))
            key = action.kind.value if action.room is None else f"{action.kind.value}_{action.room.value}"
            self._alert(key, outcome.status == "ok", [c.entity_id for c in commands], outcome.detail)
            outcomes.append(outcome)
        return outcomes

    def _alert(self, key: str, ok: bool, entities: Iterable[str], detail: str | None) -> None:
        """One notification per thing that stops answering, dismissed once it answers again."""
        if ok and key in self._alerted:
            self._alerted.discard(key)
            alerts.dismiss_unreachable(self.hass, key)
        elif not ok and key not in self._alerted:
            self._alerted.add(key)
            alerts.notify_unreachable(self.hass, key, entities, detail)

    @callback
    def _arm_deadline(self, now: datetime) -> None:
        self._cancel_deadline()
        if not self._load_may_act():
            return
        dues = [
            due
            for st in (self.state.load, self.state.shadow_load)
            if (due := next_load_deadline(st, self.settings.load, now)) is not None
        ]
        if dues:
            first = min(dues, key=lambda d: d.timestamp())
            self._deadline_unsub = async_call_later(
                self.hass, max(0.0, elapsed_s(first, now)) + DEADLINE_SLACK_S, self._on_deadline
            )

    @callback
    def _cancel_deadline(self) -> None:
        if self._deadline_unsub is not None:
            self._deadline_unsub()
            self._deadline_unsub = None

    @callback
    def _on_deadline(self, _now: datetime) -> None:
        self._deadline_unsub = None
        if not self._stopping:
            self.config_entry.async_create_task(self.hass, self.async_refresh())

    # Taking over and giving back

    def _wants(self) -> Wants:
        return wants_for(self.enabled, self.settings, self.entities.disable_overpower_automation)

    async def _run_system(
        self, now: datetime, commands: Sequence[Command], reasons: Sequence[Reason]
    ) -> list[CommandResult]:
        results = await async_run_commands(self.hass, commands, self._new_context()) if commands else []
        for r in results:
            self._alert(f"device_{r.command.entity_id}", r.status == "ok", [r.command.entity_id], r.detail)
        if reasons or results:
            self.log.record_system(now, reasons, results)
        return results

    def _roll_back_failed(self, before: TakeoverState, results: Sequence[CommandResult]) -> None:
        """A take or give-back that did not land is tried again next time, so keep what it needs."""
        failed = {r.command.entity_id for r in results if r.status != "ok"}
        if not failed:
            return
        st, e = self.takeover, self.entities
        if e.thermostat in failed:
            st.thermostat_prev = before.thermostat_prev
        if e.boiler_flow in failed or e.boiler_rods in failed:
            st.boiler_prev = before.boiler_prev
        if e.overpower_automation is not None and e.overpower_automation in failed:
            st.automation_disabled, st.load_taken = before.automation_disabled, before.load_taken

    async def _apply_takeover(self, now: datetime, wants: Wants, extra: Sequence[Reason] = ()) -> bool:
        """Bring the house in line with `wants`; True if anything was sent or the takeover state changed."""
        before = copy.deepcopy(self.takeover)
        commands, reasons = plan_takeover(
            self.takeover, wants, self.hass.states, self.entities, self.state, now
        )
        results = await self._run_system(now, commands, [*extra, *reasons])
        self._roll_back_failed(before, results)
        changed = bool(commands) or to_data(self.takeover) != to_data(before)
        if changed or extra:
            await self.async_flush()
        return changed

    async def async_apply_takeover(self, now: datetime) -> None:
        async with self._lock:
            if not self._stopping:
                await self._apply_takeover(now, self._wants())

    async def async_release_all(self, code: str) -> None:
        """Give everything back, whatever the settings say, and log why."""
        async with self._lock:
            await self._apply_takeover(dt_util.now(), NOBODY, [Reason("system", code)])

    async def async_set_enabled(self, on: bool) -> None:
        if self._stopping:
            return
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
        if self._stopping:
            return self.settings  # unloading: taking over again is no longer allowed
        new = merge_settings(self.settings, patch)
        self.settings = new
        changed = Reason("system", "settings_changed", {"keys": ",".join(sorted(patch)), "source": source})
        await self._apply_takeover(now, self._wants(), [*extra, changed])
        return new

    # Events

    @callback
    def _on_state_event(self, event: Event[EventStateChangedData]) -> None:
        if self._stopping:
            return
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
            if self._stopping:
                return
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
