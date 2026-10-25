"""One controller tick: snapshot in, actions and reasons out."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from .ac import AcState, ac_allowed, decide_ac
from .boiler import (
    BoilerState,
    budget_remaining,
    decide_call_classic,
    decide_call_smooth,
    driver_temperature,
    pi_step,
    register_write,
    should_write_flow,
)
from .context import effective_target, in_night_window, update_season, zone_with_hysteresis
from .curve import flow_for
from .load import LoadState, load_step
from .timeutil import before, elapsed_s
from .types import (
    AC_ROOMS,
    DRIVER_ROOMS,
    Action,
    ActionKind,
    BoilerMode,
    BoilerZoneMode,
    Decision,
    Layer,
    LayerMode,
    NightMode,
    Preset,
    Reason,
    Settings,
    Snapshot,
)

DEFAULT_TICK_S = 60.0
MAX_PI_DT_S = 300.0
UNKNOWN_OUTDOOR_ZONE = 1  # before any outdoor reading: boiler leads, ACs stay off


@dataclass
class ControllerState:
    boiler: BoilerState = field(default_factory=BoilerState)
    ac: AcState = field(default_factory=AcState)
    load: LoadState = field(default_factory=LoadState)
    season_active: bool = False
    last_t_out: float | None = None
    last_t_out_at: datetime | None = None
    last_tick_at: datetime | None = None
    last_flow: float | None = None
    last_preset: Preset | None = None
    last_zone: int | None = None
    last_hybrid: bool | None = None
    # Persistent state for layers in OBSERVE: decisions evolve as if acted on, nothing real is claimed.
    shadow_ac: AcState = field(default_factory=AcState)
    shadow_load: LoadState = field(default_factory=LoadState)

    @classmethod
    def initial(cls, now: datetime) -> ControllerState:
        return cls()


def tick(settings: Settings, snap: Snapshot, state: ControllerState) -> Decision:
    now = snap.now
    mode = settings.layers
    acts: dict[Layer, list[Action]] = {layer: [] for layer in Layer}
    layer_reasons: dict[Layer, list[Reason]] = {layer: [] for layer in Layer}
    reasons: list[Reason] = []

    # 1. Season
    season = update_season(settings.season, snap.t_out_window_mean, state.season_active)
    if season != state.season_active:
        mean = snap.t_out_window_mean if snap.t_out_window_mean is not None else float("nan")
        reasons.append(Reason("season", "season_started" if season else "season_ended", {"mean": mean}))
    state.season_active = season

    # 2. Target
    preset, target = effective_target(settings.targets, settings.preset, now)

    # 3. Outdoor temperature
    outdoor_ok = True
    if snap.t_out is not None:
        state.last_t_out, state.last_t_out_at = snap.t_out, now
    elif state.last_t_out_at is None or elapsed_s(now, state.last_t_out_at) > settings.outdoor_stale_after_s:
        outdoor_ok = False
        reasons.append(Reason("system", "outdoor_unavailable"))
    t_out = state.last_t_out

    # 4. Zone
    if t_out is None:
        zone = UNKNOWN_OUTDOOR_ZONE
    else:
        zone = zone_with_hysteresis(settings.zones.bounds, t_out, state.last_zone, settings.zones.hysteresis)
        state.last_zone = zone
    policy = settings.zones.policies[zone]

    # Layers that are not ACTIVE run on their shadow state, so observing never claims an AC,
    # sheds a water heater, lowers the rods, drops the heat call or spends the boiler write budget.
    ac_live = mode[Layer.AC] is LayerMode.ACTIVE
    load_live = mode[Layer.LOAD] is LayerMode.ACTIVE
    boiler_live = mode[Layer.BOILER] is LayerMode.ACTIVE
    ac_state = state.ac if ac_live else state.shadow_ac
    load_state = state.load if load_live else state.shadow_load

    # Rooms relative to their own targets: comparing (T - offset) with the preset target is the same as
    # comparing T with target + offset, so the boiler logic below needs no per-room targets.
    offsets = settings.room_offsets
    norm_rooms = {r: (v - offsets.get(r, 0.0) if v is not None else None) for r, v in snap.rooms.items()}
    follows_coldest = policy.boiler is BoilerZoneMode.BACKUP and settings.hybrid

    # A manual AC switch-off holds until the effective preset changes (day/night counts)
    # or hybrid is switched back on.
    preset_changed = state.last_preset is not None and preset is not state.last_preset
    hybrid_enabled = state.last_hybrid is False and settings.hybrid
    if preset_changed or hybrid_enabled:
        ac_state.manual_hold.clear()
    state.last_preset, state.last_hybrid = preset, settings.hybrid

    # 5. ACs
    ac_heating = False
    # AC night modes follow the clock (any preset), or an explicitly chosen Night preset.
    night = in_night_window(settings.targets, now) or settings.preset is Preset.NIGHT
    for room in AC_ROOMS:
        night_mode = settings.ac.night.get(room) if night else None
        allowed = (
            season
            and t_out is not None
            and ac_allowed(
                settings.hybrid, policy, room, t_out, preset, night_mode, min_outdoor=settings.ac.min_outdoor
            )
        )
        a, r = decide_ac(
            settings.ac,
            ac_state,
            room,
            allowed=allowed,
            target=target + offsets.get(room, 0.0),
            room_temp=snap.rooms.get(room),
            hvac=snap.ac_hvac.get(room),
            setpoint=snap.ac_setpoint.get(room),
            available=snap.ac_available.get(room, False),
            quiet_wanted=night_mode is NightMode.QUIET,
            now=now,
        )
        acts[Layer.AC] += a
        layer_reasons[Layer.AC] += r
        # The boiler's background shift follows ACs that really heat: reported in heat mode (by us or by
        # hand), or started by a live AC layer on this tick. Observed (shadow) decisions never count.
        really_on = snap.ac_hvac.get(room) == "heat" and snap.ac_available.get(room, False)
        started_now = ac_live and any(x.kind is ActionKind.AC_HVAC and x.value == "heat" for x in a)
        ac_heating |= (really_on or started_now) and room not in ac_state.degraded

    # 6. Boiler
    dt = DEFAULT_TICK_S
    if state.last_tick_at is not None:
        dt = min(MAX_PI_DT_S, max(0.0, elapsed_s(now, state.last_tick_at)))
    call: bool
    flow: float | None = None
    rooms_known = any(norm_rooms.get(r) is not None for r in DRIVER_ROOMS)
    if not season:
        call = False
        state.boiler.call = False
        layer_reasons[Layer.BOILER].append(Reason(Layer.BOILER, "season_idle"))
    elif policy.boiler is BoilerZoneMode.OFF:
        call = False
        state.boiler.call = False
        layer_reasons[Layer.BOILER].append(Reason(Layer.BOILER, "zone_boiler_off", {"zone": zone}))
    elif not rooms_known:
        call, flow = True, settings.boiler.fallback_flow
        reasons.append(Reason("system", "rooms_unavailable"))
    else:
        driver = driver_temperature(norm_rooms, follows_coldest)
        assert driver is not None  # rooms_known
        correction = 0.0
        if settings.boiler.mode is BoilerMode.SMOOTH:
            last = state.last_flow
            correction, state.boiler.integral = pi_step(
                settings.boiler,
                target - driver,
                state.boiler.integral,
                dt,
                saturated_high=last is not None and last >= settings.curve.flow_max,
                saturated_low=last is not None and last <= settings.curve.flow_min,
            )
            call, code = decide_call_smooth(settings.boiler, state.boiler, driver, target, now)
        else:
            avg = driver_temperature(norm_rooms, False)
            coldest = driver_temperature(norm_rooms, True)
            assert avg is not None and coldest is not None
            call, code = decide_call_classic(settings.boiler, state.boiler, avg, coldest, target)
        if outdoor_ok and t_out is not None:
            # While the boiler follows the coldest room (one without an AC), it gets the full curve.
            flow = flow_for(
                settings.curve,
                t_out,
                ac_active=ac_heating and not follows_coldest,
                hybrid=settings.hybrid,
                correction=correction,
            )
        else:
            flow = settings.boiler.fallback_flow
        state.last_flow = flow
        layer_reasons[Layer.BOILER].append(
            Reason(
                Layer.BOILER,
                code,
                {
                    "driver": round(driver, 2),
                    "target": target,
                    "correction": round(correction, 2),
                    "flow": flow,
                },
            )
        )

    # 7. Load
    budget_ok = budget_remaining(settings.boiler, state.boiler, now) > 0 and snap.boiler_available
    a, r = load_step(
        settings.load, load_state, now, snap.load_kw, snap.water_heater_on, policy.max_rods, budget_ok
    )
    # Rods are decided once below; keep only the water heater actions here.
    acts[Layer.LOAD] += [x for x in a if x.kind is ActionKind.WATER_HEATER]
    layer_reasons[Layer.LOAD] += r
    if load_live and state.load.rods_shed > 0 and state.load.rods_base is None:
        # Remember what to hand back: the zone's rods if the boiler layer is live, else what the boiler had.
        current = snap.boiler_rods_limit if snap.boiler_rods_limit is not None else policy.max_rods
        state.load.rods_base = policy.max_rods if boiler_live else current

    # 8. Pause: a live load layer owns the heat call while it pauses the boiler, and hands it back.
    pausing = load_live and state.load.emergency_until is not None and before(now, state.load.emergency_until)
    if pausing:
        call = False
        if snap.boiler_call_on is not False:
            acts[Layer.LOAD].append(Action(ActionKind.BOILER_CALL, False))
            state.load.call_paused = state.load.call_paused or snap.boiler_call_on is True
    elif load_live and state.load.call_paused:
        state.load.call_paused = False
        if not boiler_live and snap.boiler_call_on is False:
            acts[Layer.LOAD].append(Action(ActionKind.BOILER_CALL, True))

    # Rods: the load layer owns them while it has taken any; otherwise a live boiler layer follows the zone.
    rods_target: int | None = None
    rods_layer = Layer.BOILER
    if load_live and state.load.rods_base is not None:
        base = policy.max_rods if boiler_live else state.load.rods_base
        rods_target, rods_layer = max(1, base - state.load.rods_shed), Layer.LOAD
    elif boiler_live:
        rods_target = policy.max_rods
    if (
        rods_target is not None
        and snap.boiler_available
        and snap.boiler_rods_limit is not None
        and rods_target != snap.boiler_rods_limit
        and budget_remaining(settings.boiler, state.boiler, now) > 0
    ):
        acts[rods_layer].append(Action(ActionKind.BOILER_RODS, rods_target))
        if mode[rods_layer] is LayerMode.ACTIVE:
            register_write(state.boiler, now, flow=False)
    if (
        load_live
        and state.load.rods_base is not None
        and state.load.rods_shed == 0
        and snap.boiler_rods_limit == rods_target
    ):
        state.load.rods_base = None  # everything handed back and confirmed

    # Boiler actions
    if not any(x.kind is ActionKind.BOILER_CALL for x in acts[Layer.LOAD]) and snap.boiler_call_on != call:
        acts[Layer.BOILER].append(Action(ActionKind.BOILER_CALL, call))
    if snap.boiler_available and call and flow is not None:
        wanted = round(flow)
        if should_write_flow(settings.boiler, state.boiler, snap.boiler_setpoint, wanted, now):
            acts[Layer.BOILER].append(Action(ActionKind.BOILER_FLOW, wanted))
            if boiler_live:
                register_write(state.boiler, now)
                state.boiler.last_flow_written = wanted

    state.last_tick_at = now

    # 9. Layer modes
    out_actions: list[Action] = []
    # Load actions first: a pause and a rods cut must land before anything turns heat back on.
    for layer in (Layer.LOAD, Layer.BOILER, Layer.AC):
        if mode[layer] is LayerMode.ACTIVE:
            out_actions += acts[layer]
            reasons += layer_reasons[layer]
        elif mode[layer] is LayerMode.OBSERVE:
            reasons += [Reason(x.layer, x.code, {**x.data, "observe": True}) for x in layer_reasons[layer]]

    return Decision(
        actions=tuple(out_actions),
        reasons=tuple(reasons),
        flow_target=flow,
        zone=zone,
        target=target,
        preset=preset,
        season_active=season,
    )
