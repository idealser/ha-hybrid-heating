"""JSON round trip for settings and controller state, driven by the dataclass type hints."""

from __future__ import annotations

import dataclasses
from collections.abc import Mapping
from datetime import date, datetime, time
from enum import Enum
from types import MappingProxyType, NoneType, UnionType
from typing import Any, Literal, Union, cast, get_args, get_origin, get_type_hints

from .const import WINDOW_MAX_HOURS
from .core.context import validate_zones
from .core.controller import ControllerState
from .core.curve import validate_curve
from .core.types import Settings

TARGET_MIN = 5.0
TARGET_MAX = 30.0


def to_data(obj: Any) -> Any:
    """A JSON-compatible copy: dataclasses become dicts, enums their values, times ISO strings."""
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return {f.name: to_data(getattr(obj, f.name)) for f in dataclasses.fields(obj)}
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, (datetime, date, time)):
        return obj.isoformat()
    if isinstance(obj, (set, frozenset)):
        return sorted(to_data(x) for x in obj)
    if isinstance(obj, (tuple, list)):
        return [to_data(x) for x in obj]
    if isinstance(obj, Mapping):
        return {to_data(k): to_data(v) for k, v in obj.items()}
    return obj


def from_data[T](cls: type[T], data: Any, *, strict: bool = True) -> T:
    """Inverse of to_data. Missing keys take the field default; unknown keys raise in strict mode."""
    return cast(T, _decode(cls, data, strict, ""))


def _join(path: str, key: object) -> str:
    return f"{path}.{key}" if path else str(key)


def _fail(path: str, tp: Any, data: Any) -> ValueError:
    return ValueError(f"{path or 'value'}: expected {getattr(tp, '__name__', tp)}, got {data!r}")


def _decode(tp: Any, data: Any, strict: bool, path: str) -> Any:
    origin, args = get_origin(tp), get_args(tp)
    if origin in (Union, UnionType):
        if data is None and NoneType in args:
            return None
        options = [a for a in args if a is not NoneType]
        if len(options) == 1:
            return _decode(options[0], data, strict, path)  # keeps the inner error message
        for option in options:
            try:
                return _decode(option, data, strict, path)
            except ValueError:
                continue
        raise _fail(path, tp, data)
    if origin is Literal:
        if data in args:
            return data
        raise _fail(path, tp, data)
    if dataclasses.is_dataclass(tp):
        return _decode_dataclass(tp, data, strict, path)
    if isinstance(tp, type) and issubclass(tp, Enum):
        try:
            return tp(data)
        except ValueError, TypeError:
            raise _fail(path, tp, data) from None
    if tp is bool:
        if isinstance(data, bool):
            return data
        raise _fail(path, tp, data)
    if tp is int:
        if isinstance(data, int) and not isinstance(data, bool):
            return data
        raise _fail(path, tp, data)
    if tp is float:
        if isinstance(data, (int, float)) and not isinstance(data, bool):
            return float(data)
        raise _fail(path, tp, data)
    if tp is str:
        if isinstance(data, str):
            return data
        raise _fail(path, tp, data)
    if tp in (datetime, date, time):
        if not isinstance(data, str):
            raise _fail(path, tp, data)
        try:
            return tp.fromisoformat(data)
        except ValueError:
            raise _fail(path, tp, data) from None
    if origin is tuple:
        if not isinstance(data, (list, tuple)):
            raise _fail(path, tp, data)
        if len(args) == 2 and args[1] is Ellipsis:
            return tuple(_decode(args[0], x, strict, _join(path, i)) for i, x in enumerate(data))
        if len(data) != len(args):
            raise ValueError(f"{path or 'value'}: expected {len(args)} items, got {len(data)}")
        return tuple(
            _decode(a, x, strict, _join(path, i)) for i, (a, x) in enumerate(zip(args, data, strict=True))
        )
    if origin in (set, frozenset):
        if not isinstance(data, (list, tuple, set, frozenset)):
            raise _fail(path, tp, data)
        return origin(_decode(args[0], x, strict, _join(path, i)) for i, x in enumerate(data))
    if origin in (dict, Mapping):
        if not isinstance(data, Mapping):
            raise _fail(path, tp, data)
        items = {
            _decode(args[0], k, strict, _join(path, k)): _decode(args[1], v, strict, _join(path, k))
            for k, v in data.items()
        }
        return MappingProxyType(items) if origin is Mapping else items
    if tp is Any:
        return data
    raise TypeError(f"{path or 'value'}: unsupported type {tp!r}")


def _decode_dataclass(tp: Any, data: Any, strict: bool, path: str) -> Any:
    if not isinstance(data, Mapping):
        raise _fail(path, tp, data)
    fields = {f.name for f in dataclasses.fields(tp)}
    if strict:
        unknown = sorted(str(k) for k in data if k not in fields)
        if unknown:
            raise ValueError(f"unknown key: {_join(path, unknown[0])}")
    hints = get_type_hints(tp)
    return tp(
        **{
            name: _decode(hints[name], data[name], strict, _join(path, name))
            for name in fields
            if name in data
        }
    )


def validate_settings(s: Settings) -> None:
    validate_curve(s.curve)
    validate_zones(s.zones)
    for name in ("comfort", "eco", "night", "away"):
        value = getattr(s.targets, name)
        if not TARGET_MIN <= value <= TARGET_MAX:
            raise ValueError(f"targets.{name} must be within {TARGET_MIN}-{TARGET_MAX}, got {value}")
    if not s.load.restore_kw < s.load.limit_kw:
        raise ValueError(f"load.restore_kw {s.load.restore_kw} must be below load.limit_kw {s.load.limit_kw}")
    if not 1 <= s.season.window_hours <= WINDOW_MAX_HOURS:
        raise ValueError(
            f"season.window_hours must be within 1-{WINDOW_MAX_HOURS}, got {s.season.window_hours}"
        )


def _deep_merge(base: Mapping[str, Any], patch: Mapping[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in patch.items():
        current = out.get(key)
        if isinstance(value, Mapping) and isinstance(current, Mapping):
            out[key] = _deep_merge(current, value)
        else:
            out[key] = value  # lists (curve points, zone policies) are replaced whole
    return out


def merge_settings(current: Settings, patch: Mapping[str, Any]) -> Settings:
    """Apply a partial settings patch; raises ValueError if the result is not valid."""
    if not isinstance(patch, Mapping):
        raise ValueError(f"settings patch must be an object, got {patch!r}")
    merged = from_data(Settings, _deep_merge(to_data(current), patch), strict=True)
    validate_settings(merged)
    return merged


def restore_controller_state(data: Mapping[str, Any] | None, now: datetime) -> ControllerState:
    """State saved before a restart, minus the timers that only make sense while running."""
    if data is None:
        return ControllerState.initial(now)
    try:
        st = from_data(ControllerState, data, strict=False)
        for load in (st.load, st.shadow_load):
            if load.emergency_until is not None and load.emergency_until <= now:
                load.emergency_until = None
    except ValueError, TypeError:  # unreadable or from an incompatible version: start clean
        return ControllerState.initial(now)
    st.boiler.overheat_since = None
    st.last_tick_at = None
    for load in (st.load, st.shadow_load):
        load.over_since = None
        load.under_since = None
    for ac in (st.ac, st.shadow_ac):
        ac.fail_since = {}
    return st
