"""Settings, inputs and outputs of the hybrid heating controller.

Everything here is plain data. Defaults are the values fixed by the design spec
(docs/superpowers/specs/2026-10-25-hybrid-heating-design.md).
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime, time
from enum import StrEnum
from types import MappingProxyType
from typing import Literal


class Room(StrEnum):
    LIVING = "living"
    BEDROOM = "bedroom"
    CHILD = "child"
    BATH = "bath"


AC_ROOMS: tuple[Room, ...] = (Room.LIVING, Room.BEDROOM)
DRIVER_ROOMS: tuple[Room, ...] = (Room.LIVING, Room.BEDROOM, Room.CHILD)


class BoilerZoneMode(StrEnum):
    OFF = "off"
    BACKUP = "backup"
    MAIN = "main"


class BoilerMode(StrEnum):
    SMOOTH = "smooth"
    CLASSIC = "classic"


class Preset(StrEnum):
    COMFORT = "comfort"
    ECO = "eco"
    NIGHT = "night"
    AWAY = "away"


class NightMode(StrEnum):
    QUIET = "quiet"
    OFF = "off"
    DAY = "day"


class SeasonMode(StrEnum):
    AUTO = "auto"
    ON = "on"
    OFF = "off"


class LayerMode(StrEnum):
    OFF = "off"
    OBSERVE = "observe"
    ACTIVE = "active"


class Layer(StrEnum):
    BOILER = "boiler"
    AC = "ac"
    LOAD = "load"


@dataclass(frozen=True)
class CurveSettings:
    # (outdoor °C, flow °C) every 5 °C from +20 to -20. Defaults follow the radiator model:
    # 150 W/K heat loss, 7.9 kW at dT50, n = 1.28, 23 °C indoors.
    points: tuple[tuple[float, float], ...] = (
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
    shift: float = 0.0
    flow_min: float = 30.0
    flow_max: float = 65.0
    ac_background_shift: float = 3.0


@dataclass(frozen=True)
class ZonePolicy:
    ac_rooms: frozenset[Room]
    boiler: BoilerZoneMode
    max_rods: int


_BOTH_ACS = frozenset(AC_ROOMS)


@dataclass(frozen=True)
class ZoneSettings:
    # boundaries between warm|cool, cool|frost, frost|deep frost; a boundary belongs to the warmer zone
    bounds: tuple[float, float, float] = (8.0, -3.0, -15.0)
    hysteresis: float = 0.5  # °C past a boundary before the zone changes
    policies: tuple[ZonePolicy, ZonePolicy, ZonePolicy, ZonePolicy] = (
        ZonePolicy(_BOTH_ACS, BoilerZoneMode.BACKUP, 2),
        ZonePolicy(_BOTH_ACS, BoilerZoneMode.MAIN, 2),
        ZonePolicy(_BOTH_ACS, BoilerZoneMode.MAIN, 3),
        ZonePolicy(frozenset(), BoilerZoneMode.MAIN, 3),
    )


@dataclass(frozen=True)
class PresetTargets:
    comfort: float = 23.0
    eco: float = 21.5
    night: float = 22.5
    away: float = 16.0
    night_start: time = time(22, 0)
    night_end: time = time(7, 0)


@dataclass(frozen=True)
class SeasonSettings:
    mode: SeasonMode = SeasonMode.AUTO
    threshold: float = 17.0
    window_hours: int = 12
    hysteresis: float = 1.0


@dataclass(frozen=True)
class BoilerSettings:
    mode: BoilerMode = BoilerMode.SMOOTH
    kp: float = 2.0  # °C of flow per °C of room error
    ki_per_hour: float = 1.0  # °C of flow per °C·h of accumulated error
    corr_limit: float = 5.0
    overheat_margin: float = 0.5
    overheat_after_s: int = 900
    resume_margin: float = 0.2
    classic_hysteresis: float = 0.3
    classic_coldest_tolerance: float = 0.8
    write_min_delta: float = 1.0
    write_min_interval_s: int = 600
    write_budget_per_day: int = 48
    budget_low_threshold: int = 8
    budget_low_min_delta: float = 3.0
    fallback_flow: float = 50.0


def _default_night() -> Mapping[Room, NightMode]:
    return MappingProxyType({Room.LIVING: NightMode.DAY, Room.BEDROOM: NightMode.QUIET})


@dataclass(frozen=True)
class AcSettings:
    deadband: float = 0.3
    step_interval_s: int = 600
    setpoint_min: int = 16
    setpoint_max: int = 30
    min_outdoor: float = -15.0
    fail_error: float = 1.0
    fail_after_s: int = 3600
    command_grace_s: int = 180  # Gree reports a command late or drops it silently
    night: Mapping[Room, NightMode] = field(default_factory=_default_night)


@dataclass(frozen=True)
class LoadSettings:
    # Above 8 kW held for 5 s (the user's choice; their old HA automation used 1 s), pause the boiler 20 s.
    limit_kw: float = 8.0
    restore_kw: float = 6.0
    shed_after_s: float = 5.0
    pause_s: int = 20
    step_interval_s: int = 60  # min time between two rod reductions
    restore_after_s: int = 600


def _default_room_offsets() -> Mapping[Room, float]:
    # Each room's target = preset target + offset. The child room sleeps 1 °C cooler by default.
    return MappingProxyType({Room.CHILD: -1.0})


def _default_layers() -> Mapping[Layer, LayerMode]:
    return MappingProxyType({layer: LayerMode.OBSERVE for layer in Layer})


@dataclass(frozen=True)
class Settings:
    hybrid: bool = True
    preset: Preset = Preset.COMFORT
    targets: PresetTargets = field(default_factory=PresetTargets)
    curve: CurveSettings = field(default_factory=CurveSettings)
    zones: ZoneSettings = field(default_factory=ZoneSettings)
    boiler: BoilerSettings = field(default_factory=BoilerSettings)
    ac: AcSettings = field(default_factory=AcSettings)
    load: LoadSettings = field(default_factory=LoadSettings)
    season: SeasonSettings = field(default_factory=SeasonSettings)
    layers: Mapping[Layer, LayerMode] = field(default_factory=_default_layers)
    room_offsets: Mapping[Room, float] = field(default_factory=_default_room_offsets)
    timezone: str = "UTC"
    outdoor_stale_after_s: int = 21600


@dataclass(frozen=True)
class Snapshot:
    now: datetime
    t_out: float | None
    t_out_window_mean: float | None
    rooms: Mapping[Room, float | None]
    ac_available: Mapping[Room, bool]
    ac_hvac: Mapping[Room, str | None]
    ac_setpoint: Mapping[Room, float | None]
    boiler_available: bool
    boiler_call_on: bool | None
    boiler_setpoint: float | None
    boiler_rods_limit: int | None
    load_kw: float | None
    water_heater_on: bool | None


class ActionKind(StrEnum):
    BOILER_CALL = "boiler_call"
    BOILER_FLOW = "boiler_flow"
    BOILER_RODS = "boiler_rods"
    WATER_HEATER = "water_heater"
    AC_HVAC = "ac_hvac"
    AC_SETPOINT = "ac_setpoint"
    AC_QUIET = "ac_quiet"


@dataclass(frozen=True)
class Action:
    kind: ActionKind
    value: float | bool | str
    room: Room | None = None


def _empty_data() -> Mapping[str, float | str | bool]:
    return MappingProxyType({})


@dataclass(frozen=True)
class Reason:
    layer: Layer | Literal["season", "system"]
    code: str
    data: Mapping[str, float | str | bool] = field(default_factory=_empty_data)


@dataclass(frozen=True)
class Decision:
    actions: tuple[Action, ...]
    reasons: tuple[Reason, ...]
    flow_target: float | None
    zone: int
    target: float
    preset: Preset
    season_active: bool
