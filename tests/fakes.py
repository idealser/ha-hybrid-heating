"""A made-up home for tests: generic entity ids, no real installation."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any


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


def _now_states() -> dict[str, S]:
    """The "now" scenario: a mild evening, ACs off, boiler idle with 2 rods."""
    e = FAKE_ENTITIES
    raw: dict[str | bool, S] = {
        e["outdoor"]: st("13.8"),
        e["temp_living"]: st("23.3"),
        e["temp_bedroom"]: st("22.8"),
        e["temp_child"]: st("22.6"),
        e["temp_bath"]: st("23.4"),
        e["ac_living"]: st("off", temperature=24, fan_mode="auto"),
        e["ac_bedroom"]: st("off", temperature=25, fan_mode="auto"),
        e["boiler_flow"]: st("heat", temperature=50, target_temp_step=1, min_temp=20, max_temp=80),
        e["boiler_rods"]: st("2"),
        e["flow_temperature"]: st("48.5"),
        e["active_rods"]: st("0"),
        e["boiler_power"]: st("0", unit_of_measurement="W"),
        e["total_power"]: st("1300", unit_of_measurement="W"),
        e["boiler_call"]: st("off"),
        e["water_heater"]: st("on"),
        e["thermostat"]: st("heat", temperature=22.5),
        e["overpower_automation"]: st("on"),
        e["weather"]: st("cloudy"),
        e["quiet_living"]: st("off"),
        e["quiet_bedroom"]: st("off"),
    }
    return {str(k): v for k, v in raw.items()}


NOW_STATES: Mapping[str, S] = _now_states()


def now_view() -> dict[str, S]:
    return dict(NOW_STATES)
