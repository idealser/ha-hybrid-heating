from dataclasses import replace
from datetime import datetime

import pytest

from custom_components.hybrid_heating.core.context import (
    effective_target,
    policy_for,
    update_season,
    validate_zones,
    zone_index,
)
from custom_components.hybrid_heating.core.types import (
    BoilerZoneMode,
    Preset,
    PresetTargets,
    Room,
    SeasonMode,
    SeasonSettings,
    ZoneSettings,
)
from tests.conftest import TZ

B = (8.0, -3.0, -15.0)


@pytest.mark.parametrize(("t", "z"), [(8.0, 0), (7.9, 1), (-3.0, 1), (-3.1, 2), (-15.0, 2), (-15.1, 3)])
def test_zone_boundaries(t, z):
    assert zone_index(B, t) == z


def test_policy_now():
    p = policy_for(ZoneSettings(), 13.8)
    assert p.boiler is BoilerZoneMode.BACKUP and p.ac_rooms == {Room.LIVING, Room.BEDROOM}


def test_bad_bounds():
    validate_zones(ZoneSettings())
    with pytest.raises(ValueError):
        validate_zones(replace(ZoneSettings(), bounds=(8, 9, -15)))


def test_season_auto_hysteresis():
    s = SeasonSettings()
    assert update_season(s, 16.9, False) is True
    assert update_season(s, 17.5, True) is True
    assert update_season(s, 18.0, True) is False
    assert update_season(s, 17.5, False) is False
    assert update_season(s, None, True) is True
    assert update_season(replace(s, mode=SeasonMode.OFF), 5.0, True) is False
    assert update_season(replace(s, mode=SeasonMode.ON), 25.0, False) is True


def test_night_window_and_dst():
    t = PresetTargets()
    assert effective_target(t, Preset.COMFORT, datetime(2026, 10, 25, 23, 0, tzinfo=TZ)) == (
        Preset.NIGHT,
        22.5,
    )
    assert effective_target(t, Preset.COMFORT, datetime(2026, 10, 26, 6, 59, tzinfo=TZ)) == (
        Preset.NIGHT,
        22.5,
    )
    assert effective_target(t, Preset.COMFORT, datetime(2026, 10, 26, 7, 0, tzinfo=TZ)) == (
        Preset.COMFORT,
        23.0,
    )
    assert effective_target(t, Preset.COMFORT, datetime(2026, 10, 26, 21, 59, tzinfo=TZ)) == (
        Preset.COMFORT,
        23.0,
    )
    for fold in (0, 1):
        now = datetime(2026, 10, 25, 2, 30, fold=fold, tzinfo=TZ)
        assert effective_target(t, Preset.COMFORT, now)[0] is Preset.NIGHT
    assert effective_target(t, Preset.ECO, datetime(2026, 10, 25, 23, 0, tzinfo=TZ)) == (Preset.ECO, 21.5)
    assert effective_target(t, Preset.AWAY, datetime(2026, 10, 25, 12, 0, tzinfo=TZ)) == (Preset.AWAY, 16.0)
    assert effective_target(t, Preset.NIGHT, datetime(2026, 10, 25, 12, 0, tzinfo=TZ)) == (Preset.NIGHT, 22.5)


def test_night_window_that_does_not_cross_midnight():
    t = replace(
        PresetTargets(),
        night_start=datetime(2026, 1, 1, 1, 0).time(),
        night_end=datetime(2026, 1, 1, 5, 0).time(),
    )
    assert effective_target(t, Preset.COMFORT, datetime(2026, 11, 1, 3, 0, tzinfo=TZ))[0] is Preset.NIGHT
    assert effective_target(t, Preset.COMFORT, datetime(2026, 11, 1, 23, 0, tzinfo=TZ))[0] is Preset.COMFORT


def test_zone_hysteresis():
    from custom_components.hybrid_heating.core.context import zone_with_hysteresis

    assert zone_with_hysteresis(B, -3.1, None, 0.5) == 2
    assert zone_with_hysteresis(B, -3.1, 1, 0.5) == 1
    assert zone_with_hysteresis(B, -3.6, 1, 0.5) == 2
    assert zone_with_hysteresis(B, -2.9, 2, 0.5) == 2
    assert zone_with_hysteresis(B, -2.4, 2, 0.5) == 1
    assert zone_with_hysteresis(B, -20.0, 0, 0.5) == 3
