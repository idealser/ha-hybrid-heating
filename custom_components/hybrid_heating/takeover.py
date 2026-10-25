"""Taking control from the existing heating setup and giving it back. No Home Assistant imports here.

The module only takes what an ACTIVE layer needs: the thermostat and the boiler settings for the boiler
layer, the overpower automation (with consent) and whatever it shed for the load layer. Whatever it took
it gives back, with the values it found, when the layer leaves ACTIVE or the module stops.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from .commands import Command, commands_for
from .core.boiler import register_write
from .core.controller import ControllerState
from .core.load import LoadState
from .core.types import Action, ActionKind, Layer, LayerMode, Reason, Settings
from .entity_map import EntityMap
from .view import StateView, as_float, as_switch, attr_float, is_available

FLOW_RESTORE_MIN_DELTA = 0.5


@dataclass
class TakeoverState:
    thermostat_prev: dict[str, str | float | None] | None = (
        None  # {"hvac_mode", "temperature"}; None = not taken
    )
    boiler_prev: dict[str, int | float | None] | None = None  # {"flow", "rods"}
    automation_disabled: bool = False
    load_taken: bool = False
    ac_taken: bool = False


@dataclass(frozen=True)
class Wants:
    boiler: bool
    load: bool
    ac: bool
    automation_consent: bool


def wants_for(enabled: bool, settings: Settings, consent: bool) -> Wants:
    def live(layer: Layer) -> bool:
        return enabled and settings.layers.get(layer) is LayerMode.ACTIVE

    return Wants(live(Layer.BOILER), live(Layer.LOAD), live(Layer.AC), consent)


def _system(code: str, **data: str) -> Reason:
    return Reason("system", code, data)


def _automation(entity_id: str, on: bool) -> Command:
    return Command("automation", "turn_on" if on else "turn_off", {"entity_id": entity_id})


def _give_back_thermostat(st: TakeoverState, view: StateView, entities: EntityMap) -> list[Command]:
    prev = st.thermostat_prev
    if prev is None or not is_available(view.get(entities.thermostat)):
        return []  # an unavailable thermostat keeps its saved settings for the next attempt
    st.thermostat_prev = None
    mode, temperature = prev.get("hvac_mode"), prev.get("temperature")
    if temperature is None:
        return [Command("climate", "set_hvac_mode", {"entity_id": entities.thermostat, "hvac_mode": mode})]
    return [
        Command(
            "climate",
            "set_temperature",
            {"entity_id": entities.thermostat, "temperature": temperature, "hvac_mode": mode},
        )
    ]


def _give_back_load(
    st: TakeoverState,
    wants: Wants,
    view: StateView,
    entities: EntityMap,
    ctrl: ControllerState,
    now: datetime,
) -> tuple[list[Command], list[Reason]]:
    cmds: list[Command] = []
    reasons: list[Reason] = []
    if st.automation_disabled and entities.overpower_automation is not None:
        cmds.append(_automation(entities.overpower_automation, True))
        reasons.append(_system("automation_restored"))
    st.automation_disabled = False
    load = ctrl.load
    if load.water_heater_shed and as_switch(view.get(entities.water_heater)) is not True:
        cmds += commands_for(Action(ActionKind.WATER_HEATER, True), entities, view)
        reasons.append(_system("water_heater_restored"))
    # The heat call and the rods belong to the load layer while it holds them. A live boiler layer
    # takes them over on its next tick; otherwise they go back to what the boiler had.
    if not wants.boiler:
        if load.call_paused and as_switch(view.get(entities.boiler_call)) is False:
            cmds += commands_for(Action(ActionKind.BOILER_CALL, True), entities, view)
        rods_now = as_float(view.get(entities.boiler_rods))
        # With boiler_prev set, the boiler hand-back right after restores the rods once.
        base = load.rods_base
        if base is not None and st.boiler_prev is None and rods_now is not None and int(rods_now) != base:
            cmds += commands_for(Action(ActionKind.BOILER_RODS, base), entities, view)
            register_write(ctrl.boiler, now, flow=False)
    ctrl.load = LoadState()
    st.load_taken = False
    return cmds, reasons


def _give_back_acs(
    st: TakeoverState, entities: EntityMap, view: StateView, ctrl: ControllerState
) -> tuple[list[Command], list[Reason]]:
    cmds: list[Command] = []
    released = sorted(ctrl.ac.owned | {r for r, on in ctrl.ac.quiet.items() if on})
    for room in sorted(ctrl.ac.owned):
        cmds += commands_for(Action(ActionKind.AC_HVAC, "off", room), entities, view)
        if ctrl.ac.quiet.get(room):
            cmds += commands_for(Action(ActionKind.AC_QUIET, False, room), entities, view)
    for room in sorted(r for r, on in ctrl.ac.quiet.items() if on and r not in ctrl.ac.owned):
        cmds += commands_for(Action(ActionKind.AC_QUIET, False, room), entities, view)
    ctrl.ac.owned = set()
    ctrl.ac.quiet = {}
    st.ac_taken = False
    if not released:
        return cmds, []
    return cmds, [_system("acs_released", rooms=",".join(r.value for r in released))]


def _give_back_boiler(
    st: TakeoverState,
    view: StateView,
    entities: EntityMap,
    ctrl: ControllerState,
    now: datetime,
    load_holds_rods: bool,
) -> tuple[list[Command], list[Reason]]:
    prev = st.boiler_prev
    boiler = view.get(entities.boiler_flow)
    if prev is None or not is_available(boiler):
        return [], []
    st.boiler_prev = None
    cmds: list[Command] = []
    flow_prev, flow_now = prev.get("flow"), attr_float(boiler, "temperature")
    if flow_prev is not None and (flow_now is None or abs(flow_now - flow_prev) >= FLOW_RESTORE_MIN_DELTA):
        cmds += commands_for(Action(ActionKind.BOILER_FLOW, flow_prev), entities, view)
        register_write(ctrl.boiler, now)
    rods_prev, rods_now = prev.get("rods"), as_float(view.get(entities.boiler_rods))
    if rods_prev is not None and load_holds_rods:
        ctrl.load.rods_base = int(rods_prev)  # the live load layer hands these back once nothing is shed
    elif rods_prev is not None and (rods_now is None or int(rods_now) != int(rods_prev)):
        cmds += commands_for(Action(ActionKind.BOILER_RODS, int(rods_prev)), entities, view)
        register_write(ctrl.boiler, now, flow=False)
    return cmds, [_system("boiler_settings_restored")]


def plan_takeover(
    st: TakeoverState,
    wants: Wants,
    view: StateView,
    entities: EntityMap,
    ctrl: ControllerState,
    now: datetime,
) -> tuple[list[Command], list[Reason]]:
    """Commands that bring the house in line with which layers are ACTIVE. Updates st and ctrl."""
    cmds: list[Command] = []
    reasons: list[Reason] = []

    # Give back first, so nothing runs twice while control changes hands.
    if not wants.boiler and st.thermostat_prev is not None:
        given = _give_back_thermostat(st, view, entities)
        if given:
            cmds += given
            reasons.append(_system("thermostat_restored"))
    if not wants.load and st.load_taken:
        c, r = _give_back_load(st, wants, view, entities, ctrl, now)
        cmds += c
        reasons += r
    if not wants.ac and st.ac_taken:
        c, r = _give_back_acs(st, entities, view, ctrl)
        cmds += c
        reasons += r
    if not wants.boiler and st.boiler_prev is not None:
        holds = wants.load and ctrl.load.rods_base is not None
        c, r = _give_back_boiler(st, view, entities, ctrl, now, holds)
        cmds += c
        reasons += r

    # Then take.
    thermostat = view.get(entities.thermostat)
    if wants.boiler and st.thermostat_prev is None and thermostat is not None and is_available(thermostat):
        st.thermostat_prev = {
            "hvac_mode": thermostat.state,
            "temperature": attr_float(thermostat, "temperature"),
        }
        if thermostat.state != "off":
            cmds.append(
                Command("climate", "set_hvac_mode", {"entity_id": entities.thermostat, "hvac_mode": "off"})
            )
        reasons.append(_system("thermostat_taken"))
    boiler = view.get(entities.boiler_flow)
    # Only the boiler layer writes the flow setpoint, so only it remembers the boiler. Rods the load
    # layer sheds go back through ControllerState.load.rods_base.
    if wants.boiler and st.boiler_prev is None and is_available(boiler):
        rods = as_float(view.get(entities.boiler_rods))
        st.boiler_prev = {
            "flow": attr_float(boiler, "temperature"),
            "rods": int(rods) if rods is not None else None,
        }
    if wants.load and not st.load_taken:
        st.load_taken = True
        automation = entities.overpower_automation
        if automation is not None and as_switch(view.get(automation)) is True:
            if wants.automation_consent:
                cmds.append(_automation(automation, False))
                st.automation_disabled = True
                reasons.append(_system("automation_disabled"))
            else:
                reasons.append(_system("automation_still_enabled"))
    if wants.ac:
        st.ac_taken = True
    return cmds, reasons


def is_user_override(old: str | None, new: str | None, own: bool) -> bool:
    """Someone else switched the entity on from off (not this module, not a reconnect)."""
    return not own and old == "off" and new not in (None, "off", "unavailable", "unknown")


def apply_user_override(st: TakeoverState, what: Literal["thermostat", "automation"]) -> Reason:
    if what == "thermostat":
        st.thermostat_prev = None
        return _system("thermostat_user_override")
    st.automation_disabled = False
    return _system("automation_user_override")
