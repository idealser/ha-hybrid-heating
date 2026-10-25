"""Real-time arithmetic for timers.

Two datetimes that share a tzinfo subtract and compare as wall-clock times in Python, which is an
hour off across a DST change. Every timer in the core goes through these helpers instead.
"""

from datetime import UTC, datetime, timedelta


def elapsed_s(later: datetime, earlier: datetime) -> float:
    return later.timestamp() - earlier.timestamp()


def held(since: datetime | None, now: datetime, seconds: float) -> bool:
    return since is not None and elapsed_s(now, since) >= seconds


def after(t: datetime, seconds: float) -> datetime:
    return t.astimezone(UTC) + timedelta(seconds=seconds)


def before(now: datetime, until: datetime) -> bool:
    return now.timestamp() < until.timestamp()
