from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from custom_components.hybrid_heating.core.types import ActionKind, Decision, Reason, Room

TZ = ZoneInfo("Europe/Berlin")  # DST: 02:00-02:59 repeats on 2026-10-25
T0 = datetime(2026, 11, 1, 15, 0, tzinfo=TZ)


def sec(n: float) -> timedelta:
    return timedelta(seconds=n)


def codes(x: Decision | Iterable[Reason]) -> list[str]:
    reasons = x.reasons if isinstance(x, Decision) else x
    return [r.code for r in reasons]


def triples(d: Decision) -> set[tuple[ActionKind, float | bool | str, Room | None]]:
    return {(a.kind, a.value, a.room) for a in d.actions}
