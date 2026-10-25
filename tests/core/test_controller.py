from dataclasses import replace
from datetime import timedelta
from types import MappingProxyType

import pytest

from custom_components.hybrid_heating.core.controller import ControllerState, tick
from custom_components.hybrid_heating.core.types import (
    ActionKind,
    Layer,
    LayerMode,
    Preset,
    Room,
    SeasonMode,
    SeasonSettings,
    Settings,
)
from tests.conftest import ALL_ACTIVE, T0, codes, snap, triples, with_layers

FROST = {Room.LIVING: 22.8, Room.BEDROOM: 22.6, Room.CHILD: 21.9, Room.BATH: 23.0}
active = ALL_ACTIVE


def test_now_scenario_acs_and_smooth_boiler():
    d = tick(active, snap(), ControllerState.initial(T0))
    assert d.zone == 0 and d.season_active and d.target == 23.0
    assert "season_started" in codes(d)
    assert (ActionKind.AC_HVAC, "heat", Room.LIVING) in triples(d)
    assert (ActionKind.AC_HVAC, "heat", Room.BEDROOM) in triples(d)
    assert (ActionKind.BOILER_CALL, True, None) in triples(d)
    assert 32.0 <= d.flow_target <= 36.0


def test_frost_scenario_three_rods():
    d = tick(active, snap(t_out=-8.0, rooms=FROST), ControllerState.initial(T0))
    assert d.zone == 2 and (ActionKind.BOILER_RODS, 3, None) in triples(d)


def test_observe_drops_actions_keeps_reasons():
    d = tick(Settings(), snap(), ControllerState.initial(T0))
    assert d.actions == () and d.reasons
    assert all(r.data.get("observe") for r in d.reasons if r.layer in Layer)


def test_observe_does_not_claim_acs_or_spend_budget():
    st = ControllerState.initial(T0)
    tick(Settings(), snap(), st)
    assert st.ac.owned == set() and st.boiler.writes_today == 0 and not st.load.water_heater_shed


def test_season_off():
    st = ControllerState.initial(T0)
    st.ac.owned = {Room.LIVING}
    d = tick(
        replace(active, season=SeasonSettings(mode=SeasonMode.OFF)),
        snap(boiler_call_on=True, ac_hvac={Room.LIVING: "heat", Room.BEDROOM: "off"}),
        st,
    )
    assert (ActionKind.BOILER_CALL, False, None) in triples(d)
    assert (ActionKind.AC_HVAC, "off", Room.LIVING) in triples(d)


def test_outdoor_missing_uses_last_then_fallback():
    st = ControllerState.initial(T0)
    tick(active, snap(), st)
    assert tick(active, snap(t_out=None, now=T0 + timedelta(hours=5)), st).zone == 0
    d = tick(active, snap(t_out=None, now=T0 + timedelta(hours=7)), st)
    assert d.flow_target == 50.0 and "outdoor_unavailable" in codes(d)


def test_all_rooms_missing_classic_fallback():
    d = tick(active, snap(rooms=dict.fromkeys(Room)), ControllerState.initial(T0))
    assert d.flow_target == 50.0 and "rooms_unavailable" in codes(d)
    assert (ActionKind.BOILER_CALL, True, None) in triples(d)


def test_boiler_unavailable_only_call():
    d = tick(
        active,
        snap(boiler_available=False, boiler_setpoint=None, boiler_rods_limit=None),
        ControllerState.initial(T0),
    )
    assert {a.kind for a in d.actions} & {ActionKind.BOILER_FLOW, ActionKind.BOILER_RODS} == set()
    assert (ActionKind.BOILER_CALL, True, None) in triples(d)


def test_hybrid_off_turns_owned_acs_off_and_uses_average():
    st = ControllerState.initial(T0)
    st.ac.owned = {Room.LIVING, Room.BEDROOM}
    d = tick(replace(active, hybrid=False), snap(ac_hvac={Room.LIVING: "heat", Room.BEDROOM: "heat"}), st)
    assert [a.value for a in d.actions if a.kind is ActionKind.AC_HVAC] == ["off", "off"]
    # average of rooms relative to their own targets: child 22.6 with offset -1 counts as 23.6
    assert any(
        r.code.startswith("smooth") and r.data.get("driver") == pytest.approx(23.233, abs=0.01)
        for r in d.reasons
    )


