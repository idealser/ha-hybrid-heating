"""Which Home Assistant entities the module reads and drives, as chosen in the setup wizard."""

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Self

from .const import (
    CONF_AC_BEDROOM,
    CONF_AC_LIVING,
    CONF_ACTIVE_RODS,
    CONF_BOILER_CALL,
    CONF_BOILER_FLOW,
    CONF_BOILER_POWER,
    CONF_BOILER_RODS,
    CONF_DISABLE_OVERPOWER_AUTOMATION,
    CONF_FLOW_TEMPERATURE,
    CONF_OUTDOOR,
    CONF_OVERPOWER_AUTOMATION,
    CONF_QUIET_BEDROOM,
    CONF_QUIET_LIVING,
    CONF_TEMP_BATH,
    CONF_TEMP_BEDROOM,
    CONF_TEMP_CHILD,
    CONF_TEMP_LIVING,
    CONF_THERMOSTAT,
    CONF_TOTAL_POWER,
    CONF_WATER_HEATER,
    CONF_WEATHER,
)
from .core.types import Room

ROOM_KEYS: Mapping[Room, str] = MappingProxyType(
    {
        Room.LIVING: CONF_TEMP_LIVING,
        Room.BEDROOM: CONF_TEMP_BEDROOM,
        Room.CHILD: CONF_TEMP_CHILD,
        Room.BATH: CONF_TEMP_BATH,
    }
)
AC_KEYS: Mapping[Room, str] = MappingProxyType({Room.LIVING: CONF_AC_LIVING, Room.BEDROOM: CONF_AC_BEDROOM})
QUIET_KEYS: Mapping[Room, str] = MappingProxyType(
    {Room.LIVING: CONF_QUIET_LIVING, Room.BEDROOM: CONF_QUIET_BEDROOM}
)


# Required single entities; each field is named exactly like its config key.
SINGLE_KEYS = (
    CONF_BOILER_CALL,
    CONF_BOILER_FLOW,
    CONF_BOILER_RODS,
    CONF_FLOW_TEMPERATURE,
    CONF_ACTIVE_RODS,
    CONF_BOILER_POWER,
    CONF_TOTAL_POWER,
    CONF_WATER_HEATER,
    CONF_THERMOSTAT,
    CONF_OUTDOOR,
    CONF_WEATHER,
)


@dataclass(frozen=True)
class EntityMap:
    boiler_call: str
    boiler_flow: str
    boiler_rods: str
    flow_temperature: str
    active_rods: str
    boiler_power: str
    total_power: str
    water_heater: str
    thermostat: str
    outdoor: str
    weather: str
    rooms: Mapping[Room, str]
    acs: Mapping[Room, str]
    quiet: Mapping[Room, str | None]
    overpower_automation: str | None
    disable_overpower_automation: bool

    @classmethod
    def from_mapping(cls, m: Mapping[str, Any]) -> Self:
        """Build from config entry data. A missing optional key is None; a missing required one raises."""
        return cls(
            **{key: m[key] for key in SINGLE_KEYS},
            rooms=MappingProxyType({room: m[key] for room, key in ROOM_KEYS.items()}),
            acs=MappingProxyType({room: m[key] for room, key in AC_KEYS.items()}),
            quiet=MappingProxyType({room: m.get(key) or None for room, key in QUIET_KEYS.items()}),
            overpower_automation=m.get(CONF_OVERPOWER_AUTOMATION) or None,
            disable_overpower_automation=bool(m.get(CONF_DISABLE_OVERPOWER_AUTOMATION, False)),
        )

    @classmethod
    def from_entry_dicts(cls, data: Mapping[str, Any], options: Mapping[str, Any]) -> Self:
        return cls.from_mapping({**data, **options})

    def to_mapping(self) -> dict[str, Any]:
        """Inverse of from_mapping; optional keys without an entity are left out."""
        out: dict[str, Any] = {key: getattr(self, key) for key in SINGLE_KEYS}
        out[CONF_DISABLE_OVERPOWER_AUTOMATION] = self.disable_overpower_automation
        out |= {key: self.rooms[room] for room, key in ROOM_KEYS.items()}
        out |= {key: self.acs[room] for room, key in AC_KEYS.items()}
        out |= {key: q for room, key in QUIET_KEYS.items() if (q := self.quiet[room]) is not None}
        if self.overpower_automation is not None:
            out[CONF_OVERPOWER_AUTOMATION] = self.overpower_automation
        return out

    def trigger_ids(self) -> list[str]:
        """Entities whose changes should wake the controller."""
        ids = [
            self.total_power,
            self.boiler_call,
            self.water_heater,
            self.boiler_flow,
            self.boiler_rods,
            self.thermostat,
            *self.acs.values(),
        ]
        if self.overpower_automation is not None:
            ids.append(self.overpower_automation)
        return ids
