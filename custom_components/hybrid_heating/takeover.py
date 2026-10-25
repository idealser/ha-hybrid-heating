"""Taking control from the existing heating setup and giving it back. No Home Assistant imports here.

The module only takes what an ACTIVE layer needs: the thermostat and the boiler settings for the boiler
layer, the overpower automation (with consent) and whatever it shed for the load layer. Whatever it took
it gives back, with the values it found, when the layer leaves ACTIVE or the module stops.

Planning is two-phase: plan_takeover returns steps, and a step's change to TakeoverState is committed only
once all its commands have landed. A take or give-back that did not land is simply planned again.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from .commands import Command, commands_for, set_hvac_mode, toggle
from .core.boiler import register_write
from .core.controller import ControllerState
from .core.load import LoadState
from .core.types import Action, ActionKind, Layer, Reason, Settings
from .entity_map import EntityMap
from .status import is_live
from .view import UNAVAILABLE, StateView, as_float, as_switch, attr_float, is_available

FLOW_RESTORE_MIN_DELTA = 0.5


@dataclass(frozen=True)
class ThermostatPrev:
    hvac_mode: str
    temperature: float | None = None


@dataclass(frozen=True)
class BoilerPrev:
    flow: float | None = None
    rods: int | None = None


@dataclass
class TakeoverState:
    thermostat_prev: ThermostatPrev | None = None  # None: the thermostat is not taken
    boiler_prev: BoilerPrev | None = None
    automation_disabled: bool = False
    load_taken: bool = False
    ac_taken: bool = False


@dataclass(frozen=True)
class Wants:
    boiler: bool
    load: bool
    ac: bool
    automation_consent: bool


def _nothing() -> None:
    pass


@dataclass
class Step:
    """Commands and the TakeoverState change they make true; commit() runs once all of them landed."""

    commands: list[Command] = field(default_factory=list)
    reasons: list[Reason] = field(default_factory=list)
    commit: Callable[[], None] = _nothing


def wants_for(enabled: bool, settings: Settings, consent: bool) -> Wants:
    def live(layer: Layer) -> bool:
        return enabled and is_live(settings, layer)

    return Wants(live(Layer.BOILER), live(Layer.LOAD), live(Layer.AC), consent)


def _system(code: str, **data: str) -> Reason:
    return Reason("system", code, data)


def _give_back_thermostat(st: TakeoverState, view: StateView, entities: EntityMap) -> list[Step]:
    prev = st.thermostat_prev
    if prev is None or not is_available(view.get(entities.thermostat)):
        return []  # an unavailable thermostat keeps its saved settings for the next attempt
    if prev.temperature is None:
        restore = set_hvac_mode(entities.thermostat, prev.hvac_mode)
    else:
        data = {
            "entity_id": entities.thermostat,
            "temperature": prev.temperature,
            "hvac_mode": prev.hvac_mode,
        }
        restore = Command("climate", "set_temperature", data)

    def commit() -> None:
        st.thermostat_prev = None

    return [Step([restore], [_system("thermostat_restored")], commit)]


def _give_back_load(
    st: TakeoverState,
    wants: Wants,
    view: StateView,
    entities: EntityMap,
    ctrl: ControllerState,
    now: datetime,
) -> list[Step]:
    automation = Step()
    if st.automation_disabled and entities.overpower_automation is not None:
        automation.commands.append(toggle("automation", entities.overpower_automation, True))
        automation.reasons.append(_system("automation_restored"))

    def release() -> None:
        st.automation_disabled = False
        st.load_taken = False

    automation.commit = release
    devices = Step()
    load = ctrl.load
    if load.water_heater_shed and as_switch(view.get(entities.water_heater)) is not True:
        devices.commands += commands_for(Action(ActionKind.WATER_HEATER, True), entities, view)
        devices.reasons.append(_system("water_heater_restored"))
    rods = Step()
    # The heat call and the rods belong to the load layer while it holds them. A live boiler layer
    # takes them over on its next tick; otherwise they go back to what the boiler had.
    if not wants.boiler:
        if load.call_paused and as_switch(view.get(entities.boiler_call)) is False:
            devices.commands += commands_for(Action(ActionKind.BOILER_CALL, True), entities, view)
        rods_now = as_float(view.get(entities.boiler_rods))
        # With boiler_prev set, the boiler hand-back right after restores the rods once.
        base = load.rods_base
        if base is not None and st.boiler_prev is None and rods_now is not None and int(rods_now) != base:
            rods.commands += commands_for(Action(ActionKind.BOILER_RODS, base), entities, view)
            rods.commit = lambda: register_write(ctrl.boiler, now, flow=False)
    ctrl.load = LoadState()
    return [automation, devices, rods]


def _give_back_acs(entities: EntityMap, view: StateView, ctrl: ControllerState) -> Step:
    step = Step()
    quiet = {room for room, on in ctrl.ac.quiet.items() if on}
    for room in sorted(ctrl.ac.owned):
        step.commands += commands_for(Action(ActionKind.AC_HVAC, "off", room), entities, view)
        if room in quiet:
            step.commands += commands_for(Action(ActionKind.AC_QUIET, False, room), entities, view)
    for room in sorted(quiet - ctrl.ac.owned):
        step.commands += commands_for(Action(ActionKind.AC_QUIET, False, room), entities, view)
    released = sorted(ctrl.ac.owned | quiet)
    if released:
        step.reasons.append(_system("acs_released", rooms=",".join(r.value for r in released)))
    ctrl.ac.owned = set()
    ctrl.ac.quiet = {}
    return step


def _give_back_boiler(
    st: TakeoverState,
    view: StateView,
    entities: EntityMap,
    ctrl: ControllerState,
    now: datetime,
    load_holds_rods: bool,
) -> list[Step]:
    prev = st.boiler_prev
    boiler = view.get(entities.boiler_flow)
    if prev is None or not is_available(boiler):
        return []
    step = Step(reasons=[_system("boiler_settings_restored")])
    flow_now = attr_float(boiler, "temperature")
    write_flow = prev.flow is not None and (
        flow_now is None or abs(flow_now - prev.flow) >= FLOW_RESTORE_MIN_DELTA
    )
    if write_flow and prev.flow is not None:
        step.commands += commands_for(Action(ActionKind.BOILER_FLOW, prev.flow), entities, view)
    rods_now = as_float(view.get(entities.boiler_rods))
    write_rods = False
    if prev.rods is not None and load_holds_rods:
        ctrl.load.rods_base = prev.rods  # the live load layer hands these back once nothing is shed
    elif prev.rods is not None and (rods_now is None or int(rods_now) != prev.rods):
        step.commands += commands_for(Action(ActionKind.BOILER_RODS, prev.rods), entities, view)
        write_rods = True

    def commit() -> None:
        st.boiler_prev = None
        if write_flow:
            register_write(ctrl.boiler, now)
        if write_rods:
            register_write(ctrl.boiler, now, flow=False)

    step.commit = commit
    return [step]


def _take_thermostat(st: TakeoverState, view: StateView, entities: EntityMap) -> list[Step]:
    thermostat = view.get(entities.thermostat)
    if st.thermostat_prev is not None or not is_available(thermostat):
        return []
    prev = ThermostatPrev(thermostat.state, attr_float(thermostat, "temperature"))
    off = [set_hvac_mode(entities.thermostat, "off")] if thermostat.state != "off" else []

    def commit() -> None:
        st.thermostat_prev = prev

    return [Step(off, [_system("thermostat_taken")], commit)]


def _remember_boiler(st: TakeoverState, view: StateView, entities: EntityMap) -> list[Step]:
    # Only the boiler layer writes the flow setpoint, so only it remembers the boiler. Rods the load
    # layer sheds go back through ControllerState.load.rods_base.
    boiler = view.get(entities.boiler_flow)
    if st.boiler_prev is not None or not is_available(boiler):
        return []
    rods = as_float(view.get(entities.boiler_rods))
    prev = BoilerPrev(attr_float(boiler, "temperature"), int(rods) if rods is not None else None)

    def commit() -> None:
        st.boiler_prev = prev

    return [Step(commit=commit)]


def _take_load(st: TakeoverState, wants: Wants, view: StateView, entities: EntityMap) -> Step:
    step = Step()
    automation = entities.overpower_automation
    disable = False
    if automation is not None and as_switch(view.get(automation)) is True:
        if wants.automation_consent:
            disable = True
            step.commands.append(toggle("automation", automation, False))
            step.reasons.append(_system("automation_disabled"))
        else:
            step.reasons.append(_system("automation_still_enabled"))

    def commit() -> None:
        st.load_taken = True
        st.automation_disabled = st.automation_disabled or disable

    step.commit = commit
    return step


def plan_takeover(
    st: TakeoverState,
    wants: Wants,
    view: StateView,
    entities: EntityMap,
    ctrl: ControllerState,
    now: datetime,
) -> list[Step]:
    """Steps that bring the house in line with which layers are ACTIVE.

    TakeoverState changes only through the steps' commit(); ctrl is updated at once.
    """
    steps: list[Step] = []
    # Give back first, so nothing runs twice while control changes hands.
    if not wants.boiler:
        steps += _give_back_thermostat(st, view, entities)
    if not wants.load and st.load_taken:
        steps += _give_back_load(st, wants, view, entities, ctrl, now)
    if not wants.ac and st.ac_taken:
        steps.append(_give_back_acs(entities, view, ctrl))
        steps.append(Step(commit=lambda: setattr(st, "ac_taken", False)))
    if not wants.boiler:
        steps += _give_back_boiler(
            st, view, entities, ctrl, now, wants.load and ctrl.load.rods_base is not None
        )
    # Then take.
    if wants.boiler:
        steps += _take_thermostat(st, view, entities)
        steps += _remember_boiler(st, view, entities)
    if wants.load and not st.load_taken:
        steps.append(_take_load(st, wants, view, entities))
    if wants.ac and not st.ac_taken:
        steps.append(Step(commit=lambda: setattr(st, "ac_taken", True)))
    return steps


def plan_reassert(
    st: TakeoverState, wants: Wants, view: StateView, entities: EntityMap
) -> tuple[list[Command], list[Reason]]:
    """Right after a start: a thermostat the module holds but finds on is switched off again.

    Home Assistant may restore a thermostat to its initial mode instead of the off it was left in.
    What to give back later stays as it was saved.
    """
    thermostat = view.get(entities.thermostat)
    if (
        not wants.boiler
        or st.thermostat_prev is None
        or not is_available(thermostat)
        or thermostat.state == "off"
    ):
        return [], []
    return [set_hvac_mode(entities.thermostat, "off")], [_system("thermostat_reasserted")]


def pending_giveback(st: TakeoverState, entities: EntityMap) -> list[str]:
    """What the module still holds and could not give back, for a note to the user."""
    items: list[str] = []
    if (t := st.thermostat_prev) is not None:
        items.append(f"{entities.thermostat}: {t.hvac_mode}, {t.temperature}°")
    if (b := st.boiler_prev) is not None:
        items.append(f"{entities.boiler_flow}: {b.flow}°, {entities.boiler_rods}: {b.rods}")
    if st.automation_disabled and entities.overpower_automation is not None:
        items.append(f"{entities.overpower_automation}: on")
    return items


def is_user_override(old: str | None, new: str | None, own: bool) -> bool:
    """Someone else switched the entity on from off (not this module, not a reconnect)."""
    return not own and old == "off" and new is not None and new != "off" and new not in UNAVAILABLE


def apply_user_override(st: TakeoverState, what: Literal["thermostat", "automation"]) -> Reason:
    if what == "thermostat":
        st.thermostat_prev = None
        return _system("thermostat_user_override")
    st.automation_disabled = False
    return _system("automation_user_override")
