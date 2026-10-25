"""Thermal model of the flat for the season replay. Test-only code.

Three rooms (living incl. kitchen/hall, bedroom, child) coupled to each other and to outdoors,
a water loop heated by the boiler rods, radiators by the EN 442 formula, and two inverter ACs.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

from custom_components.hybrid_heating.core.context import effective_target
from custom_components.hybrid_heating.core.controller import ControllerState, tick
from custom_components.hybrid_heating.core.model import ac_capacity_kw, ac_cop, radiator_output_kw
from custom_components.hybrid_heating.core.types import ActionKind, Room, Settings, Snapshot

L, B, C = Room.LIVING, Room.BEDROOM, Room.CHILD
ROOMS3 = (L, B, C)
AC_ROOMS = (L, B)

CAP_KWH_PER_K = {L: 2.6, B: 1.3, C: 1.3}
UA_OUT_KW_PER_K = {L: 0.075, B: 0.038, C: 0.037}
# Doors are usually open. Calibrated so the legacy run reproduces the real room spread without TRVs
# (2026-10-22: living +0.4, bedroom -0.1, child -0.3 against the average); the plan started from 30/30/15.
COUPLING_KW_PER_K = {(L, B): 0.120, (L, C): 0.120, (B, C): 0.060}
GAIN_SHARE = {L: 0.6, B: 0.2, C: 0.2}
RAD_Q50_KW = {L: 7.9 * 34 / 69, B: 7.9 * 20 / 69, C: 7.9 * 15 / 69}
FLOOR_Q50_KW = 0.5  # underfloor loops, counted in the living node
WATER_KWH_PER_K = 0.1
ROD_KW = 2.0
BOILER_HYSTERESIS_K = 7.0
AC_RATED_KW = {L: 3.5, B: 2.7}
AC_SENSOR_BIAS_K = 1.0
AC_GAIN_KW_PER_K = 1.5
QUIET_FACTOR = 0.6
WARMUP_H = 48
LEGACY_FLOW = 50.0
LEGACY_RODS = 3
LEGACY_HYSTERESIS = 0.3


@dataclass
class SimResult:
    samples: list[tuple[float, float, float, float]] = field(
        default_factory=list
    )  # living, bed, child, target
    writes_per_day: dict[date, int] = field(default_factory=lambda: defaultdict(int))
    call_cycles_per_day: dict[date, int] = field(default_factory=lambda: defaultdict(int))
    max_over_limit_run_s: float = 0.0
    ac_setpoints: set[int] = field(default_factory=set)
    boiler_kwh: float = 0.0
    ac_kwh: float = 0.0
    seconds: float = 0.0
    # diagnostics
    ac_heat_kwh: float = 0.0
    rad_heat_kwh: dict[Room, float] = field(default_factory=lambda: defaultdict(float))
    overload_runs: list[tuple[datetime, float, float, float, float, int]] = field(default_factory=list)

    @property
    def heating_kwh(self) -> float:
        return self.boiler_kwh + self.ac_kwh

    @property
    def ac_setpoint_range(self) -> tuple[int, int]:
        return (min(self.ac_setpoints), max(self.ac_setpoints)) if self.ac_setpoints else (24, 24)

    def share_not_below(self, room: Room, tol: float) -> float:
        idx = ROOMS3.index(room)
        return sum(1 for s in self.samples if s[idx] >= s[idx + 3] - tol) / len(self.samples)

    def share_within(self, room: Room, tol: float) -> float:
        idx = ROOMS3.index(room)
        hits = sum(1 for s in self.samples if abs(s[idx] - s[idx + 3]) <= tol)
        return hits / len(self.samples)


def _parse(rows: list[dict[str, Any]]) -> list[tuple[datetime, float, float]]:
    """(time, outdoor °C, household base load kW) per hour, gaps filled forward."""
    out: list[tuple[datetime, float, float]] = []
    t_out, boiler, total = 10.0, 0.0, 0.5
    for r in rows:
        t_out = float(r["t_out"]) if r["t_out"] else t_out
        boiler = float(r["boiler_kw"]) if r["boiler_kw"] else boiler
        total = float(r["total_kw"]) if r["total_kw"] else total
        out.append((datetime.fromisoformat(r["ts"]), t_out, max(0.0, total - boiler)))
    return out


def simulate(
    settings: Settings,
    rows: list[dict[str, Any]],
    step_s: int = 60,
    legacy: bool = False,
    trv_rooms: frozenset[Room] = frozenset(),
    trv_offset: float = 0.2,
) -> SimResult:
    """trv_rooms: radiators with a thermostatic head that closes trv_offset K above the room target."""
    hours = _parse(rows)
    res = SimResult()
    temps = dict.fromkeys(ROOMS3, 23.0)
    tw = 30.0
    call, rods_on = False, False
    flow_setpoint, rods_limit = LEGACY_FLOW, LEGACY_RODS
    ac_hvac = dict.fromkeys(AC_ROOMS, "off")
    ac_sp = {L: 24, B: 25}
    quiet = dict.fromkeys(AC_ROOMS, False)
    ctrl = ControllerState.initial(hours[0][0])
    last_load = 0.5
    over_run = 0.0
    start = hours[0][0]
    steps_per_hour = 3600 // step_s
    dt_h = step_s / 3600.0
    limit = settings.load.limit_kw

    for i, (t0, out0, base) in enumerate(hours):
        out1 = hours[i + 1][1] if i + 1 < len(hours) else out0
        window = [h[1] for h in hours[max(0, i - 11) : i + 1]]
        window_mean = sum(window) / len(window)
        for k in range(steps_per_hour):
            now = t0 + timedelta(seconds=k * step_s)
            t_out = out0 + (out1 - out0) * k / steps_per_hour
            day = now.date()

            if legacy:
                _, target = effective_target(settings.targets, settings.preset, now)
                avg = sum(temps.values()) / 3
                if call and avg >= target:
                    call = False
                elif not call and avg < target - LEGACY_HYSTERESIS:
                    call = True
                season = True
            else:
                snap = Snapshot(
                    now=now,
                    t_out=t_out,
                    t_out_window_mean=window_mean,
                    rooms={L: temps[L], B: temps[B], C: temps[C], Room.BATH: temps[L]},
                    ac_available=dict.fromkeys(AC_ROOMS, True),
                    ac_hvac=dict(ac_hvac),
                    ac_setpoint=dict(ac_sp),
                    boiler_available=True,
                    boiler_call_on=call,
                    boiler_setpoint=flow_setpoint,
                    boiler_rods_limit=rods_limit,
                    load_kw=last_load,
                    water_heater_on=None,
                )
                d = tick(settings, snap, ctrl)
                target, season = d.target, d.season_active
                prev_call = call
                for a in d.actions:
                    if a.kind is ActionKind.BOILER_CALL:
                        call = bool(a.value)
                    elif a.kind is ActionKind.BOILER_FLOW:
                        flow_setpoint = float(a.value)
                        res.writes_per_day[day] += 1
                    elif a.kind is ActionKind.BOILER_RODS:
                        rods_limit = int(a.value)
                        res.writes_per_day[day] += 1
                    elif a.kind is ActionKind.AC_HVAC and a.room is not None:
                        ac_hvac[a.room] = str(a.value)
                    elif a.kind is ActionKind.AC_SETPOINT and a.room is not None:
                        ac_sp[a.room] = int(a.value)
                        res.ac_setpoints.add(int(a.value))
                    elif a.kind is ActionKind.AC_QUIET and a.room is not None:
                        quiet[a.room] = bool(a.value)
                if prev_call and not call:
                    res.call_cycles_per_day[day] += 1
                res.call_cycles_per_day.setdefault(day, 0)

            # boiler: rods cycle on the flow temperature with the boiler's own hysteresis
            if not call or tw >= flow_setpoint:
                rods_on = False
            elif tw <= flow_setpoint - BOILER_HYSTERESIS_K:
                rods_on = True
            p_boiler = rods_limit * ROD_KW if rods_on else 0.0

            q_rad = {r: radiator_output_kw(tw, temps[r], q50_kw=RAD_Q50_KW[r]) for r in ROOMS3}
            for r in trv_rooms:
                if temps[r] > target + settings.room_offsets.get(r, 0.0) + trv_offset:
                    q_rad[r] = 0.0
            q_rad[L] += radiator_output_kw(tw, temps[L], q50_kw=FLOOR_Q50_KW)

            q_ac = dict.fromkeys(ROOMS3, 0.0)
            el_ac = 0.0
            for r in AC_ROOMS:
                if ac_hvac[r] == "heat":
                    cap = ac_capacity_kw(AC_RATED_KW[r], t_out) * (QUIET_FACTOR if quiet[r] else 1.0)
                    q = min(cap, max(0.0, AC_GAIN_KW_PER_K * (ac_sp[r] - (temps[r] + AC_SENSOR_BIAS_K))))
                    q_ac[r] = q
                    if q > 0:
                        el_ac += q / ac_cop(t_out)

            load = base + p_boiler + el_ac
            last_load = load
            if load > limit and base <= limit:
                over_run += step_s
            else:
                if over_run > 60:
                    res.overload_runs.append((now, over_run, base, p_boiler, el_ac, rods_limit))
                over_run = 0.0
            res.max_over_limit_run_s = max(res.max_over_limit_run_s, over_run)

            tw += (p_boiler - sum(q_rad.values())) * dt_h / WATER_KWH_PER_K
            new = {}
            for r in ROOMS3:
                heat = q_rad[r] + q_ac[r] + base * GAIN_SHARE[r] - UA_OUT_KW_PER_K[r] * (temps[r] - t_out)
                for (a, b), g in COUPLING_KW_PER_K.items():
                    if r == a:
                        heat -= g * (temps[a] - temps[b])
                    elif r == b:
                        heat -= g * (temps[b] - temps[a])
                new[r] = temps[r] + heat * dt_h / CAP_KWH_PER_K[r]
            temps = new

            res.boiler_kwh += p_boiler * dt_h
            res.ac_kwh += el_ac * dt_h
            res.ac_heat_kwh += sum(q_ac.values()) * dt_h
            for r in ROOMS3:
                res.rad_heat_kwh[r] += q_rad[r] * dt_h
            res.seconds += step_s
            if season and (now - start).total_seconds() >= WARMUP_H * 3600:
                offs = {} if legacy else settings.room_offsets
                res.samples.append(
                    (temps[L], temps[B], temps[C], *(target + offs.get(r, 0.0) for r in ROOMS3))
                )
    return res
