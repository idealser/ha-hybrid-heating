from __future__ import annotations

from dataclasses import replace
from types import MappingProxyType

import pytest

from custom_components.hybrid_heating.codec import from_data, to_data
from custom_components.hybrid_heating.commands import Command
from custom_components.hybrid_heating.core.controller import ControllerState
from custom_components.hybrid_heating.core.load import LoadState
from custom_components.hybrid_heating.core.types import Layer, LayerMode, Room, Settings
from custom_components.hybrid_heating.entity_map import EntityMap
from custom_components.hybrid_heating.takeover import (
    TakeoverState,
    Wants,
    apply_user_override,
    is_user_override,
    plan_reassert,
    plan_takeover,
    wants_for,
)
from tests.conftest import T0, codes
from tests.fakes import FAKE_ENTITIES, now_view, st

E = EntityMap.from_mapping(FAKE_ENTITIES)
NONE = Wants(False, False, False, False)
TH = "climate.thermostat"
AUT = "automation.overpower_throttle"
BOILER = "climate.boiler"
RODS = "number.boiler_max_rods"
CALL = "switch.boiler_heat_call"
WH = "switch.water_heater"


def test_take_thermostat_when_boiler_active():
    s, ctrl = TakeoverState(), ControllerState.initial(T0)
    cmds, rs = plan_takeover(s, Wants(True, False, False, False), now_view(), E, ctrl, T0)
    assert cmds == [Command("climate", "set_hvac_mode", {"entity_id": TH, "hvac_mode": "off"})]
    assert s.thermostat_prev == {"hvac_mode": "heat", "temperature": 22.5}
    assert s.boiler_prev == {"flow": 50.0, "rods": 2}
    assert codes(rs) == ["thermostat_taken"]


def test_thermostat_already_off_is_taken_without_command():
    s = TakeoverState()
    v = now_view() | {TH: st("off", temperature=21.0)}
    cmds, rs = plan_takeover(s, Wants(True, False, False, False), v, E, ControllerState.initial(T0), T0)
    assert cmds == [] and codes(rs) == ["thermostat_taken"]
    assert s.thermostat_prev == {"hvac_mode": "off", "temperature": 21.0}


def test_unavailable_thermostat_is_not_taken():
    s = TakeoverState()
    v = now_view() | {TH: st("unavailable")}
    assert plan_takeover(s, Wants(True, False, False, False), v, E, ControllerState.initial(T0), T0)[0] == []
    assert s.thermostat_prev is None


def test_observe_changes_nothing():
    s = TakeoverState()
    assert plan_takeover(s, NONE, now_view(), E, ControllerState.initial(T0), T0) == ([], [])
    assert s == TakeoverState()


def test_load_alone_does_not_remember_the_boiler():
    # Rods the load layer sheds go back through rods_base; the flow setpoint is never its business.
    s = TakeoverState()
    plan_takeover(s, Wants(False, True, False, True), now_view(), E, ControllerState.initial(T0), T0)
    assert s.boiler_prev is None and s.thermostat_prev is None


def test_boiler_leaving_while_load_holds_rods_restores_flow_and_moves_rods_to_load():
    s = TakeoverState(
        thermostat_prev={"hvac_mode": "heat", "temperature": 22.5},
        boiler_prev={"flow": 50.0, "rods": 3},
        load_taken=True,
    )
    ctrl = ControllerState.initial(T0)
    ctrl.load.rods_shed, ctrl.load.rods_base = 1, 2
    v = now_view() | {BOILER: st("heat", temperature=36, target_temp_step=1)}
    cmds, rs = plan_takeover(s, Wants(False, True, False, True), v, E, ctrl, T0)
    assert cmds == [
        Command("climate", "set_temperature", {"entity_id": TH, "temperature": 22.5, "hvac_mode": "heat"}),
        Command("climate", "set_temperature", {"entity_id": BOILER, "temperature": 50.0}),
    ]
    assert ctrl.load.rods_base == 3 and ctrl.boiler.writes_today == 1 and s.boiler_prev is None
    assert set(codes(rs)) == {"thermostat_restored", "boiler_settings_restored"}


