"""Small read-only questions about the settings and the controller state. No Home Assistant imports here."""

from datetime import datetime

from .core.controller import ControllerState
from .core.load import LoadState
from .core.timeutil import after, before
from .core.types import BoilerMode, Decision, Layer, LayerMode, LoadSettings, Settings


def is_live(settings: Settings, layer: Layer) -> bool:
    return settings.layers.get(layer) is LayerMode.ACTIVE


def pausing(st: LoadState, now: datetime) -> bool:
    """The load layer holds the boiler's heat call off until emergency_until."""
    return st.emergency_until is not None and before(now, st.emergency_until)


def load_pending(st: LoadState, now: datetime) -> bool:
    """Above the limit, or a boiler pause still running: the load layer needs ticks seconds apart."""
    return st.over_since is not None or pausing(st, now)


def load_pending_any(ctrl: ControllerState, now: datetime) -> bool:
    """Also for the shadow state, so an observed overload shows in the log within seconds."""
    return load_pending(ctrl.load, now) or load_pending(ctrl.shadow_load, now)


def load_shedding_active(st: LoadState, now: datetime) -> bool:
    return st.water_heater_shed or st.rods_shed > 0 or pausing(st, now)


def layer_load_state(settings: Settings, state: ControllerState) -> LoadState:
    """The real load state while the layer is ACTIVE, otherwise what it would have done."""
    return state.load if is_live(settings, Layer.LOAD) else state.shadow_load


def desired_call(
    settings: Settings, decision: Decision | None, state: ControllerState, now: datetime
) -> bool | None:
    """Whether the module wants the boiler to heat, live or observed."""
    if decision is None:
        return None
    codes = {r.code for r in decision.reasons}
    if not decision.season_active or "zone_boiler_off" in codes:
        return False
    if pausing(state.load, now):  # state.load holds a pause only while the load layer is live
        return False
    if "rooms_unavailable" in codes:
        return True
    return state.boiler.call if settings.boiler.mode is BoilerMode.SMOOTH else state.boiler.classic_on


def next_load_deadline(st: LoadState, s: LoadSettings, now: datetime) -> datetime | None:
    """When the load layer next needs a tick: the end of the hold time, or the end of a boiler pause.

    Fast ticks are as far apart as the hold time, so without this the shed lands one tick late.
    """
    dues: list[datetime] = []
    if st.over_since is not None:
        due = after(st.over_since, s.shed_after_s)
        if before(now, due):
            dues.append(due)
    if pausing(st, now):
        assert st.emergency_until is not None
        dues.append(st.emergency_until)
    return min(dues, key=datetime.timestamp) if dues else None


def next_load_deadline_any(ctrl: ControllerState, s: LoadSettings, now: datetime) -> datetime | None:
    """The earliest deadline of the live and the shadow load state."""
    dues = [d for st in (ctrl.load, ctrl.shadow_load) if (d := next_load_deadline(st, s, now)) is not None]
    return min(dues, key=datetime.timestamp) if dues else None