def test_flow_written_once_then_rate_limited():
    st = ControllerState.initial(T0)
    d1 = tick(active, snap(), st)
    flows = [a.value for a in d1.actions if a.kind is ActionKind.BOILER_FLOW]
    assert len(flows) == 1 and flows[0] == round(d1.flow_target)
    d2 = tick(active, snap(now=T0 + timedelta(minutes=5), boiler_setpoint=float(flows[0]) + 5), st)
    assert not [a for a in d2.actions if a.kind is ActionKind.BOILER_FLOW]


def test_emergency_drops_heat_call():
    st = ControllerState.initial(T0)
    st.load.water_heater_shed = True
    st.load.rods_shed = 1
    tick(active, snap(load_kw=9.5, water_heater_on=False, boiler_call_on=True), st)
    d = tick(
        active,
        snap(now=T0 + timedelta(seconds=5), load_kw=9.5, water_heater_on=False, boiler_call_on=True),
        st,
    )
    assert (ActionKind.BOILER_CALL, False, None) in triples(d) and "pause_boiler" in codes(d)


def test_observed_load_never_touches_boiler_but_reports():
    layers = MappingProxyType(
        {Layer.BOILER: LayerMode.ACTIVE, Layer.AC: LayerMode.ACTIVE, Layer.LOAD: LayerMode.OBSERVE}
    )
    s = replace(Settings(), layers=layers)
    st = ControllerState.initial(T0)
    seen: list[str] = []
    for t in (0, 5, 65, 125, 185):
        d = tick(
            s,
            snap(
                now=T0 + timedelta(seconds=t),
                t_out=-8.0,
                rooms=FROST,
                boiler_call_on=True,
                boiler_rods_limit=3,
                load_kw=9.5,
                water_heater_on=False,
            ),
            st,
        )
        assert (ActionKind.BOILER_CALL, False, None) not in triples(d)
        assert not [a for a in d.actions if a.kind is ActionKind.BOILER_RODS]
        seen += [r.code for r in d.reasons if r.data.get("observe")]
    assert "shed_rod" in seen and "pause_boiler" in seen
    assert st.load.rods_shed == 0 and st.load.emergency_until is None


def test_background_shift_follows_real_ac_state_not_observed_decisions():
    observe_acs = with_layers(ALL_ACTIVE, ac=LayerMode.OBSERVE)
    observed = tick(observe_acs, snap(t_out=5.0), ControllerState.initial(T0))
    live = tick(active, snap(t_out=5.0), ControllerState.initial(T0))
    assert observed.flow_target - live.flow_target == pytest.approx(3.0, abs=0.01)
    manual = tick(
        observe_acs,
        snap(t_out=5.0, ac_hvac={Room.LIVING: "heat", Room.BEDROOM: "off"}),
        ControllerState.initial(T0),
    )
    assert manual.flow_target == pytest.approx(live.flow_target, abs=0.01)


def test_no_background_shift_while_boiler_follows_coldest_room():
    d = tick(
        active, snap(), ControllerState.initial(T0)
    )  # zone 0: boiler on backup, follows the coldest room
    boiler = next(r for r in d.reasons if r.layer is Layer.BOILER)
    assert d.flow_target == pytest.approx(35.32 + boiler.data["correction"], abs=0.01)


def test_room_offsets_give_child_its_own_target():
    rooms = {Room.LIVING: 23.0, Room.BEDROOM: 23.0, Room.CHILD: 22.1, Room.BATH: 23.0}
    d = tick(active, snap(rooms=rooms), ControllerState.initial(T0))
    boiler = next(r for r in d.reasons if r.layer is Layer.BOILER)
    assert boiler.data["driver"] == pytest.approx(23.0)
    no_offsets = replace(active, room_offsets=MappingProxyType({}))
    d = tick(no_offsets, snap(rooms=rooms), ControllerState.initial(T0))
    boiler = next(r for r in d.reasons if r.layer is Layer.BOILER)
    assert boiler.data["driver"] == pytest.approx(22.1)


def test_ac_room_offset_moves_ac_target():
    s = replace(active, room_offsets=MappingProxyType({Room.LIVING: 1.0}))
    d = tick(s, snap(), ControllerState.initial(T0))
    assert (ActionKind.AC_SETPOINT, 25, Room.LIVING) in triples(d)
    assert (ActionKind.AC_SETPOINT, 24, Room.BEDROOM) in triples(d)


def _layers(boiler, ac, load):
    return with_layers(boiler=boiler, ac=ac, load=load)


