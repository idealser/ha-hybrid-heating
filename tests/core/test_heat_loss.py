from dataclasses import replace
from datetime import date, datetime, timedelta

import pytest

from custom_components.hybrid_heating.core.controller import ControllerState, tick
from custom_components.hybrid_heating.core.model import (
    DayStats,
    DayTally,
    day_stats,
    estimate_heat_loss,
    update_tally,
)
from custom_components.hybrid_heating.core.types import Room
from tests.conftest import ALL_ACTIVE, T0, TZ, snap

NOW = datetime(2026, 11, 9, 4, 30, tzinfo=TZ)


def day(d, dt, w, ticks=1440, ac=0, season=1440):
    return DayStats(day=d, boiler_w=w, t_out=23.0 - dt, t_in=23.0, tally=DayTally(ticks, ac, season))


BASE = [
    day(date(2026, 11, i + 1), dt, w)
    for i, (dt, w) in enumerate([(6, 600), (8, 900), (10, 1200), (12, 1500), (14, 1900)])
]


def test_regression_values():
    e = estimate_heat_loss(BASE, NOW)
    assert (e.status, e.days_used, e.window_days, e.computed_at) == ("ok", 5, 28, NOW)
    assert e.w_per_k == pytest.approx(160.0) and e.gains_w == pytest.approx(380.0)
    assert e.r2 == pytest.approx(0.9961, abs=1e-4)


def test_bad_days_are_left_out():
    bad = [
        day(date(2026, 11, 6), 9, 4000, ac=200),  # the ACs heated: their heat is not metered
        day(date(2026, 11, 7), 9, 307000 / 24),  # corrupt statistics
        day(date(2026, 11, 8), 3, 200),  # too mild to tell gains from losses
        replace(day(date(2026, 10, 30), 9, 1000), tally=None),  # before the module ran
        day(date(2026, 10, 31), 9, 1000, ticks=900),  # Home Assistant was down for hours
        day(date(2026, 10, 29), 9, 1000, season=600),  # out of season most of the day
        replace(day(date(2026, 10, 28), 9, 1000), t_in=None),
        day(date(2026, 10, 1), 9, 1000),  # older than the window
        day(date(2026, 11, 9), 9, 1000),  # today is not over
    ]
    e = estimate_heat_loss(BASE + bad, NOW)
    assert e.days_used == 5 and e.w_per_k == pytest.approx(160.0)


def test_insufficient_or_implausible():
    short = estimate_heat_loss(BASE[:4], NOW)
    assert (short.status, short.w_per_k, short.gains_w, short.r2, short.days_used) == (
        "insufficient_data",
        None,
        None,
        None,
        4,
    )
    narrow = [day(date(2026, 11, i + 1), 10 + i * 0.5, 1200) for i in range(6)]
    assert estimate_heat_loss(narrow, NOW).status == "insufficient_data"
    weird = [day(date(2026, 11, i + 1), dt, 20 * dt + 500) for i, dt in enumerate([6, 8, 10, 12, 14])]
    e = estimate_heat_loss(weird, NOW)
    assert e.status == "implausible" and e.w_per_k == pytest.approx(20.0)


def test_day_stats_from_daily_statistics_rows():
    def ts(d):
        return datetime(2026, 11, d, 0, 0, tzinfo=TZ).timestamp()

    rows = {
        "sensor.boiler": [{"start": ts(1), "mean": 1200.0}, {"start": ts(2), "mean": None}],
        "sensor.out": [{"start": ts(1), "mean": 13.0}, {"start": ts(2), "mean": 12.0}],
        "sensor.l": [{"start": ts(1), "mean": 23.2}],
        "sensor.c": [{"start": ts(1), "mean": 22.8}],
    }
    days = day_stats(
        rows,
        boiler_id="sensor.boiler",
        outdoor_id="sensor.out",
        room_ids=["sensor.l", "sensor.c", "sensor.missing"],
        tallies={date(2026, 11, 1): DayTally(1440, 0, 1440)},
        tz=TZ,
    )
    assert days[0] == DayStats(date(2026, 11, 1), 1200.0, 13.0, 23.0, DayTally(1440, 0, 1440))
    assert (days[1].day, days[1].boiler_w, days[1].t_in, days[1].tally) == (
        date(2026, 11, 2),
        None,
        None,
        None,
    )
    assert day_stats({}, boiler_id="b", outdoor_id="o", room_ids=[], tallies={}, tz=TZ) == []


def test_tallies_count_ticks_ac_heating_and_season_per_local_day():
    tallies: dict[date, DayTally] = {}
    heating = snap(ac_hvac={Room.LIVING: "heat", Room.BEDROOM: "off"})
    d = tick(ALL_ACTIVE, heating, ControllerState.initial(T0))
    update_tally(tallies, heating, d)
    update_tally(tallies, snap(now=T0 + timedelta(minutes=1)), d)
    late = T0.replace(hour=23, minute=59) + timedelta(minutes=2)  # past midnight: the next day
    update_tally(tallies, snap(now=late), replace(d, season_active=False))
    assert tallies == {
        date(2026, 11, 1): DayTally(ticks=2, ac_heat_ticks=1, season_ticks=2),
        date(2026, 11, 2): DayTally(ticks=1, ac_heat_ticks=0, season_ticks=0),
    }


def test_a_stuck_power_sensor_day_is_left_out():
    stuck = [day(date(2026, 11, 6), 9, 0.0), day(date(2026, 11, 7), 11, 0.0)]
    e = estimate_heat_loss(BASE + stuck, NOW)
    assert (e.status, e.days_used) == ("ok", 5) and e.w_per_k == pytest.approx(160.0)


def test_a_poor_fit_is_implausible():
    scattered = [
        day(date(2026, 11, i + 1), dt, w)
        for i, (dt, w) in enumerate([(6, 1500), (8, 300), (10, 2200), (12, 600), (14, 2000)])
    ]
    e = estimate_heat_loss(scattered, NOW)
    assert e.status == "implausible" and e.r2 is not None and e.r2 < 0.6
    negative_gains = [
        day(date(2026, 11, i + 1), dt, 150 * dt + 2000) for i, dt in enumerate([6, 8, 10, 12, 14])
    ]
    e = estimate_heat_loss(negative_gains, NOW)
    assert (
        e.status == "implausible"
        and e.w_per_k == pytest.approx(150.0)
        and e.gains_w == pytest.approx(-2000.0)
    )
