from __future__ import annotations

import pytest

from custom_components.hybrid_heating.const import OPTIONAL_KEYS
from custom_components.hybrid_heating.core.types import Room
from custom_components.hybrid_heating.entity_map import EntityMap
from tests.fakes import FAKE_ENTITIES


def test_from_mapping_reads_every_key():
    e = EntityMap.from_mapping(FAKE_ENTITIES)
    assert e.boiler_call == "switch.boiler_heat_call" and e.boiler_flow == "climate.boiler"
    assert e.boiler_rods == "number.boiler_max_rods"
    assert e.rooms == {
        Room.LIVING: "sensor.living_temperature",
        Room.BEDROOM: "sensor.bedroom_temperature",
        Room.CHILD: "sensor.child_temperature",
        Room.BATH: "sensor.bath_temperature",
    }
    assert e.acs == {Room.LIVING: "climate.living_ac", Room.BEDROOM: "climate.bedroom_ac"}
    assert e.quiet == {Room.LIVING: "switch.living_ac_quiet", Room.BEDROOM: "switch.bedroom_ac_quiet"}
    assert e.total_power == "sensor.mains_power" and e.water_heater == "switch.water_heater"
    assert e.thermostat == "climate.thermostat" and e.disable_overpower_automation is False
    assert e.overpower_automation == "automation.overpower_throttle"


def test_optional_keys_missing_are_none():
    e = EntityMap.from_mapping({k: v for k, v in FAKE_ENTITIES.items() if k not in OPTIONAL_KEYS})
    assert e.quiet == {Room.LIVING: None, Room.BEDROOM: None} and e.overpower_automation is None


def test_missing_required_key_raises():
    with pytest.raises(KeyError):
        EntityMap.from_mapping({k: v for k, v in FAKE_ENTITIES.items() if k != "boiler_call"})


def test_options_override_data():
    e = EntityMap.from_entry_dicts(FAKE_ENTITIES, {"thermostat": "climate.other"})
    assert e.thermostat == "climate.other" and e.boiler_call == "switch.boiler_heat_call"


def test_to_mapping_round_trips():
    assert EntityMap.from_mapping(FAKE_ENTITIES).to_mapping() == FAKE_ENTITIES
    m = {k: v for k, v in FAKE_ENTITIES.items() if k not in OPTIONAL_KEYS}
    assert EntityMap.from_mapping(EntityMap.from_mapping(m).to_mapping()) == EntityMap.from_mapping(m)


def test_trigger_ids():
    e = EntityMap.from_mapping(FAKE_ENTITIES)
    assert e.trigger_ids() == [
        "sensor.mains_power",
        "switch.boiler_heat_call",
        "switch.water_heater",
        "climate.boiler",
        "number.boiler_max_rods",
        "climate.thermostat",
        "climate.living_ac",
        "climate.bedroom_ac",
        "automation.overpower_throttle",
    ]
    no_auto = EntityMap.from_mapping({k: v for k, v in FAKE_ENTITIES.items() if k != "overpower_automation"})
    assert "automation.overpower_throttle" not in no_auto.trigger_ids()
