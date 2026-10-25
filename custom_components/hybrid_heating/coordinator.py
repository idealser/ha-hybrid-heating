"""The control loop: read the house, take over what ACTIVE layers need, tick, act, log and save."""

import asyncio
import copy
import logging
from collections import deque
from collections.abc import Mapping, Sequence
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
from homeassistant.helpers import entity_registry as er
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
    VERSION,
)
from .core.controller import ControllerState, tick
from .core.timeutil import after, before, elapsed_s
from .core.types import Decision, Layer, LayerMode, Reason, Settings, Snapshot
from .decision_log import DecisionLog
from .entity_map import EntityMap
from .executor import async_run_commands
from .learning_manager import LearningManager
from .snapshot import build_snapshot
from .status import is_live, load_pending_any, next_load_deadline_any
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
from .view import as_float, is_available, power_kw
from .window import OutdoorWindow

LOGGER = logging.getLogger(__package__)
OWN_CONTEXTS = 50
NOBODY = Wants(boiler=False, load=False, ac=False, automation_consent=False)
DEADLINE_SLACK_S = 0.05  # land just after a hold time ends, not just before it
# The card drives these entities through their services: (platform, translation key)
CONTROLS = {
    "enabled": ("switch", "enabled"),
    "hybrid": ("switch", "hybrid_mode"),
    "preset": ("select", "preset"),
    "boiler_mode": ("select", "boiler_mode"),
}

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
        # While Home Assistant starts, entities come up one by one: wait a grace period after it has
        # started. None until then.
        self._ready_at: datetime | None = now if hass.state is CoreState.running else None
        self._reassert_pending = False
        self._loaded = False
        self._stopping = False  # set once on unload or a failed setup; nothing may take over afterwards
        self._last_saved: datetime | None = None
        self._saved_log_revision = -1
        self._deadline_unsub: CALLBACK_TYPE | None = None
        self._alerted: set[str] = set()
        self.revision = 1  # +1 on every settings change, so the card knows when to reload them
        self.learning = LearningManager(self)

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
        self._loaded = True
        # A thermostat held before this start may have been switched back on by Home Assistant itself.
        self._reassert_pending = loaded.takeover.thermostat_prev is not None
        if loaded.saved_at is not None:
            saved = {"saved_at": loaded.saved_at.isoformat()}
            self.log.record_system(now, [Reason("system", "restored_after_restart", saved)])
        for name in loaded.reset_sections:
            self.log.record_system(now, [Reason("system", "store_section_reset", {"section": name})])
        await self.learning.async_load(now)
        entry = self.config_entry
        self.learning.async_setup_jobs(entry)
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
        if self._ready_at is None:
            entry.async_on_unload(async_at_started(self.hass, self._on_started))

    @callback
    def _on_started(self, hass: HomeAssistant) -> None:
        self._ready_at = after(dt_util.now(), STARTUP_GRACE_S)

    def _is_ready(self, now: datetime) -> bool:
        return self._ready_at is not None and not before(now, self._ready_at)

    async def async_stop(self, code: str) -> None:
        """Stop the loop for good, then give everything back. Nothing takes over again afterwards.

        The flag and the shutdown come first: a refresh queued behind the release must not tick.
        """
        self._stopping = True
        self._cancel_deadline()
        await self.async_shutdown()
        if self._loaded:  # a store that never loaded must not be overwritten with defaults
            await self.async_release_all(code)
            await self.learning.async_save()

    async def async_flush(self) -> None:
        self._last_saved = dt_util.now()
        revision = self.log.revision
        log = {"entries": self.log.to_data()} if revision != self._saved_log_revision else None
        await self.store.async_save_now(self._state_data(), log)
        self._saved_log_revision = revision

    async def _maybe_save(self, now: datetime) -> None:
        if self._last_saved is None or elapsed_s(now, self._last_saved) >= SAVE_DELAY_S:
            await self.async_flush()

    async def _on_final_write(self, event: Event) -> None:
        await self.async_flush()
        await self.learning.async_save()

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

    def config_view(self) -> dict[str, Any]:
        """What the dashboard and the diagnostics show about the configuration."""
        return {
            "revision": self.revision,
            "version": VERSION,
            "enabled": self.enabled,
            "settings": to_data(self.settings),
            "entities": self.entities.to_mapping(),
            "controls": self.controls(),
            "takeover": to_data(self.takeover),
        }

    def controls(self) -> dict[str, str]:
        """Entity ids of this integration's own switches and selects, as the user may have renamed them."""
        registry = er.async_get(self.hass)
        out: dict[str, str] = {}
        for name, (platform, key) in CONTROLS.items():
            unique_id = f"{self.config_entry.entry_id}_{key}"
            out[name] = (
                registry.async_get_entity_id(platform, DOMAIN, unique_id) or f"{platform}.{DOMAIN}_{key}"
            )
        return out

    def window_mean(self, now: datetime) -> float | None:
        return self.window.mean(now, self.settings.season.window_hours)

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

    def _snapshot(self, now: datetime) -> Snapshot:
        return build_snapshot(
            self.hass.states, self.entities, now, self.window_mean(now), self.settings.sensor_offsets
        )

    def _status(self, decision: Decision | None, *, starting: bool = False) -> str:
        observe = self.settings.layers.get(Layer.BOILER) is LayerMode.OBSERVE
        return render_status(
            decision,
            lang_for(self.hass.config.language),
            enabled=self.enabled and not self._stopping,
            starting=starting,
            boiler_observe=observe,
        )

    def _load_may_act(self, now: datetime) -> bool:
        """The load layer runs during the start-up grace too: acting on a valid overload is always safe."""
        return self.enabled and (self._is_ready(now) or is_live(self.settings, Layer.LOAD))

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
                fast = self._load_may_act(now) and load_pending_any(self.state, now)
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
        ready = self._is_ready(now)
        if ready:
            await self._reassert(now)
            if await self._apply_takeover(now, self._wants()):
                snap = self._snapshot(now)
        elif not is_live(self.settings, Layer.LOAD):
            return TickResult(now, snap, None, self._status(None, starting=True))

        settings = self.settings if ready else self._grace_settings()
        decision = await self._run_tick(now, settings, snap)
        outcomes = await self._execute(decision)
        self.log.record_tick(now, decision, outcomes)
        self.learning.on_tick(settings, snap, decision, self.state)
        if any(o.status == "ok" for o in outcomes):
            # What was just done (writes, a shed water heater, owned ACs) must survive a crash.
            await self.async_flush()
        else:
            await self._maybe_save(now)
        shown = decision if ready else None
        return TickResult(now, snap, shown, self._status(shown, starting=not ready), tuple(outcomes))

    async def _reassert(self, now: datetime) -> None:
        if not self._reassert_pending or not is_available(self.hass.states.get(self.entities.thermostat)):
            return  # an unavailable thermostat is checked again once it is back
        self._reassert_pending = False
        commands, reasons = plan_reassert(self.takeover, self._wants(), self.hass.states, self.entities)
        if commands:
            await self._run_system(now, commands, reasons)

    async def _run_tick(self, now: datetime, settings: Settings, snap: Snapshot) -> Decision:
        before_tick = copy.deepcopy(self.state)
        try:
            decision = tick(settings, snap, self.state)
        except Exception as err:
            self.state = before_tick  # a half-updated state would carry the bug into the next tick
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
            results = await async_run_commands(self.hass, commands, ctx)
            self._track(results)
            outcomes.append(outcome_for(action, results))
        return outcomes

    def _track(self, results: Sequence[CommandResult]) -> None:
        """One notification per device that stops answering, dismissed once it answers again."""
        for r in results:
            entity_id = r.command.entity_id
            if r.status == "ok" and entity_id in self._alerted:
                self._alerted.discard(entity_id)
                alerts.dismiss_unreachable(self.hass, entity_id)
            elif r.status != "ok" and entity_id not in self._alerted:
                self._alerted.add(entity_id)
                alerts.notify_unreachable(self.hass, entity_id, r.detail)

    @callback
    def _arm_deadline(self, now: datetime) -> None:
        self._cancel_deadline()
        if self._stopping or not self._load_may_act(now):
            return
        due = next_load_deadline_any(self.state, self.settings.load, now)
        if due is not None:
            delay = max(0.0, elapsed_s(due, now)) + DEADLINE_SLACK_S
            self._deadline_unsub = async_call_later(self.hass, delay, self._on_deadline)

    @callback
    def _cancel_deadline(self) -> None:
        if self._deadline_unsub is not None:
            self._deadline_unsub()
            self._deadline_unsub = None

    @callback
    def _on_deadline(self, _now: datetime) -> None:
        self._deadline_unsub = None
        self.config_entry.async_create_task(self.hass, self.async_refresh())

    # Taking over and giving back

    def _wants(self) -> Wants:
        return wants_for(self.enabled, self.settings, self.entities.disable_overpower_automation)

    async def _run_system(
        self, now: datetime, commands: Sequence[Command], reasons: Sequence[Reason]
    ) -> list[CommandResult]:
        results = await async_run_commands(self.hass, commands, self._new_context()) if commands else []
        self._track(results)
        if reasons or results:
            self.log.record_system(now, reasons, results)
        return results

    async def _apply_takeover(self, now: datetime, wants: Wants, extra: Sequence[Reason] = ()) -> bool:
        """Bring the house in line with `wants`; True if anything was sent or the takeover state changed.

        A step's state change is committed only once all its commands landed, so whatever did not land
        is planned again on the next pass.
        """
        before_takeover = copy.copy(self.takeover)  # its fields are immutable values
        steps = plan_takeover(self.takeover, wants, self.hass.states, self.entities, self.state, now)
        commands = [c for s in steps for c in s.commands]
        results = await self._run_system(now, commands, [*extra, *(r for s in steps for r in s.reasons)])
        landed = iter(r.status == "ok" for r in results)
        for step in steps:
            if all([next(landed) for _ in step.commands]):
                step.commit()
        changed = bool(commands) or self.takeover != before_takeover
        if changed or extra:
            await self.async_flush()
        return changed

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
        self.async_update_listeners()  # entities show the change now, the refresh may be debounced
        await self.async_request_refresh()
        return new

    async def _patch_settings(
        self, now: datetime, patch: Mapping[str, Any], source: str, extra: Sequence[Reason] = ()
    ) -> Settings:
        if self._stopping:
            return self.settings  # unloading: taking over again is no longer allowed
        new = merge_settings(self.settings, patch)
        self.settings = new
        self.revision += 1
        changed = Reason("system", "settings_changed", {"keys": ",".join(sorted(patch)), "source": source})
        await self._apply_takeover(now, self._wants(), [*extra, changed])
        return new

    # Events

    @callback
    def _on_state_event(self, event: Event[EventStateChangedData]) -> None:
        entity_id = event.data["entity_id"]
        old_state, new_state = event.data["old_state"], event.data["new_state"]
        old, new = _state(old_state), _state(new_state)
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
            kw = power_kw(new_state)
            over = kw is not None and kw > self.settings.load.limit_kw
            if not over and not load_pending_any(self.state, dt_util.now()):
                return  # power moves all the time; only an overload needs a tick before the next one
        elif not _relevant_change(old_state, new_state):
            return  # e.g. a climate reporting a new current temperature: nothing the module reads
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
        self.async_update_listeners()
        await self.async_request_refresh()


def _state(s: State | None) -> str | None:
    return s.state if s is not None else None


def _relevant_change(old: State | None, new: State | None) -> bool:
    """The state or the target temperature changed: the only parts of a trigger the module reads."""
    if old is None or new is None:
        return True
    return old.state != new.state or old.attributes.get("temperature") != new.attributes.get("temperature")


@callback
def _keep_ticking() -> None:
    """A listener that does nothing, so the coordinator keeps its schedule."""
