"""Physical model of the flat, shared by the season replay and the panel estimates.

Numbers come from the user's HA data and equipment (see the design spec, section 2).
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta, tzinfo
from typing import Any, Literal

from .types import Decision, Snapshot

AC_RATED_AT_C = 7.0
AC_LIMIT_C = -15.0
AC_CAPACITY_SHARE_AT_LIMIT = 3.0 / 6.2  # combined units: ~6.2 kW at +7 °C, ~3.0 kW at -15 °C


def heat_demand_kw(h_w_per_k: float, gains_w: float, t_in: float, t_out: float) -> float:
    return max(0.0, (h_w_per_k * (t_in - t_out) - gains_w) / 1000.0)


def ac_capacity_kw(rated_kw: float, t_out: float) -> float:
    """Heat output of an inverter split at full speed; stops below its rated -15 °C limit."""
    if t_out >= AC_RATED_AT_C:
        return rated_kw
    if t_out < AC_LIMIT_C:
        return 0.0
    share = AC_CAPACITY_SHARE_AT_LIMIT + (t_out - AC_LIMIT_C) / (AC_RATED_AT_C - AC_LIMIT_C) * (
        1.0 - AC_CAPACITY_SHARE_AT_LIMIT
    )
    return rated_kw * share


def ac_cop(t_out: float) -> float:
    """Seasonal-style COP estimate: 1.7 at -15 °C, 3.6 at +7 °C, 4.2 from +15 °C."""
    if t_out >= 15.0:
        return 4.2
    if t_out >= AC_RATED_AT_C:
        return 3.6 + (t_out - AC_RATED_AT_C) * (4.2 - 3.6) / (15.0 - AC_RATED_AT_C)
    t = max(t_out, AC_LIMIT_C)
    return 1.7 + (t - AC_LIMIT_C) * (3.6 - 1.7) / (AC_RATED_AT_C - AC_LIMIT_C)


def radiator_output_kw(
    flow: float, t_room: float, q50_kw: float = 7.9, n: float = 1.28, drop: float = 4.0
) -> float:
    """EN 442 style output: q50 * (dT/50)^n with dT = mean water temperature - room."""
    delta = flow - drop / 2.0 - t_room
    if delta <= 0:
        return 0.0
    return float(q50_kw * (delta / 50.0) ** n)


# The heat loss, learned from daily statistics

HEAT_LOSS_WINDOW_DAYS = 28
HEAT_LOSS_MIN_DAYS = 5


@dataclass(frozen=True)
class DayTally:
    """What the module saw on one local day, one count per minute it ran."""

    ticks: int = 0
    ac_heat_ticks: int = 0  # an AC heated (by the module or by hand): its heat is not metered
    season_ticks: int = 0


def update_tally(tallies: dict[date, DayTally], snap: Snapshot, d: Decision) -> None:
    """Count this tick for its local day (snap.now is in Home Assistant's time zone)."""
    day = snap.now.date()
    t = tallies.get(day, DayTally())
    ac = any(h == "heat" for h in snap.ac_hvac.values())
    tallies[day] = DayTally(t.ticks + 1, t.ac_heat_ticks + ac, t.season_ticks + d.season_active)


@dataclass(frozen=True)
class DayStats:
    day: date
    boiler_w: float | None  # mean electric power of the boiler that day
    t_out: float | None
    t_in: float | None  # mean of the rooms with a reading
    tally: DayTally | None


def day_stats(
    rows: Mapping[str, Sequence[Mapping[str, Any]]],
    *,
    boiler_id: str,
    outdoor_id: str,
    room_ids: Sequence[str],
    tallies: Mapping[date, DayTally],
    tz: tzinfo,
) -> list[DayStats]:
    """Days from a recorder statistics reply (period "day", mean), by local date."""

    def means(statistic_id: str) -> dict[date, float]:
        out: dict[date, float] = {}
        for row in rows.get(statistic_id, ()):
            start, mean = row.get("start"), row.get("mean")
            if isinstance(start, (int, float)) and isinstance(mean, (int, float)):
                out[datetime.fromtimestamp(start, tz).date()] = float(mean)
        return out

    boiler, outdoor = means(boiler_id), means(outdoor_id)
    rooms = [means(r) for r in room_ids]
    days = sorted(set(boiler) | set(outdoor) | {d for r in rooms for d in r})
    stats = []
    for d in days:
        inside = [r[d] for r in rooms if d in r]
        t_in = round(sum(inside) / len(inside), 2) if inside else None
        stats.append(DayStats(d, boiler.get(d), outdoor.get(d), t_in, tallies.get(d)))
    return stats


@dataclass(frozen=True)
class HeatLossEstimate:
    status: Literal["ok", "insufficient_data", "implausible"]
    w_per_k: float | None
    gains_w: float | None
    r2: float | None
    days_used: int
    window_days: int
    computed_at: datetime


def estimate_heat_loss(
    days: Sequence[DayStats],
    now: datetime,
    *,
    window_days: int = HEAT_LOSS_WINDOW_DAYS,
    min_days: int = HEAT_LOSS_MIN_DAYS,
    min_dt: float = 5.0,
    min_spread: float = 3.0,
    min_boiler_w: float = 50.0,  # below that in season with the house colder outside: a stuck sensor
    max_boiler_w: float = 8000.0,
    min_ticks: int = 1200,
    max_ac_ticks: int = 60,
    min_season_share: float = 0.95,
    plausible: tuple[float, float] = (50.0, 400.0),
    min_r2: float = 0.6,
    gains_range: tuple[float, float] = (-300.0, 1500.0),
) -> HeatLossEstimate:
    """Least squares over whole heating days without the ACs: boiler W = H * (inside - outside) - gains."""
    first, today = now.date() - timedelta(days=window_days), now.date()
    points: list[tuple[float, float]] = []
    for s in days:
        t = s.tally
        if not first <= s.day < today or t is None or None in (s.boiler_w, s.t_out, s.t_in):
            continue
        assert s.boiler_w is not None and s.t_out is not None and s.t_in is not None
        dt = s.t_in - s.t_out
        if (
            t.ticks >= min_ticks
            and t.ac_heat_ticks <= max_ac_ticks
            and t.season_ticks >= min_season_share * t.ticks
            and min_boiler_w <= s.boiler_w <= max_boiler_w
            and dt >= min_dt
        ):
            points.append((dt, s.boiler_w))

    def result(
        status: Literal["ok", "insufficient_data", "implausible"], *values: float | None
    ) -> HeatLossEstimate:
        h, gains, r2 = values or (None, None, None)
        return HeatLossEstimate(status, h, gains, r2, len(points), window_days, now)

    xs = [x for x, _ in points]
    if len(points) < min_days or max(xs) - min(xs) < min_spread:
        return result("insufficient_data")
    n = len(points)
    mx, my = sum(xs) / n, sum(y for _, y in points) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    h = sum((x - mx) * (y - my) for x, y in points) / sxx
    b = my - h * mx
    ss_tot = sum((y - my) ** 2 for _, y in points)
    ss_res = sum((y - (h * x + b)) ** 2 for x, y in points)
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 1.0
    good = plausible[0] <= h <= plausible[1] and r2 >= min_r2 and gains_range[0] <= -b <= gains_range[1]
    status: Literal["ok", "implausible"] = "ok" if good else "implausible"
    return result(status, round(h, 1), round(-b, 1), round(r2, 4))
