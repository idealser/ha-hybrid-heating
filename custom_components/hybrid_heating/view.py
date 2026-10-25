"""Reading Home Assistant states without importing Home Assistant: `hass.states` and a dict both fit."""

from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any, Protocol

UNAVAILABLE = frozenset({"unavailable", "unknown"})


class StateLike(Protocol):
    @property
    def state(self) -> str: ...

    @property
    def attributes(self) -> Mapping[str, Any]: ...


class StateView(Protocol):
    def get(self, entity_id: str, /) -> StateLike | None: ...


def is_available(s: StateLike | None) -> bool:
    return s is not None and s.state not in UNAVAILABLE


def _finite(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        x = float(value)
    except TypeError, ValueError:
        return None
    return x if math.isfinite(x) else None


def as_float(s: StateLike | None) -> float | None:
    return _finite(s.state) if s is not None and is_available(s) else None


def as_switch(s: StateLike | None) -> bool | None:
    if s is None:
        return None
    return {"on": True, "off": False}.get(s.state)


def power_kw(s: StateLike | None) -> float | None:
    """Power in kW from a sensor in W (or without a unit) or kW; any other unit is unreadable."""
    value = as_float(s)
    if s is None or value is None:
        return None
    unit = s.attributes.get("unit_of_measurement")
    if unit in (None, "W"):
        return value / 1000
    if unit == "kW":
        return value
    return None


def attr_float(s: StateLike | None, name: str) -> float | None:
    return _finite(s.attributes.get(name)) if s is not None and is_available(s) else None
