from dataclasses import replace
from datetime import date, datetime, timedelta

import pytest

from custom_components.hybrid_heating.core.controller import ControllerState, tick
from custom_components.hybrid_heating.core.learning import (
    MorningSample,
    Resolution,
    StaleSuggestion,
    TickSample,
    band_of,
    current_value,
    curve_suggestion,
    morning_sample,
    suggestion_patch,
    tick_sample,
)
from custom_components.hybrid_heating.core.types import CurveSettings, Layer, LayerMode, Room, Settings
from tests.conftest import ALL_ACTIVE, T0, TZ, snap, with_layers

D1, D2, D3 = date(2026, 11, 10), date(2026, 11, 11), date(2026, 11, 12)
NOW = datetime(2026, 11, 12, 9, 0, tzinfo=TZ)
LIVE_BOILER = with_layers(boiler=LayerMode.ACTIVE)


def ms(day, t_out, error, on_curve=True):
    return MorningSample(day=day, t_out=t_out, error=error, on_curve=on_curve, ticks=60)


COLD3 = [ms(D1, 4.1, -0.7), ms(D2, 5.6, -0.6), ms(D3, 6.8, -0.55)]


@pytest.mark.parametrize(
    ("t", "band"),
    [
        (7.2, 5),
        (7.6, 10),
        (2.5, 5),
        (2.4, 0),
        (-2.5, 0),
        (-2.6, -5),
        (-7.5, -5),
        (22.0, 20),
        (31.0, 20),
        (-26.0, -20),
    ],
)
def test_band_of_is_the_curve_point(t, band):
    assert band_of(t) == band


def test_three_cold_mornings_raise_the_band_point():
    sg = curve_suggestion(COLD3, Settings(), [], NOW)
    assert sg is not None
    assert (sg.key, sg.kind, sg.band, sg.room, sg.setting, sg.old, sg.new) == (
        "curve:5:up",
        "curve",
        5,
        None,
        "curve.points.5",
        44.5,
        46.0,
    )
    assert sg.evidence == {"mornings": 3, "mean_error": -0.62, "t_min": 4.1, "t_max": 6.8}
    assert sg.id == "curve:5:up@2026-11-12T09:00+01:00" and sg.created_at == NOW


def test_three_warm_mornings_lower_the_band_point():
    warm = [ms(D1, -1.5, 0.6), ms(D2, 0.5, 0.5), ms(D3, 2.0, 0.8)]
    sg = curve_suggestion(warm, Settings(), [], NOW)
    assert sg is not None and (sg.key, sg.old, sg.new) == ("curve:0:down", 49.5, 48.0)


@pytest.mark.parametrize(
    "mornings",
    [
        [ms(D1, 4.1, -0.7), ms(D2, 5.6, -0.4), ms(D3, 6.8, -0.55)],  # one morning was close enough
        [ms(D1, 4.1, -0.7), ms(D3, 6.8, -0.55)],  # a day missing breaks the series
        [ms(D1, 4.1, -0.7), ms(D2, 7.6, -0.6), ms(D3, 6.8, -0.55)],  # another band
        [ms(D1, 4.1, -0.7), ms(D2, 5.6, -0.6, on_curve=False), ms(D3, 6.8, -0.55)],
        [ms(date(2026, 11, 9), 4.1, -0.7), ms(D1, 4.1, -0.7), ms(D2, 5.6, -0.6)],  # not up to today
        [ms(D1, 4.1, -0.7), ms(D2, 5.6, 0.6), ms(D3, 6.8, -0.55)],  # mixed
    ],
)
def test_no_curve_suggestion(mornings):
    assert curve_suggestion(mornings, Settings(), [], NOW) is None


def test_exactly_half_a_degree_counts():
    edge = [ms(D1, 4.1, -0.5), ms(D2, 5.6, -0.5), ms(D3, 6.8, -0.5)]
    assert curve_suggestion(edge, Settings(), [], NOW) is not None


def test_curve_stays_monotonic_and_within_the_flow_limits():
    pts = tuple((t, 45.5 if t == 0 else f) for t, f in CurveSettings().points)
    assert (
        curve_suggestion(COLD3, replace(Settings(), curve=replace(CurveSettings(), points=pts)), [], NOW)
        is None
    )
    frost = [ms(D1, -18.0, -0.7), ms(D2, -19.0, -0.6), ms(D3, -21.0, -0.55)]
    assert curve_suggestion(frost, Settings(), [], NOW) is None  # -20 is at 66, above flow_max 65
    mild = [ms(D1, 19.0, 0.7), ms(D2, 21.0, 0.6), ms(D3, 23.0, 0.55)]
    low = replace(Settings(), curve=replace(CurveSettings(), flow_min=28.0))
    assert curve_suggestion(mild, low, [], NOW) is None  # +20 is at 28, the flow minimum


