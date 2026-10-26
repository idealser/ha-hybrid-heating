import json

import pytest

from custom_components.hybrid_heating.codec import (
    from_data,
    merge_settings,
    restore_controller_state,
    settings_from_saved,
    to_data,
    validate_settings,
)
from custom_components.hybrid_heating.core.controller import ControllerState
from custom_components.hybrid_heating.core.curve import CURVE_OUTDOOR_POINTS
from custom_components.hybrid_heating.core.types import (
    CurveSettings,
    Layer,
    LayerMode,
    Preset,
    Room,
    Settings,
)
from tests.conftest import T0, sec


def test_settings_round_trip_and_json():
    s = Settings()
    assert from_data(Settings, to_data(s)) == s
    json.dumps(to_data(s))


def test_settings_json_shape():
    d = to_data(Settings())
    assert d["layers"] == {"boiler": "observe", "ac": "observe", "load": "observe"}
    assert d["targets"]["night_start"] == "22:00:00"
    assert [p[0] for p in d["curve"]["points"]] == list(CURVE_OUTDOOR_POINTS)
    assert [p[1] for p in d["curve"]["points"]] == [28.0, 34.0, 39.5, 44.5, 49.5, 54.0, 58.0, 62.0, 66.0]
    assert d["zones"]["policies"][3]["ac_rooms"] == []
    assert d["zones"]["policies"][0]["ac_rooms"] == ["bedroom", "living"]
    assert d["ac"]["night"] == {"living": "day", "bedroom": "quiet"}
    assert d["room_offsets"] == {"child": -1.0}


def test_merge_replaces_whole_curve():
    pts = [[t, f + 1.0] for t, f in to_data(Settings())["curve"]["points"]]
    assert merge_settings(Settings(), {"curve": {"points": pts}}).curve.points[4] == (0, 50.5)


def test_merge_settings_deep_patch():
    s = merge_settings(Settings(), {"targets": {"comfort": 23.5}, "layers": {"boiler": "active"}})
    assert s.targets.comfort == 23.5 and s.targets.eco == 21.5
    assert s.layers[Layer.BOILER] is LayerMode.ACTIVE and s.layers[Layer.LOAD] is LayerMode.OBSERVE


def test_merge_accepts_int_for_float_and_returns_float():
    s = merge_settings(Settings(), {"targets": {"comfort": 24}})
    assert s.targets.comfort == 24.0 and isinstance(s.targets.comfort, float)


@pytest.mark.parametrize(
    "patch",
    [
        {"curve": {"foo": 1}},
        {"curve": {"flow_min": 70}},
        {"layers": {"boiler": "turbo"}},
        {"curve": {"points": [[20, 29.0], [10, 39.5], [0, 50.0], [-10, 60.5], [-20, 71.0]]}},
        {"targets": {"comfort": "warm"}},
        {"targets": {"comfort": 31.0}},
        {"targets": {"away": 4.9}},
        {"season": {"window_hours": 100}},
        {"season": {"window_hours": 0}},
        {"load": {"restore_kw": 9.0}},
        {"zones": {"bounds": [8, 9, -15]}},
        {"zones": {"bounds": [8, -3]}},
        {"zones": {"policies": [{"ac_rooms": ["kitchen"], "boiler": "main", "max_rods": 2}] * 4}},
        {"hybrid": 1},
        {"targets": {"night_start": "25:00"}},
        {"curve": 5},
        {"future_key": 1},
        {"sensor_offsets": {"child": 5.5}},
        {"sensor_offsets": {"kitchen": 0.3}},
    ],
)
def test_merge_rejects_bad_patch(patch):
    with pytest.raises(ValueError):
        merge_settings(Settings(), patch)


def test_merge_sets_sensor_offsets():
    s = merge_settings(Settings(), {"sensor_offsets": {"child": 0.3}})
    assert dict(s.sensor_offsets) == {Room.CHILD: 0.3}
    assert to_data(s)["sensor_offsets"] == {"child": 0.3}


def test_saved_settings_fill_missing_keys_from_defaults():
    s = settings_from_saved({"layers": {"boiler": "active"}, "targets": {"eco": 21.0}, "from_the_future": 1})
    assert s.layers == {
        Layer.BOILER: LayerMode.ACTIVE,
        Layer.AC: LayerMode.OBSERVE,
        Layer.LOAD: LayerMode.OBSERVE,
    }
    assert s.targets.eco == 21.0 and s.targets.comfort == 23.0


@pytest.mark.parametrize("data", [{"layers": {"boiler": "turbo"}}, {"targets": {"comfort": 40.0}}, "junk"])
def test_saved_settings_reject_bad_values(data):
    with pytest.raises(ValueError):
        settings_from_saved(data)


def test_validate_rejects_missing_layer():
    with pytest.raises(ValueError, match="layers"):
        validate_settings(from_data(Settings, {"layers": {"boiler": "active"}}))


def test_unknown_key_error_names_the_path():
    with pytest.raises(ValueError, match=r"unknown key: curve\.foo"):
        merge_settings(Settings(), {"curve": {"foo": 1}})


