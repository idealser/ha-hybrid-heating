"""Small read-only questions about the controller state. No Home Assistant imports here."""

from __future__ import annotations

from datetime import datetime

from .core.controller import ControllerState
from .core.load import LoadState


def load_pending(st: LoadState, now: datetime) -> bool:
    """Above the limit, or a boiler pause still running: the load layer needs ticks seconds apart."""
    return st.over_since is not None or (st.emergency_until is not None and st.emergency_until > now)


def load_pending_any(ctrl: ControllerState, now: datetime) -> bool:
    """Also for the shadow state, so an observed overload shows in the log within seconds."""
    return load_pending(ctrl.load, now) or load_pending(ctrl.shadow_load, now)
