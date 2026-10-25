import json
import math
from datetime import UTC, datetime, timedelta

from custom_components.hybrid_heating.core.forecast import forecast_reply, parse_hourly
from tests.conftest import T0, TZ

NOW = T0 + timedelta(minutes=20)  # 15:20 local, 14:20 UTC


def item(when: str, t):
    return {"datetime": when, "temperature": t, "condition": "cloudy"}


def utc(h: int, day: int = 1) -> datetime:
    return datetime(2026, 11, day, h, 0, tzinfo=UTC)


def test_from_the_current_hour_without_repeats_or_gaps():
    items = [
        item("2026-11-01T13:00:00+00:00", 9.0),  # past
        item("2026-11-01T14:00:00+00:00", 9.5),  # the current hour stays
        item("2026-11-01T15:00:00+00:00", 9.1),
        item("2026-11-01T15:00:00+00:00", 8.0),  # a repeat: the first one wins
        item("2026-11-01T16:00:00+00:00", None),
        item("2026-11-01T17:00:00+00:00", "7"),
        item("2026-11-01T18:00:00+00:00", True),
        item("2026-11-01T19:00:00+00:00", math.nan),
        item("2026-11-01T22:00:00+02:00", 6.5),  # an offset other than UTC
        item("2026-11-01T21:00:00", 6.0),  # no offset: UTC
        {"temperature": 5.0},
        item("not a time", 5.0),
    ]
    assert parse_hourly(items, NOW) == [(utc(14), 9.5), (utc(15), 9.1), (utc(20), 6.5), (utc(21), 6.0)]


def test_hours_are_counted_in_absolute_time_across_dst():
    start = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)  # Berlin falls back on 25 October
    items = [item((start + timedelta(hours=i)).isoformat(), 5.0) for i in range(60)]
    points = parse_hourly(items, datetime(2026, 10, 24, 15, 0, tzinfo=TZ))
    assert len(points) == 48
    assert points[0][0] == datetime(2026, 10, 24, 13, 0, tzinfo=UTC)
    assert points[-1][0] - points[0][0] == timedelta(hours=47)


def test_unsorted_and_short_forecasts():
    items = [item(utc(h).isoformat(), float(h)) for h in (18, 14, 16)]
    assert parse_hourly(items, NOW) == [(utc(14), 14.0), (utc(16), 16.0), (utc(18), 18.0)]
    assert parse_hourly([], NOW) == []
    assert (
        len(parse_hourly([item((utc(14) + timedelta(hours=i)).isoformat(), 1.0) for i in range(90)], NOW))
        == 48
    )


def test_reply_is_what_the_card_reads():
    reply = forecast_reply([(utc(14), 9.46), (utc(15), 9.1)], "weather.home", NOW)
    assert reply == {
        "source": "weather.home",
        "updated": "2026-11-01T14:20:00+00:00",
        "hours": [
            {"ts": "2026-11-01T14:00:00+00:00", "t_out": 9.5},
            {"ts": "2026-11-01T15:00:00+00:00", "t_out": 9.1},
        ],
    }
    assert json.loads(json.dumps(reply)) == reply