def test_controller_state_round_trip():
    st = ControllerState.initial(T0)
    st.boiler.integral, st.boiler.writes_today, st.boiler.writes_day = 0.4, 7, T0.date()
    st.boiler.last_write_at, st.boiler.last_flow_written = T0, 47.0
    st.ac.owned = {Room.LIVING}
    st.ac.last_step_at = {Room.LIVING: T0}
    st.ac.manual_hold = {Room.BEDROOM}
    st.load.rods_shed, st.load.water_heater_shed, st.load.rods_base = 1, True, 2
    st.shadow_ac.owned = {Room.LIVING, Room.BEDROOM}
    st.shadow_load.water_heater_shed = True
    st.last_flow, st.last_preset, st.last_zone, st.last_hybrid = 33.1, Preset.ECO, 1, True
    assert from_data(ControllerState, to_data(st)) == st
    assert to_data(st)["shadow_ac"]["owned"] == ["bedroom", "living"]
    json.dumps(to_data(st))


def test_restore_drops_transient_timers():
    st = ControllerState.initial(T0)
    st.boiler.integral, st.boiler.writes_today, st.boiler.overheat_since = 0.4, 7, T0
    st.load.over_since, st.load.under_since = T0, T0
    st.load.rods_shed, st.load.emergency_until, st.load.call_paused = 1, T0 - sec(1), True
    st.ac.fail_since = {Room.LIVING: T0}
    st.ac.owned = {Room.LIVING}
    st.last_tick_at, st.last_flow = T0, 41.0
    st.shadow_load.over_since, st.shadow_load.rods_shed = T0, 2
    st.shadow_load.emergency_until = T0
    st.shadow_ac.owned, st.shadow_ac.fail_since = {Room.BEDROOM}, {Room.BEDROOM: T0}
    r = restore_controller_state(to_data(st), T0 + sec(120))
    assert (r.boiler.integral, r.boiler.writes_today, r.load.rods_shed) == (0.4, 7, 1)
    assert r.boiler.overheat_since is None and r.load.over_since is None and r.load.under_since is None
    assert r.load.emergency_until is None and r.load.call_paused is True  # the call is handed back next tick
    assert r.ac.fail_since == {} and r.ac.owned == {Room.LIVING} and r.last_tick_at is None
    assert r.last_flow == 41.0
    assert r.shadow_load.over_since is None and r.shadow_load.rods_shed == 2
    assert r.shadow_load.emergency_until is None
    assert r.shadow_ac.owned == {Room.BEDROOM} and r.shadow_ac.fail_since == {}


def test_restore_keeps_future_emergency():
    st = ControllerState.initial(T0)
    st.load.emergency_until = T0 + sec(20)
    assert restore_controller_state(to_data(st), T0).load.emergency_until == T0 + sec(20)


@pytest.mark.parametrize("garbage", [{"boiler": "garbage"}, None, {"boiler": {"integral": "x"}}])
def test_restore_rejects_garbage(garbage):
    with pytest.raises(ValueError):  # the store resets the section and reports it
        restore_controller_state(garbage, T0)


def test_restore_ignores_unknown_keys_from_a_newer_version():
    data = to_data(ControllerState.initial(T0))
    data["boiler"]["integral"] = 0.25
    data["future"] = {"x": 1}
    data["boiler"]["future"] = 1
    assert restore_controller_state(data, T0).boiler.integral == 0.25


def test_lenient_ignores_unknown_and_fills_missing():
    s = from_data(Settings, {"preset": "eco", "future_key": 1}, strict=False)
    assert s.preset is Preset.ECO and s.curve == CurveSettings()


def test_strict_rejects_bool_in_number_field():
    with pytest.raises(ValueError):
        from_data(CurveSettings, {"shift": True})


def test_learning_data_round_trip_and_defaults():
    from datetime import UTC, date, datetime, timedelta

    from custom_components.hybrid_heating.core.learning import LearningData, Resolution, curve_suggestion
    from custom_components.hybrid_heating.core.model import (
        CapacityEstimate,
        DayTally,
        HeatLossEstimate,
        HourTally,
    )
    from tests.core.test_learning import COLD3, NOW, NOWF, mk

    sg = curve_suggestion(COLD3, Settings(), [], NOW)
    assert sg is not None
    data = LearningData(
        marks=[mk(Room.CHILD, "cold", NOWF), mk(Room.LIVING, "hot", NOWF, t_out=None)],
        mornings=list(COLD3),
        pending=[sg],
        resolutions=[Resolution(sg, "dismissed", NOWF + timedelta(hours=1))],
        tallies={date(2026, 11, 1): DayTally(1440, 0, 1440)},
        heat_loss=HeatLossEstimate("ok", 148.0, 310.0, 0.91, 9, 28, NOW),
        hours={datetime(2026, 11, 1, 14, 0, tzinfo=UTC): HourTally(60, 0, 1371.0, 60, 828.0, 60)},
        capacity=CapacityEstimate("ok", 23.3, 53, 2.28, 150.0, 14, NOW),
    )
    raw = to_data(data)
    assert json.loads(json.dumps(raw)) == raw
    back = from_data(LearningData, raw)
    assert back == data and back.pending[0].evidence["mornings"] == 3 and type(back.marks) is list
    assert from_data(LearningData, {}) == LearningData()
    with pytest.raises(ValueError):
        from_data(LearningData, {"marks": {"not": "a list"}})
    with pytest.raises(ValueError):
        from_data(LearningData, {"pending": [{**raw["pending"][0], "kind": "other"}]})
