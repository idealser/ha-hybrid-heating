import re
from pathlib import Path

from custom_components.hybrid_heating.core.types import (
    BoilerZoneMode,
    LayerMode,
    NightMode,
    Room,
    Settings,
)


def test_defaults_match_spec():
    s = Settings()
    assert s.curve.points == (
        (20, 28.0),
        (15, 34.0),
        (10, 39.5),
        (5, 44.5),
        (0, 49.5),
        (-5, 54.0),
        (-10, 58.0),
        (-15, 62.0),
        (-20, 66.0),
    )
    assert (s.curve.flow_min, s.curve.flow_max, s.curve.ac_background_shift) == (30.0, 65.0, 3.0)
    assert s.zones.bounds == (8.0, -3.0, -15.0)
    assert [p.max_rods for p in s.zones.policies] == [2, 2, 3, 3]
    assert s.zones.policies[0].boiler is BoilerZoneMode.BACKUP
    assert s.zones.policies[3].ac_rooms == frozenset()
    assert (s.targets.comfort, s.targets.eco, s.targets.night, s.targets.away) == (23.0, 21.5, 22.5, 16.0)
    assert (s.season.threshold, s.season.window_hours, s.season.hysteresis) == (17.0, 12, 1.0)
    assert (s.load.limit_kw, s.load.restore_kw) == (8.0, 6.0)
    assert s.boiler.write_budget_per_day == 48
    assert s.boiler.corr_limit == 5.0
    assert s.room_offsets == {Room.CHILD: -1.0}
    assert s.ac.night == {Room.LIVING: NightMode.DAY, Room.BEDROOM: NightMode.QUIET}
    assert all(m is LayerMode.OBSERVE for m in s.layers.values())


def test_core_has_no_homeassistant_imports():
    core = Path("custom_components/hybrid_heating/core")
    offenders = [
        p.name
        for p in core.glob("*.py")
        if re.search(r"^\s*(from|import)\s+homeassistant", p.read_text(encoding="utf-8"), re.M)
    ]
    assert offenders == []
