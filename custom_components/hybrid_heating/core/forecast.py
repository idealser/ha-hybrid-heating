"""The hourly outdoor forecast the card turns into zones, energy and cost.

Hours are kept in UTC: a local clock repeats an hour when it falls back, absolute time does not.
"""

import math
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

HORIZON_H = 48


def _hour(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        at = datetime.fromisoformat(value)
    except ValueError:
        return None
    at = at.replace(tzinfo=UTC) if at.tzinfo is None else at.astimezone(UTC)
    return at.replace(minute=0, second=0, microsecond=0)


def _temperature(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return float(value)


def parse_hourly(
    items: Sequence[Mapping[str, Any]], now: datetime, horizon_h: int = HORIZON_H
) -> list[tuple[datetime, float]]:
    """(hour, °C) from the current hour on, sorted: past hours, gaps and repeats (the first wins) left out."""
    first = now.astimezone(UTC).replace(minute=0, second=0, microsecond=0)
    last = first + timedelta(hours=horizon_h)
    out: dict[datetime, float] = {}
    for it in items:
        at, t = _hour(it.get("datetime")), _temperature(it.get("temperature"))
        if at is not None and t is not None and first <= at < last and at not in out:
            out[at] = t
    return sorted(out.items())


def forecast_reply(
    points: Sequence[tuple[datetime, float]], source: str, updated: datetime
) -> dict[str, Any]:
    return {
        "source": source,
        "updated": updated.astimezone(UTC).isoformat(),
        "hours": [{"ts": at.isoformat(), "t_out": round(t, 1)} for at, t in points],
    }
