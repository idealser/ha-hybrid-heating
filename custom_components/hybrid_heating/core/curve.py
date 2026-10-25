"""Weather-compensated flow curve."""

from itertools import pairwise

from .types import CurveSettings

CURVE_OUTDOOR_POINTS: tuple[float, ...] = (20, 15, 10, 5, 0, -5, -10, -15, -20)


def validate_curve(curve: CurveSettings) -> None:
    temps = tuple(t for t, _ in curve.points)
    if temps != CURVE_OUTDOOR_POINTS:
        raise ValueError(f"curve points must be at outdoor {CURVE_OUTDOOR_POINTS}, got {temps}")
    if curve.flow_min >= curve.flow_max:
        raise ValueError(f"flow_min {curve.flow_min} must be below flow_max {curve.flow_max}")


def raw_curve(curve: CurveSettings, t_out: float) -> float:
    """Flow from the curve points plus the parallel shift, before limits.

    Piecewise linear between points ordered from warm to cold; flat beyond the ends.
    """
    pts = curve.points
    if t_out >= pts[0][0]:
        return pts[0][1] + curve.shift
    for (t_warm, f_warm), (t_cold, f_cold) in pairwise(pts):
        if t_cold <= t_out <= t_warm:
            return f_warm + (f_cold - f_warm) * (t_warm - t_out) / (t_warm - t_cold) + curve.shift
    return pts[-1][1] + curve.shift


def flow_for(
    curve: CurveSettings, t_out: float, *, ac_active: bool, hybrid: bool, correction: float = 0.0
) -> float:
    """Flow setpoint: curve, lowered while ACs heat in hybrid mode, plus room correction, clamped."""
    background = curve.ac_background_shift if hybrid and ac_active else 0.0
    flow = raw_curve(curve, t_out) - background + correction
    return min(curve.flow_max, max(curve.flow_min, flow))
