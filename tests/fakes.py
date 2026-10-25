"""A made-up home for tests: generic entity ids, no real installation."""

from __future__ import annotations

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