def test_boiler_leaving_while_load_holds_nothing_restores_rods():
    s = TakeoverState(boiler_prev={"flow": 50.0, "rods": 3}, load_taken=True)
    ctrl = ControllerState.initial(T0)
    cmds, _ = plan_takeover(s, Wants(False, True, False, True), now_view(), E, ctrl, T0)
    assert cmds == [Command("number", "set_value", {"entity_id": RODS, "value": 3})]
    assert ctrl.load.rods_base is None


def test_already_taken_after_restart_keeps_prev():
    s = TakeoverState(
        thermostat_prev={"hvac_mode": "heat", "temperature": 22.5}, boiler_prev={"flow": 50.0, "rods": 3}
    )
    v = now_view() | {TH: st("off", temperature=22.5)}
    assert plan_takeover(s, Wants(True, False, False, False), v, E, ControllerState.initial(T0), T0) == (
        [],
        [],
    )
    assert s.thermostat_prev == {"hvac_mode": "heat", "temperature": 22.5}


def test_release_restores_thermostat_and_boiler_counting_writes():
    s = TakeoverState(
        thermostat_prev={"hvac_mode": "heat", "temperature": 22.5}, boiler_prev={"flow": 50.0, "rods": 3}
    )
    ctrl = ControllerState.initial(T0)
    v = now_view() | {BOILER: st("heat", temperature=36, target_temp_step=1, min_temp=20, max_temp=80)}
    cmds, rs = plan_takeover(s, NONE, v, E, ctrl, T0)
    assert cmds == [
        Command("climate", "set_temperature", {"entity_id": TH, "temperature": 22.5, "hvac_mode": "heat"}),
        Command("climate", "set_temperature", {"entity_id": BOILER, "temperature": 50.0}),
        Command("number", "set_value", {"entity_id": RODS, "value": 3}),
    ]
    assert ctrl.boiler.writes_today == 2 and s.thermostat_prev is None and s.boiler_prev is None
    assert set(codes(rs)) == {"thermostat_restored", "boiler_settings_restored"}


def test_release_skips_unchanged_boiler_values():
    s = TakeoverState(boiler_prev={"flow": 50.3, "rods": 2})
    ctrl = ControllerState.initial(T0)
    cmds, rs = plan_takeover(s, NONE, now_view(), E, ctrl, T0)
    assert cmds == [] and ctrl.boiler.writes_today == 0 and s.boiler_prev is None
    assert codes(rs) == ["boiler_settings_restored"]


def test_release_restores_off_if_it_was_off():
    s = TakeoverState(thermostat_prev={"hvac_mode": "off", "temperature": 21.0})
    v = now_view() | {TH: st("off", temperature=21.0)}
    cmds, _ = plan_takeover(s, NONE, v, E, ControllerState.initial(T0), T0)
    assert cmds == [
        Command("climate", "set_temperature", {"entity_id": TH, "temperature": 21.0, "hvac_mode": "off"})
    ]


def test_release_without_temperature_sets_mode_only():
    s = TakeoverState(thermostat_prev={"hvac_mode": "heat", "temperature": None})
    cmds, _ = plan_takeover(s, NONE, now_view(), E, ControllerState.initial(T0), T0)
    assert cmds == [Command("climate", "set_hvac_mode", {"entity_id": TH, "hvac_mode": "heat"})]


def test_unavailable_devices_keep_what_to_give_back():
    prev_t, prev_b = {"hvac_mode": "heat", "temperature": 22.5}, {"flow": 50.0, "rods": 3}
    s = TakeoverState(thermostat_prev=dict(prev_t), boiler_prev=dict(prev_b))
    v = now_view() | {TH: st("unavailable"), BOILER: st("unavailable")}
    assert plan_takeover(s, NONE, v, E, ControllerState.initial(T0), T0) == ([], [])
    assert s.thermostat_prev == prev_t and s.boiler_prev == prev_b


