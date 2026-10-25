from __future__ import annotations

import pytest

from custom_components.hybrid_heating.core.types import Room, Settings
from custom_components.hybrid_heating.entity_map import EntityMap
from custom_components.hybrid_heating.snapshot import build_snapshot
from tests.conftest import T0
from tests.fakes import FAKE_ENTITIES, now_view, st

E = EntityMap.from_mapping(FAKE_ENTITIES)


def test_now_scenario_snapshot():
    snap = build_snapshot(now_view(), E, T0, 10.0)
    assert snap.now == T0 and snap.t_out == 13.8 and snap.t_out_window_mean == 10.0
    assert snap.rooms == {Room.LIVING: 23.3, Room.BEDROOM: 22.8, Room.CHILD: 22.6, Room.BATH: 23.4}
    assert snap.ac_available == {Room.LIVING: True, Room.BEDROOM: True}
    assert (
        snap.ac_hvac == {Room.LIVING: "off", Room.BEDROOM: "off"} and snap.ac_setpoint[Room.BEDROOM] == 25.0
    )
    assert (snap.boiler_available, snap.boiler_call_on, snap.boiler_setpoint, snap.boiler_rods_limit) == (
        True,
        False,
        50.0,
        2,
    )
    assert snap.load_kw == pytest.approx(1.3) and snap.water_heater_on is True


def test_dirty_states():
    v = now_view() | {
        "sensor.living_temperature": st("unavailable"),
        "sensor.outdoor_temperature": st("nan"),
        "sensor.bedroom_temperature": st(""),
        "number.boiler_max_rods": st("2.0"),
        "sensor.mains_power": st("1.3", unit_of_measurement="kW"),
        "climate.living_ac": st("unavailable"),
        "switch.boiler_heat_call": st("unknown"),
        "climate.boiler": st("unavailable"),
    }
    del v["switch.water_heater"]
    snap = build_snapshot(v, E, T0, None)
    assert snap.rooms[Room.LIVING] is None and snap.rooms[Room.BEDROOM] is None and snap.t_out is None
    assert snap.boiler_rods_limit == 2 and snap.load_kw == pytest.approx(1.3)
    assert snap.ac_available[Room.LIVING] is False and snap.ac_hvac[Room.LIVING] is None
    assert snap.ac_setpoint[Room.LIVING] is None
    assert snap.boiler_call_on is None and snap.water_heater_on is None
    assert snap.boiler_available is False and snap.boiler_setpoint is None


def test_missing_rods_entity_gives_none():
    v = now_view()
    del v["number.boiler_max_rods"]
    assert build_snapshot(v, E, T0, None).boiler_rods_limit is None


def test_sensor_offsets_correct_room_readings():
    v = now_view() | {"sensor.bedroom_temperature": st("unavailable")}
    snap = build_snapshot(v, E, T0, None, {Room.CHILD: 0.3, Room.BEDROOM: -0.2})
    assert snap.rooms[Room.CHILD] == pytest.approx(22.9) and snap.rooms[Room.LIVING] == 23.3
    assert snap.rooms[Room.BEDROOM] is None


def test_settings_have_no_sensor_offsets_by_default():
    assert dict(Settings().sensor_offsets) == {}
