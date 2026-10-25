"""A made-up home for tests: generic entity ids, no real installation."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from custom_components.hybrid_heating.core.types import Room
from custom_components.hybrid_heating.entity_map import EntityMap


@dataclass(frozen=True)
class S:
    """A minimal stand-in for a Home Assistant State."""

    state: str
    attributes: Mapping[str, Any] = field(default_factory=dict)


def st(state: str, **attributes: Any) -> S:
    return S(state, attributes)


FAKE_ENTITIES: dict[str, str | bool] = {
    "boiler_call": "switch.boiler_heat_call",
    "boiler_flow": "climate.boiler",
    "boiler_rods": "number.boiler_max_rods",
    "flow_temperature": "sensor.boiler_flow_temperature",
    "active_rods": "sensor.boiler_active_rods",
    "boiler_power": "sensor.boiler_power",
    "total_power": "sensor.mains_power",
    "water_heater": "switch.water_heater",
    "temp_living": "sensor.living_temperature",
    "temp_bedroom": "sensor.bedroom_temperature",
    "temp_child": "sensor.child_temperature",
    "temp_bath": "sensor.bath_temperature",
    "outdoor": "sensor.outdoor_temperature",
    "weather": "weather.home",
    "ac_living": "climate.living_ac",
    "ac_bedroom": "climate.bedroom_ac",
    "quiet_living": "switch.living_ac_quiet",
    "quiet_bedroom": "switch.bedroom_ac_quiet",
    "thermostat": "climate.thermostat",
    "overpower_automation": "automation.overpower_throttle",
    "disable_overpower_automation": False,
}
FAKE_MAP = EntityMap.from_mapping(FAKE_ENTITIES)

# The devices tests talk about most
TH = FAKE_MAP.thermostat
BOILER = FAKE_MAP.boiler_flow
RODS = FAKE_MAP.boiler_rods
CALL = FAKE_MAP.boiler_call
WH = FAKE_MAP.water_heater
TOTAL = FAKE_MAP.total_power
AUT = "automation.overpower_throttle"


def fake_entities(*without: str) -> dict[str, str | bool]:
    """The fake entity map minus some keys (e.g. an optional entity not configured)."""
    return {k: v for k, v in FAKE_ENTITIES.items() if k not in without}


def _now_states() -> dict[str, S]:
    """The "now" scenario: a mild evening, ACs off, boiler idle with 2 rods."""
    e = FAKE_MAP
    return {
        e.outdoor: st("13.8"),
        e.rooms[Room.LIVING]: st("23.3"),
        e.rooms[Room.BEDROOM]: st("22.8"),
        e.rooms[Room.CHILD]: st("22.6"),
        e.rooms[Room.BATH]: st("23.4"),
        e.acs[Room.LIVING]: st("off", temperature=24, fan_mode="auto"),
        e.acs[Room.BEDROOM]: st("off", temperature=25, fan_mode="auto"),
        e.boiler_flow: st("heat", temperature=50, target_temp_step=1, min_temp=20, max_temp=80),
        e.boiler_rods: st("2"),
        e.flow_temperature: st("48.5"),
        e.active_rods: st("0"),
        e.boiler_power: st("0", unit_of_measurement="W"),
        e.total_power: st("1300", unit_of_measurement="W"),
        e.boiler_call: st("off"),
        e.water_heater: st("on"),
        e.thermostat: st("heat", temperature=22.5),
        AUT: st("on"),
        e.weather: st("cloudy"),
        "switch.living_ac_quiet": st("off"),
        "switch.bedroom_ac_quiet": st("off"),
    }


NOW_STATES: Mapping[str, S] = _now_states()


def now_view() -> dict[str, S]:
    return dict(NOW_STATES)