def test_automation_needs_consent_and_load_active():
    s = TakeoverState()
    cmds, rs = plan_takeover(
        s, Wants(False, True, False, False), now_view(), E, ControllerState.initial(T0), T0
    )
    assert cmds == [] and codes(rs) == ["automation_still_enabled"] and s.load_taken
    s = TakeoverState()
    cmds, rs = plan_takeover(
        s, Wants(False, True, False, True), now_view(), E, ControllerState.initial(T0), T0
    )
    assert cmds == [Command("automation", "turn_off", {"entity_id": AUT})] and s.automation_disabled
    assert codes(rs) == ["automation_disabled"]


def test_automation_already_off_or_not_configured():
    s = TakeoverState()
    v = now_view() | {AUT: st("off")}
    assert plan_takeover(s, Wants(False, True, False, True), v, E, ControllerState.initial(T0), T0) == (
        [],
        [],
    )
    assert s.load_taken and not s.automation_disabled
    no_aut = EntityMap.from_mapping({k: v for k, v in FAKE_ENTITIES.items() if k != "overpower_automation"})
    s = TakeoverState()
    assert plan_takeover(
        s, Wants(False, True, False, True), now_view(), no_aut, ControllerState.initial(T0), T0
    ) == (
        [],
        [],
    )


def test_load_release_restores_water_heater_and_automation():
    s, ctrl = TakeoverState(automation_disabled=True, load_taken=True), ControllerState.initial(T0)
    ctrl.load.water_heater_shed, ctrl.load.rods_shed = True, 1
    cmds, rs = plan_takeover(s, NONE, now_view() | {WH: st("off")}, E, ctrl, T0)
    assert Command("automation", "turn_on", {"entity_id": AUT}) in cmds
    assert Command("switch", "turn_on", {"entity_id": WH}) in cmds
    assert ctrl.load == LoadState() and not s.automation_disabled and not s.load_taken
    assert set(codes(rs)) == {"automation_restored", "water_heater_restored"}


def test_load_release_hands_back_rods_and_paused_call():
    s, ctrl = TakeoverState(load_taken=True), ControllerState.initial(T0)
    ctrl.load.rods_shed, ctrl.load.rods_base, ctrl.load.call_paused = 1, 3, True
    cmds, _ = plan_takeover(s, NONE, now_view(), E, ctrl, T0)
    assert cmds == [
        Command("switch", "turn_on", {"entity_id": CALL}),
        Command("number", "set_value", {"entity_id": RODS, "value": 3}),
    ]
    assert ctrl.boiler.writes_today == 1 and ctrl.load == LoadState()


def test_load_release_leaves_rods_and_call_to_a_live_boiler_layer():
    s, ctrl = (
        TakeoverState(load_taken=True, thermostat_prev={"hvac_mode": "heat", "temperature": 22.5}),
        (ControllerState.initial(T0)),
    )
    s.boiler_prev = {"flow": 50.0, "rods": 2}
    ctrl.load.rods_shed, ctrl.load.rods_base, ctrl.load.call_paused = 1, 3, True
    cmds, _ = plan_takeover(s, Wants(True, False, False, False), now_view(), E, ctrl, T0)
    assert cmds == [] and ctrl.load == LoadState() and ctrl.boiler.writes_today == 0


def test_load_and_boiler_released_together_restore_rods_once():
    s = TakeoverState(load_taken=True, boiler_prev={"flow": 50.0, "rods": 3})
    ctrl = ControllerState.initial(T0)
    ctrl.load.rods_shed, ctrl.load.rods_base = 1, 3
    cmds, _ = plan_takeover(s, NONE, now_view(), E, ctrl, T0)
    assert [c for c in cmds if c.domain == "number"] == [
        Command("number", "set_value", {"entity_id": RODS, "value": 3})
    ]
    assert ctrl.boiler.writes_today == 1