def test_a_dismissal_blocks_the_same_band_for_30_days():
    sg = curve_suggestion(COLD3, Settings(), [], NOW)
    assert sg is not None

    def dismissed(at, s=sg):
        return [Resolution(s, "dismissed", at)]

    assert curve_suggestion(COLD3, Settings(), dismissed(datetime(2026, 11, 1, 9, 0, tzinfo=TZ)), NOW) is None
    assert (
        curve_suggestion(COLD3, Settings(), dismissed(datetime(2026, 10, 12, 8, 0, tzinfo=TZ)), NOW)
        is not None
    )
    other_band = replace(sg, key="curve:10:up", band=10)
    assert (
        curve_suggestion(COLD3, Settings(), dismissed(NOW - timedelta(days=1), other_band), NOW) is not None
    )


def test_mornings_before_the_last_decision_are_not_counted_again():
    sg = curve_suggestion(COLD3, Settings(), [], NOW)
    assert sg is not None
    applied = [Resolution(sg, "applied", datetime(2026, 11, 11, 9, 30, tzinfo=TZ))]
    assert curve_suggestion(COLD3, Settings(), applied, NOW) is None


def test_patch_and_stale():
    sg = curve_suggestion(COLD3, Settings(), [], NOW)
    assert sg is not None
    patch = suggestion_patch(Settings(), sg)
    points = dict((t, f) for t, f in patch["curve"]["points"])
    assert points[5] == 46.0 and points[0] == 49.5 and len(points) == 9
    raised = replace(
        Settings(),
        curve=replace(CurveSettings(), points=tuple((t, points[t]) for t, _ in CurveSettings().points)),
    )
    assert current_value(raised, "curve.points.5") == 46.0
    with pytest.raises(StaleSuggestion):
        suggestion_patch(raised, sg)
    assert current_value(Settings(), "room_offsets.child") == -1.0
    assert current_value(Settings(), "room_offsets.living") == 0.0
    assert current_value(Settings(), "curve.shift") == 0.0
    bath = replace(sg, setting="curve.shift", old=0.0, new=1.0)
    assert suggestion_patch(Settings(), bath) == {"curve": {"shift": 1.0}}
    child = replace(sg, setting="room_offsets.child", old=-1.0, new=-0.7)
    assert suggestion_patch(Settings(), child) == {"room_offsets": {"child": -0.7}}
    with pytest.raises(ValueError):
        current_value(Settings(), "boiler.kp")


def at(minute: int) -> datetime:
    return datetime(2026, 11, 12, 8, minute, tzinfo=TZ)


def test_morning_sample_rules():
    ticks = [TickSample(at=at(m), t_out=6.8, driver=22.45, target=23.0, on_curve=True) for m in range(60)]
    assert morning_sample(D3, ticks) == MorningSample(day=D3, t_out=6.8, error=-0.55, on_curve=True, ticks=60)
    assert morning_sample(D3, ticks[:44]) is None  # a restart at 08:30
    assert (
        morning_sample(D3, ticks[:30] + [replace(t, target=22.5) for t in ticks[30:]]) is None
    )  # preset changed
    assert morning_sample(D3, [replace(t, t_out=None) if i < 20 else t for i, t in enumerate(ticks)]) is None
    off_curve = morning_sample(D3, [replace(t, on_curve=i >= 7) for i, t in enumerate(ticks)])
    assert off_curve is not None and off_curve.on_curve is False


def test_tick_sample_follows_the_boiler_decision():
    s = snap()
    st = ControllerState.initial(T0)
    d = tick(ALL_ACTIVE, s, st)
    ts = tick_sample(ALL_ACTIVE, s, d, st)
    assert ts is not None
    # the boiler follows the room furthest below its own target: the bedroom (the child's room is 1° cooler)
    assert (ts.at, ts.driver, ts.target, ts.t_out, ts.on_curve) == (T0, 22.8, 23.0, 13.8, True)


def test_off_the_curve():
    s = snap()
    st = ControllerState.initial(T0)
    d = tick(ALL_ACTIVE, s, st)
    st.load.rods_shed = 1
    assert tick_sample(ALL_ACTIVE, s, d, st).on_curve is False
    st2 = ControllerState.initial(T0)
    observed = Settings()  # the old thermostat runs the boiler: its flow is not the curve's
    assert tick_sample(observed, s, tick(observed, s, st2), st2).on_curve is False
    st3 = ControllerState.initial(T0)
    no_out = snap(t_out=None)
    sample = tick_sample(LIVE_BOILER, no_out, tick(LIVE_BOILER, no_out, st3), st3)
    assert sample is not None and sample.t_out is None and sample.on_curve is False
    assert LIVE_BOILER.layers[Layer.BOILER] is LayerMode.ACTIVE


def test_no_sample_without_a_boiler_decision():
    s = snap(rooms=dict.fromkeys(Room))
    st = ControllerState.initial(T0)
    assert tick_sample(ALL_ACTIVE, s, tick(ALL_ACTIVE, s, st), st) is None
