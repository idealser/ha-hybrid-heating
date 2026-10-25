"""Load shedding: keep the whole flat under the power limit. ACs are never touched.

Like the user's old HA automation, but one step further: an overload held for
`shed_after_s` pauses the boiler at once (the breaker will not wait), switches off the water heater,
and lowers the rods by one so the overload does not come back when the pause ends.
"""

from dataclasses import dataclass
from datetime import datetime

from .timeutil import after, before, held
from .types import Action, ActionKind, Layer, LoadSettings, Reason


@dataclass
class LoadState:
    over_since: datetime | None = None
    under_since: datetime | None = None
    last_step_at: datetime | None = None  # last rod reduction (or refused reduction)
    water_heater_shed: bool = False  # True only if this module switched the water heater off
    rods_shed: int = 0
    emergency_until: datetime | None = None  # boiler heat call paused until then
    call_paused: bool = False  # the heat call was on when this layer paused it
    rods_base: int | None = None  # rods to hand back once nothing is shed; None = not involved


def effective_rods(zone_max_rods: int, st: LoadState) -> int:
    return max(1, zone_max_rods - st.rods_shed)


def load_step(
    s: LoadSettings,
    st: LoadState,
    now: datetime,
    load_kw: float | None,
    water_heater_on: bool | None,
    zone_max_rods: int,
    budget_ok: bool,
) -> tuple[list[Action], list[Reason]]:
    if load_kw is None:
        return [], [Reason(Layer.LOAD, "load_unknown")]

    acts: list[Action] = []
    reasons: list[Reason] = []
    data = {"load_kw": round(load_kw, 2), "limit_kw": s.limit_kw}

    over = load_kw > s.limit_kw
    under = load_kw < s.restore_kw
    st.over_since = (st.over_since or now) if over else None
    st.under_since = (st.under_since or now) if under else None

    if held(st.over_since, now, s.shed_after_s):
        if st.emergency_until is None or not before(now, st.emergency_until):
            st.emergency_until = after(now, s.pause_s)
            reasons.append(Reason(Layer.LOAD, "pause_boiler", data))
        if water_heater_on is True and not st.water_heater_shed:
            st.water_heater_shed = True
            acts.append(Action(ActionKind.WATER_HEATER, False))
            reasons.append(Reason(Layer.LOAD, "shed_water_heater", data))
        rod_step_due = st.last_step_at is None or held(st.last_step_at, now, s.step_interval_s)
        if effective_rods(zone_max_rods, st) > 1 and rod_step_due:
            st.last_step_at = now
            if budget_ok:
                st.rods_shed += 1
                acts.append(Action(ActionKind.BOILER_RODS, effective_rods(zone_max_rods, st)))
                reasons.append(Reason(Layer.LOAD, "shed_rod", data))
            else:
                reasons.append(Reason(Layer.LOAD, "rods_budget_exhausted", data))
        return acts, reasons

    if held(st.under_since, now, s.restore_after_s):
        if st.rods_shed > 0 and budget_ok:
            st.rods_shed -= 1
            st.under_since = now
            acts.append(Action(ActionKind.BOILER_RODS, effective_rods(zone_max_rods, st)))
            reasons.append(Reason(Layer.LOAD, "restore_rod", data))
        elif st.water_heater_shed:
            st.water_heater_shed = False
            st.under_since = now
            acts.append(Action(ActionKind.WATER_HEATER, True))
            reasons.append(Reason(Layer.LOAD, "restore_water_heater", data))
    return acts, reasons