def test_ac_release_turns_off_owned_only():
    s, ctrl = TakeoverState(ac_taken=True), ControllerState.initial(T0)
    ctrl.ac.owned = {Room.LIVING}
    cmds, rs = plan_takeover(s, NONE, now_view(), E, ctrl, T0)
    assert cmds == [
        Command("climate", "set_hvac_mode", {"entity_id": "climate.living_ac", "hvac_mode": "off"})
    ]
    assert ctrl.ac.owned == set() and codes(rs) == ["acs_released"] and not s.ac_taken
    assert rs[0].data["rooms"] == "living"


def test_ac_release_turns_quiet_off():
    s, ctrl = TakeoverState(ac_taken=True), ControllerState.initial(T0)
    ctrl.ac.owned = {Room.BEDROOM}
    ctrl.ac.quiet = {Room.BEDROOM: True, Room.LIVING: False}
    cmds, _ = plan_takeover(s, NONE, now_view(), E, ctrl, T0)
    assert [(c.service, c.entity_id) for c in cmds] == [
        ("set_hvac_mode", "climate.bedroom_ac"),
        ("turn_off", "switch.bedroom_ac_quiet"),
        ("set_fan_mode", "climate.bedroom_ac"),
    ]
    assert ctrl.ac.quiet == {}


def test_ac_becomes_active():
    s = TakeoverState()
    assert plan_takeover(
        s, Wants(False, False, True, False), now_view(), E, ControllerState.initial(T0), T0
    ) == (
        [],
        [],
    )
    assert s.ac_taken


def test_wants_for_needs_enabled_and_active_layer():
    active = replace(
        Settings(), layers=MappingProxyType({**Settings().layers, Layer.BOILER: LayerMode.ACTIVE})
    )
    assert wants_for(True, active, True) == Wants(True, False, False, True)
    assert wants_for(False, active, True) == Wants(False, False, False, True)
    assert wants_for(True, Settings(), False) == NONE


def test_state_round_trip():
    s = TakeoverState(
        thermostat_prev={"hvac_mode": "heat", "temperature": 22.5},
        boiler_prev={"flow": 50.0, "rods": 2},
        automation_disabled=True,
        load_taken=True,
    )
    assert from_data(TakeoverState, to_data(s)) == s


def test_apply_user_override():
    s = TakeoverState(thermostat_prev={"hvac_mode": "heat", "temperature": 22.5}, automation_disabled=True)
    assert (
        apply_user_override(s, "thermostat").code == "thermostat_user_override" and s.thermostat_prev is None
    )
    assert (
        apply_user_override(s, "automation").code == "automation_user_override" and not s.automation_disabled
    )


@pytest.mark.parametrize(
    ("old", "new", "own", "res"),
    [
        ("off", "heat", False, True),
        ("off", "on", False, True),
        ("off", "heat", True, False),
        (None, "off", False, False),
        ("unavailable", "heat", False, False),
        ("off", "unavailable", False, False),
        ("heat", "off", False, False),
    ],
)
def test_is_user_override(old, new, own, res):
    assert is_user_override(old, new, own) is res


def test_reassert_switches_a_held_thermostat_off_again():
    prev = {"hvac_mode": "heat", "temperature": 21.5}
    s = TakeoverState(thermostat_prev=dict(prev))
    cmds, rs = plan_reassert(s, Wants(True, False, False, False), now_view(), E)
    assert cmds == [Command("climate", "set_hvac_mode", {"entity_id": TH, "hvac_mode": "off"})]
    assert codes(rs) == ["thermostat_reasserted"] and s.thermostat_prev == prev
    off = now_view() | {TH: st("off")}
    assert plan_reassert(s, Wants(True, False, False, False), off, E) == ([], [])
    assert plan_reassert(TakeoverState(), Wants(True, False, False, False), now_view(), E) == ([], [])
    assert plan_reassert(s, NONE, now_view(), E) == ([], [])
