from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from custom_components.hybrid_heating.core.types import ActionKind, Decision, Reason, Room, Snapshot

TZ = ZoneInfo("Europe/Berlin")  # DST: 02:00-02:59 repeats on 2026-10-25
T0 = datetime(2026, 11, 1, 15, 0, tzinfo=TZ)
ROOMS = {Room.LIVING: 23.3, Room.BEDROOM: 22.8, Room.CHILD: 22.6, Room.BATH: 23.4}


def sec(n: float) -> timedelta:
    return timedelta(seconds=n)


def codes(x: Decision | Iterable[Reason]) -> list[str]:
    reasons = x.reasons if isinstance(x, Decision) else x
    return [r.code for r in reasons]


def triples(d: Decision) -> set[tuple[ActionKind, float | bool | str, Room | None]]:
    return {(a.kind, a.value, a.room) for a in d.actions}


def snap(**overrides) -> Snapshot:
    """The "now" scenario as the controller sees it; keyword arguments replace fields."""
    base = {
        "now": T0,
        "t_out": 13.8,
        "t_out_window_mean": 10.0,
        "rooms": ROOMS,
        "ac_available": {Room.LIVING: True, Room.BEDROOM: True},
        "ac_hvac": {Room.LIVING: "off", Room.BEDROOM: "off"},
        "ac_setpoint": {Room.LIVING: 24, Room.BEDROOM: 25},
        "boiler_available": True,
        "boiler_call_on": False,
        "boiler_setpoint": 50.0,
        "boiler_rods_limit": 2,
        "load_kw": 1.3,
        "water_heater_on": True,
    }
    base.update(overrides)
    return Snapshot(**base)
