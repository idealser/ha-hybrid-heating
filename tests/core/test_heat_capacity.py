import math
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from custom_components.hybrid_heating.core.model import (
    HourTally,
    estimate_capacity,
    hour_of,
    update_hour_tally,
)
from custom_components.hybrid_heating.core.types import Room
from tests.conftest import TZ, snap

NOW = datetime(2026, 11, 9, 4, 30, tzinfo=TZ)
H, GAINS = 150.0, 300.0


def hour(t_in: float, t_out: float, ticks: int = 60, heat: int = 0) -> HourTally:
    return HourTally(ticks, heat, t_in * ticks, ticks, t_out * ticks, ticks)


def cooling(
    capacity: float, n: int, *, start: float = 22.6, end: datetime = NOW
) -> dict[datetime, HourTally]:
    """A flat that cools by the card's own model from `start`, n hours up to the hour before `end`."""
    first = hour_of(end) - timedelta(hours=n)
    out: dict[datetime, HourTally] = {}
    t = start
    for i in range(n):
        t_out = 11.0 + 3.0 * math.sin(i / 24 * 2 * math.pi)  # a day's swing
        out[first + timedelta(hours=i)] = hour(t, t_out)
        t -= (H * (t - t_out) - GAINS) / 1000 / capacity
    return out


def estimate(hours, **kw):
    return estimate_capacity(hours, NOW, h_w_per_k=H, gains_w=GAINS, **kw)


def test_the_capacity_of_a_flat_that_cools_by_the_model():
    e = estimate(cooling(20.0, 60))
    assert (e.status, e.hours_used, e.window_days, e.h_w_per_k, e.computed_at) == ("ok", 58, 14, H, NOW)
    assert e.kwh_per_k == pytest.approx(20.0, abs=0.2)
    assert e.cooled_k == pytest.approx(3.2, abs=0.1)
    assert estimate(cooling(5.2, 60, start=21.0)).kwh_per_k == pytest.approx(5.2, abs=0.2)


def test_hours_with_heat_and_the_hour_after_are_left_out():
    hours = cooling(20.0, 60)
    keys = sorted(hours)
    for k in keys[20:23]:
        hours[k] = replace(hours[k], heat_ticks=1)  # the boiler or an AC ran a minute
    hours[keys[40]] = replace(hours[keys[40]], ticks=30)  # Home Assistant was down half the hour
    e = estimate(hours)
    # 58 pairs, less: 19-20, 20-22 and the settling hour 23 (pairs 19, 20, 21, 22, 23); 39, 40 and 41
    assert e.status == "ok" and e.hours_used == 58 - 5 - 3
    assert e.kwh_per_k == pytest.approx(20.0, abs=0.3)


def test_warm_hours_the_unfinished_hour_and_old_hours_are_left_out():
    hours = cooling(20.0, 30)
    mild_from = hour_of(NOW) - timedelta(days=3)
    for i in range(30):  # an autumn afternoon: too close to the outdoor temperature to tell
        hours[mild_from + timedelta(hours=i)] = hour(22.0 - 0.01 * i, 18.0)
    old_from = hour_of(NOW) - timedelta(days=20)
    for i in range(30):
        hours[old_from + timedelta(hours=i)] = hour(22.0 - 0.5 * i, 0.0)  # older than the window
    hours[hour_of(NOW)] = hour(15.0, 11.0, ticks=30)  # this hour is not over
    e = estimate(hours)
    assert e.hours_used == 28 and e.kwh_per_k == pytest.approx(20.0, abs=0.3)


def test_insufficient_or_implausible():
    short = estimate(cooling(20.0, 20))
    assert (short.status, short.kwh_per_k, short.hours_used) == ("insufficient_data", None, 18)
    barely = estimate(cooling(200.0, 30))  # it hardly cooled: under 1° in all
    assert barely.status == "insufficient_data" and barely.cooled_k < 1.0
    sunny = {
        k: replace(t, t_in_sum=t.t_in_sum + 30 * i)
        for i, (k, t) in enumerate(sorted(cooling(20.0, 40).items()))
    }
    e = estimate(sunny, min_cooling_k=-100.0)  # the flat warmed up with nothing heating
    assert e.status == "implausible" and e.kwh_per_k is not None and e.kwh_per_k < 0


def test_hours_count_minutes_in_utc():
    hours: dict[datetime, HourTally] = {}
    first = datetime(2026, 10, 25, 2, 10, tzinfo=TZ)  # the local hour 02:00 repeats this night
    second = first.replace(fold=1)  # an hour later
    assert first.hour == second.hour == 2
    update_hour_tally(hours, snap(now=first))
    update_hour_tally(hours, snap(now=first + timedelta(minutes=1), t_out=None))
    update_hour_tally(hours, snap(now=second, boiler_call_on=None))  # unknown counts as heating
    update_hour_tally(hours, snap(now=second, ac_hvac={Room.LIVING: "heat", Room.BEDROOM: "off"}))
    update_hour_tally(hours, snap(now=second, rooms=dict.fromkeys(Room)))
    a, b = hours[datetime(2026, 10, 25, 0, 0, tzinfo=UTC)], hours[datetime(2026, 10, 25, 1, 0, tzinfo=UTC)]
    rooms_mean = (23.3 + 22.8 + 22.6 + 23.4) / 4
    assert (a.ticks, a.heat_ticks, a.t_in_n, a.t_out_n) == (2, 0, 2, 1)
    assert a.t_in_sum == pytest.approx(2 * rooms_mean) and a.t_out_sum == pytest.approx(13.8)
    assert (b.ticks, b.heat_ticks, b.t_in_n, b.t_out_n) == (3, 2, 2, 3)
