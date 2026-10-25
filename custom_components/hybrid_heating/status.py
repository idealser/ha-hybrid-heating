"""Small read-only questions about the settings and the controller state. No Home Assistant imports here."""

from collections.abc import Callable
from datetime import datetime
from typing import Any

from .codec import to_data
from .core.ac import AcState
from .core.boiler import budget_remaining, driver_temperature
from .core.context import effective_target, zone_index
from .core.controller import ControllerState
from .core.curve import flow_for
from .core.load import LoadState
from .core.timeutil import after, before
from .core.types import (
    AC_ROOMS,
    DRIVER_ROOMS,
    BoilerMode,
    BoilerZoneMode,
    Decision,
    Layer,
    LayerMode,
    LoadSettings,
    Reason,
    Room,
    Settings,
    Snapshot,
)


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


def layer_ac_state(settings: Settings, state: ControllerState) -> AcState:
    """The real AC state while the layer is ACTIVE, otherwise what it would have done."""
    return state.ac if is_live(settings, Layer.AC) else state.shadow_ac


def _follows_coldest(settings: Settings, zone: int) -> bool:
    return settings.hybrid and settings.zones.policies[zone].boiler is BoilerZoneMode.BACKUP


def _normalised(settings: Settings, snap: Snapshot) -> dict[Room, float]:
    """The driver rooms' readings less their target offsets, as the controller compares them."""
    return {
        r: v - settings.room_offsets.get(r, 0.0) for r in DRIVER_ROOMS if (v := snap.rooms.get(r)) is not None
    }


def boiler_driver(settings: Settings, snap: Snapshot | None, decision: Decision | None) -> float | None:
    """The temperature the boiler follows, also while it idles (season off, boiler off in the zone)."""
    if decision is None or snap is None:
        return None
    reason = next((r for r in decision.reasons if r.layer is Layer.BOILER and "driver" in r.data), None)
    if reason is not None:
        value = reason.data["driver"]
        assert isinstance(value, (int, float))
        return float(value)
    t = driver_temperature(_normalised(settings, snap), _follows_coldest(settings, decision.zone))
    return round(t, 2) if t is not None else None


def _driver(
    settings: Settings, snap: Snapshot | None, zone: int, boiler_reason: Reason | None
) -> dict[str, Any]:
    follows_coldest = _follows_coldest(settings, zone)
    room: Room | None = None
    if follows_coldest and snap is not None:
        normalised = _normalised(settings, snap)
        room = min(normalised, key=lambda r: normalised[r]) if normalised else None
    temp = boiler_reason.data.get("driver") if boiler_reason is not None else None
    return {"mode": "coldest" if follows_coldest else "average", "room": to_data(room), "temp": temp}


def build_status(
    *,
    settings: Settings,
    snap: Snapshot | None,
    decision: Decision | None,
    state: ControllerState,
    revision: int,
    log_seq: int,
    suggestions_seq: int,
    enabled: bool,
    now: datetime,
    language: str,
    text: Callable[[Reason, str], str],
) -> dict[str, Any]:
    """Everything the dashboard card shows about the moment, in one JSON object."""
    t_out = snap.t_out if snap is not None else None
    if decision is not None:
        zone, preset, target = decision.zone, decision.preset, decision.target
    else:
        zone = zone_index(settings.zones.bounds, t_out) if t_out is not None else 0
        preset, target = effective_target(settings.targets, settings.preset, now)
    reasons = decision.reasons if decision is not None else ()
    boiler_reason = next((r for r in reasons if r.layer is Layer.BOILER and "driver" in r.data), None)
    driver = _driver(settings, snap, zone, boiler_reason)
    ac_state = layer_ac_state(settings, state)
    # As the controller decides it: an AC that really heats and that the module does not count as failing.
    ac_heating = snap is not None and any(
        snap.ac_hvac.get(r) == "heat" and snap.ac_available.get(r, False) and r not in ac_state.degraded
        for r in AC_ROOMS
    )
    shift = (
        settings.curve.ac_background_shift
        if settings.hybrid and ac_heating and driver["mode"] == "average"
        else 0.0
    )
    load = layer_load_state(settings, state)
    return {
        "revision": revision,
        "seq": {"log": log_seq, "suggestions": suggestions_seq},
        "enabled": enabled,
        # False until the first decision after a start (the start-up grace): nothing to explain yet.
        "decided": decision is not None,
        "season_active": decision.season_active if decision is not None else state.season_active,
        "now": now.isoformat(),
        "t_out": t_out,
        "t_out_window_mean": snap.t_out_window_mean if snap is not None else None,
        "zone": zone,
        "preset": settings.preset.value,
        "effective_preset": preset.value,
        "target": target,
        "flow_target": decision.flow_target if decision is not None else None,
        "curve_flow": flow_for(settings.curve, t_out, ac_active=False, hybrid=settings.hybrid)
        if t_out is not None
        else None,
        "background_shift": shift,
        "correction": boiler_reason.data.get("correction", 0.0) if boiler_reason is not None else 0.0,
        "driver": driver,
        "boiler": {
            "available": snap.boiler_available if snap is not None else False,
            "call_on": snap.boiler_call_on if snap is not None else None,
            # What the module wants, live or observed: in observe mode the call belongs to the old thermostat.
            "wanted": desired_call(settings, decision, state, now),
            "setpoint": snap.boiler_setpoint if snap is not None else None,
            "rods_limit": snap.boiler_rods_limit if snap is not None else None,
            "writes_left": budget_remaining(settings.boiler, state.boiler, now),
        },
        "rooms": {r.value: (snap.rooms.get(r) if snap is not None else None) for r in Room},
        "acs": {
            r.value: {
                "available": snap.ac_available.get(r, False) if snap is not None else False,
                "hvac": snap.ac_hvac.get(r) if snap is not None else None,
                "setpoint": snap.ac_setpoint.get(r) if snap is not None else None,
                "owned": r in ac_state.owned,
                "quiet": ac_state.quiet.get(r, False),
                "degraded": r in ac_state.degraded,
            }
            for r in AC_ROOMS
        },
        "load": {
            "kw": snap.load_kw if snap is not None else None,
            "water_heater_on": snap.water_heater_on if snap is not None else None,
            "water_heater_shed": load.water_heater_shed,
            "rods_shed": load.rods_shed,
            "shedding": load_shedding_active(load, now),
            "pausing": pausing(load, now),  # the heat call held off for the load, on every tick of it
        },
        "reasons": [{**to_data(r), "text": text(r, language)} for r in reasons],
    }
