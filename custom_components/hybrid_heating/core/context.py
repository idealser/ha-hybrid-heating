"""Where are we: outdoor zone, heating season, effective target."""

from __future__ import annotations

from datetime import datetime
from itertools import pairwise

from .types import Preset, PresetTargets, SeasonMode, SeasonSettings, ZonePolicy, ZoneSettings


def zone_index(bounds: tuple[float, float, float], t_out: float) -> int:
    """0 = warmest zone, 3 = deep frost. A boundary belongs to the warmer zone."""
    for i, bound in enumerate(bounds):
        if t_out >= bound:
            return i
    return len(bounds)


def zone_with_hysteresis(
    bounds: tuple[float, float, float], t_out: float, previous: int | None, hysteresis: float
) -> int:
    """Change zone only once the outdoor temperature is `hysteresis` past the boundary."""
    candidate = zone_index(bounds, t_out)
    if previous is None or candidate == previous:
        return candidate
    if candidate > previous:  # colder
        shifted = zone_index(bounds, t_out + hysteresis)
        return shifted if shifted > previous else previous
    shifted = zone_index(bounds, t_out - hysteresis)
    return shifted if shifted < previous else previous


def policy_for(zones: ZoneSettings, t_out: float) -> ZonePolicy:
    return zones.policies[zone_index(zones.bounds, t_out)]


def validate_zones(zones: ZoneSettings) -> None:
    b = zones.bounds
    if not all(a > c for a, c in pairwise(b)):
        raise ValueError(f"zone bounds must strictly decrease, got {b}")


def update_season(s: SeasonSettings, window_mean: float | None, active: bool) -> bool:
    if s.mode is SeasonMode.ON:
        return True
    if s.mode is SeasonMode.OFF:
        return False
    if window_mean is None:
        return active
    if active:
        return window_mean < s.threshold + s.hysteresis
    return window_mean < s.threshold


def effective_target(t: PresetTargets, preset: Preset, now: datetime) -> tuple[Preset, float]:
    """COMFORT turns into NIGHT inside the night window; other presets hold all day."""
    if preset is Preset.COMFORT and in_night_window(t, now):
        preset = Preset.NIGHT
    value = {
        Preset.COMFORT: t.comfort,
        Preset.ECO: t.eco,
        Preset.NIGHT: t.night,
        Preset.AWAY: t.away,
    }[preset]
    return preset, value


def in_night_window(t: PresetTargets, now: datetime) -> bool:
    # Wall-clock comparison only: a DST change cannot shift the window.
    clock = now.time().replace(fold=0)
    start, end = t.night_start, t.night_end
    if start <= end:
        return start <= clock < end
    return clock >= start or clock < end