def test_live_load_gives_back_what_it_took_while_boiler_is_observed():
    s = _layers(LayerMode.OBSERVE, LayerMode.ACTIVE, LayerMode.ACTIVE)
    st = ControllerState.initial(T0)
    over = {"load_kw": 9.0, "water_heater_on": False, "boiler_call_on": True, "boiler_rods_limit": 3}
    tick(s, snap(**over), st)
    d = tick(s, snap(now=T0 + timedelta(seconds=5), **over), st)
    assert (ActionKind.BOILER_CALL, False, None) in triples(d)
    assert (ActionKind.BOILER_RODS, 2, None) in triples(d)  # one less than what the boiler had, not the zone
    calm = {"load_kw": 3.0, "water_heater_on": False, "boiler_call_on": False, "boiler_rods_limit": 2}
    d = tick(s, snap(now=T0 + timedelta(seconds=30), **calm), st)
    assert (ActionKind.BOILER_CALL, True, None) in triples(d)  # pause over: heat call handed back
    calm["boiler_call_on"] = True
    tick(s, snap(now=T0 + timedelta(seconds=40), **calm), st)
    d = tick(s, snap(now=T0 + timedelta(seconds=640), **calm), st)
    assert (ActionKind.BOILER_RODS, 3, None) in triples(d)  # rods handed back
    calm["boiler_rods_limit"] = 3
    for t in (700, 1400, 2100):
        d = tick(s, snap(now=T0 + timedelta(seconds=t), **calm), st)
        assert not [a for a in d.actions if a.kind in (ActionKind.BOILER_RODS, ActionKind.BOILER_CALL)]


def test_rods_cut_is_written_during_the_pause_and_after_the_call_drop():
    st = ControllerState.initial(T0)
    over = {
        "t_out": -8.0,
        "rooms": FROST,
        "load_kw": 9.0,
        "water_heater_on": False,
        "boiler_call_on": True,
        "boiler_rods_limit": 3,
    }
    tick(active, snap(**over), st)
    d = tick(active, snap(now=T0 + timedelta(seconds=5), **over), st)
    kinds = [(a.kind, a.value) for a in d.actions]
    assert (ActionKind.BOILER_CALL, False) in kinds and (ActionKind.BOILER_RODS, 2) in kinds
    assert kinds.index((ActionKind.BOILER_CALL, False)) < kinds.index((ActionKind.BOILER_RODS, 2))


def test_pause_does_not_resend_call_off():
    st = ControllerState.initial(T0)
    over = {"load_kw": 9.0, "water_heater_on": False, "boiler_call_on": True}
    tick(active, snap(**over), st)
    tick(active, snap(now=T0 + timedelta(seconds=5), **over), st)
    over["boiler_call_on"] = False
    d = tick(active, snap(now=T0 + timedelta(seconds=10), **over), st)
    assert not [a for a in d.actions if a.kind is ActionKind.BOILER_CALL]


def test_manual_ac_hold_ends_when_the_preset_changes():
    st = ControllerState.initial(T0)
    st.ac.manual_hold = {Room.LIVING}
    d = tick(active, snap(), st)
    assert (ActionKind.AC_HVAC, "heat", Room.LIVING) not in triples(d)
    d = tick(replace(active, preset=Preset.ECO), snap(now=T0 + timedelta(minutes=1)), st)
    assert (ActionKind.AC_HVAC, "heat", Room.LIVING) in triples(d) and not st.ac.manual_hold


def test_unreadable_setpoint_does_not_burn_the_budget():
    st = ControllerState.initial(T0)
    writes = 0
    for minutes in range(0, 8 * 60, 10):
        d = tick(active, snap(now=T0 + timedelta(minutes=minutes), boiler_setpoint=None), st)
        writes += sum(1 for a in d.actions if a.kind is ActionKind.BOILER_FLOW)
    assert writes <= 3


def test_zone_does_not_flap_around_a_boundary():
    st = ControllerState.initial(T0)
    zones = [
        tick(
            active, snap(now=T0 + timedelta(minutes=10 * i), t_out=-2.9 if i % 2 else -3.1, rooms=FROST), st
        ).zone
        for i in range(12)
    ]
    assert set(zones) == {2}


def test_ac_night_mode_follows_the_clock_not_the_preset():
    night = T0.replace(hour=23)
    d = tick(replace(active, preset=Preset.ECO), snap(now=night), ControllerState.initial(night))
    assert (ActionKind.AC_QUIET, True, Room.BEDROOM) in triples(d)
    assert (ActionKind.AC_QUIET, True, Room.LIVING) not in triples(d)
