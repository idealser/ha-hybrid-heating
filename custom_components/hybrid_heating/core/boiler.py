"""Boiler control: driver room, PI room correction, smooth/classic heat call, write budget."""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, datetime

from .curve import raw_curve
from .timeutil import elapsed_s
from .types import DRIVER_ROOMS, BoilerSettings, CurveSettings, Room


@dataclass
class BoilerState:
    call: bool = False
    integral: float = 0.0  # °C·h
    overheat_since: datetime | None = None
    classic_on: bool = False
    last_write_at: datetime | None = None  # last flow setpoint write
    writes_today: int = 0  # flow and rods writes together
    writes_day: date | None = None
    last_flow_written: float | None = None  # reference when the boiler's setpoint can't be read


def driver_temperature(rooms: Mapping[Room, float | None], follows_coldest: bool) -> float | None:
    values = [v for r in DRIVER_ROOMS if (v := rooms.get(r)) is not None]
    if not values:
        return None
    return min(values) if follows_coldest else sum(values) / len(values)


def pi_step(
    s: BoilerSettings,
    error: float,
    integral: float,
    dt_s: float,
    saturated_high: bool,
    saturated_low: bool,
) -> tuple[float, float]:
    """One PI update. Returns (correction °C, new integral °C·h).

    The integral is held whenever integrating would push further into a limit:
    the flow is already at its max/min, or the correction itself is clamped.
    """
    candidate = integral + error * dt_s / 3600.0
    unclamped = s.kp * error + s.ki_per_hour * candidate
    pushing_up = error > 0 and (saturated_high or unclamped > s.corr_limit)
    pushing_down = error < 0 and (saturated_low or unclamped < -s.corr_limit)
    new_integral = integral if pushing_up or pushing_down else candidate
    correction = s.kp * error + s.ki_per_hour * new_integral
    return max(-s.corr_limit, min(s.corr_limit, correction)), new_integral


def decide_call_smooth(
    s: BoilerSettings, st: BoilerState, driver: float, target: float, now: datetime
) -> tuple[bool, str]:
    """Heat call stays on; it pauses only after a sustained overheat."""
    if st.call:
        if driver >= target + s.overheat_margin:
            if st.overheat_since is None:
                st.overheat_since = now
            if elapsed_s(now, st.overheat_since) >= s.overheat_after_s:
                st.call = False
                st.overheat_since = None
                return False, "smooth_paused"
            return True, "smooth_overheat_wait"
        st.overheat_since = None
        return True, "smooth_on"
    if driver < target + s.resume_margin:
        st.call = True
        st.overheat_since = None
        return True, "smooth_resumed"
    return False, "smooth_paused"


def decide_call_classic(
    s: BoilerSettings, st: BoilerState, avg: float, coldest: float, target: float
) -> tuple[bool, str]:
    """On/off by the average, plus a guard for the coldest room."""
    coldest_low = coldest < target - s.classic_coldest_tolerance
    if not st.classic_on:
        if avg < target - s.classic_hysteresis:
            st.classic_on = True
            return True, "classic_on_avg"
        if coldest_low:
            st.classic_on = True
            return True, "classic_on_coldest"
        return False, "classic_off"
    if avg >= target and not coldest_low:
        st.classic_on = False
        return False, "classic_off"
    return True, "classic_on_avg" if avg < target else "classic_on_coldest"


def budget_remaining(s: BoilerSettings, st: BoilerState, now: datetime) -> int:
    if st.writes_day != now.date():
        return s.write_budget_per_day
    return max(0, s.write_budget_per_day - st.writes_today)


def should_write_flow(
    s: BoilerSettings, st: BoilerState, current: float | None, desired: float, now: datetime
) -> bool:
    remaining = budget_remaining(s, st, now)
    if remaining <= 0:
        return False
    if st.last_write_at is not None and elapsed_s(now, st.last_write_at) < s.write_min_interval_s:
        return False
    if current is None:
        current = st.last_flow_written
    if current is None:
        return True
    min_delta = s.budget_low_min_delta if remaining < s.budget_low_threshold else s.write_min_delta
    return abs(desired - current) >= min_delta


def register_write(st: BoilerState, now: datetime, *, flow: bool = True) -> None:
    """Count a write to the boiler. Rods writes pass flow=False: they share the budget, not the interval."""
    if st.writes_day != now.date():
        st.writes_day = now.date()
        st.writes_today = 0
    st.writes_today += 1
    if flow:
        st.last_write_at = now


def carry_integral(
    s: BoilerSettings, integral: float, old: CurveSettings, new: CurveSettings, t_out: float | None
) -> float:
    """The integral after a curve change: the curve takes over what the correction already adds the same way.

    Raising a point the correction was covering for would otherwise add the same degrees twice, until the
    integral unwinds. Only what the integral holds in that direction moves, never past zero: a change the
    correction was not covering for acts at once.
    """
    if t_out is None or s.ki_per_hour <= 0:
        return integral
    delta = raw_curve(new, t_out) - raw_curve(old, t_out)
    held = s.ki_per_hour * integral  # °C the integral adds to the flow now
    if delta > 0:
        moved = min(delta, max(0.0, held))
    elif delta < 0:
        moved = max(delta, min(0.0, held))
    else:
        return integral
    return integral - moved / s.ki_per_hour
