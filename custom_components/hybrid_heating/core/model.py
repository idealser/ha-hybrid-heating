"""Physical model of the flat, shared by the season replay and the panel estimates.

Numbers come from the user's HA data and equipment (see the design spec, section 2).
"""

from __future__ import annotations

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
