"""Small read-only questions about the controller state. No Home Assistant imports here."""

from __future__ import annotations

from datetime import datetime

from .core.controller import ControllerState
from .core.load import LoadState
from .core.types import BoilerMode, Decision, Layer, LayerMode, Settings


def load_pending(st: LoadState, now: datetime) -> bool:
    """Above the limit, or a boiler pause still running: the load layer needs ticks seconds apart."""
    return st.over_since is not None or (st.emergency_until is not None and st.emergency_until > now)


def load_pending_any(ctrl: ControllerState, now: datetime) -> bool:
    """Also for the shadow state, so an observed overload shows in the log within seconds."""
    return load_pending(ctrl.load, now) or load_pending(ctrl.shadow_load, now)


def load_shedding_active(st: LoadState, now: datetime) -> bool:
    return (
        st.water_heater_shed
        or st.rods_shed > 0
        or (st.emergency_until is not None and st.emergency_until > now)
    )


def layer_load_state(settings: Settings, state: ControllerState) -> LoadState:
    """The real load state while the layer is ACTIVE, otherwise what it would have done."""
    return state.load if settings.layers.get(Layer.LOAD) is LayerMode.ACTIVE else state.shadow_load


def desired_call(
    settings: Settings, decision: Decision | None, state: ControllerState, now: datetime
) -> bool | None:
    """Whether the module wants the boiler to heat, live or observed."""
    if decision is None:
        return None
    codes = {r.code for r in decision.reasons}
    if not decision.season_active or "zone_boiler_off" in codes:
        return False
    # state.load holds a pause only while the load layer is live.
    if state.load.emergency_until is not None and state.load.emergency_until > now:
        return False
    if "rooms_unavailable" in codes:
        return True
    return state.boiler.call if settings.boiler.mode is BoilerMode.SMOOTH else state.boiler.classic_on
