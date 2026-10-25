from __future__ import annotations

import probatio as vol
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.hybrid_heating.const import DOMAIN
from custom_components.hybrid_heating.core.types import Room
from tests.fakes import FAKE_ENTITIES

BOILER = (
    "boiler_call",
    "boiler_flow",
    "boiler_rods",
    "flow_temperature",
    "active_rods",
    "boiler_power",
    "total_power",
    "water_heater",
)
ROOMS = (
    "temp_living",
    "temp_bedroom",
    "temp_child",
    "temp_bath",
    "outdoor",
    "weather",
    "ac_living",
    "ac_bedroom",
)


def pick(keys, **extra):
    return {k: FAKE_ENTITIES[k] for k in keys} | extra


def defaults(r):
    return {str(k): k.default() for k in r["data_schema"].schema if k.default is not vol.UNDEFINED}


def suggested(r):
    return {str(k): (k.description or {}).get("suggested_value") for k in r["data_schema"].schema}


async def start(hass: HomeAssistant):
    return await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})


async def setup_entry(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, data=FAKE_ENTITIES)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_user_flow_creates_entry(hass, fake_home):
    r = await start(hass)
    assert r["type"] is FlowResultType.FORM and r["step_id"] == "user"
    assert defaults(r) == {}  # no entity ids are guessed
    r = await hass.config_entries.flow.async_configure(r["flow_id"], pick(BOILER))
    assert r["type"] is FlowResultType.FORM and r["step_id"] == "rooms" and defaults(r) == {}
    r = await hass.config_entries.flow.async_configure(
        r["flow_id"], pick(ROOMS, quiet_living="switch.living_ac_quiet")
    )
    assert r["step_id"] == "coexistence" and defaults(r) == {"disable_overpower_automation": False}
    r = await hass.config_entries.flow.async_configure(
        r["flow_id"],
        {"thermostat": "climate.thermostat", "overpower_automation": "automation.overpower_throttle"},
    )
    assert r["type"] is FlowResultType.CREATE_ENTRY and r["title"] == "Hybrid Heating"
    data = r["data"]
    assert data["boiler_flow"] == "climate.boiler" and data["disable_overpower_automation"] is False
    assert "quiet_bedroom" not in data and data["quiet_living"] == "switch.living_ac_quiet"
    assert data["overpower_automation"] == "automation.overpower_throttle"


async def test_missing_required_entity_errors(hass, fake_home):
    hass.states.async_remove("switch.boiler_heat_call")
    r = await start(hass)
    r = await hass.config_entries.flow.async_configure(r["flow_id"], pick(BOILER))
    assert r["type"] is FlowResultType.FORM and r["step_id"] == "user"
    assert r["errors"] == {"boiler_call": "entity_not_found"}
    assert suggested(r)["boiler_flow"] == "climate.boiler"  # the rest of the input is kept


async def test_missing_optional_entity_errors(hass, fake_home):
    r = await start(hass)
    r = await hass.config_entries.flow.async_configure(r["flow_id"], pick(BOILER))
    r = await hass.config_entries.flow.async_configure(r["flow_id"], pick(ROOMS, quiet_bedroom="switch.nope"))
    assert r["step_id"] == "rooms" and r["errors"] == {"quiet_bedroom": "entity_not_found"}


async def test_registry_only_disabled_entity_is_accepted(hass, fake_home):
    ent = er.async_get(hass).async_get_or_create(
        "switch", "gree", "quiet_x", disabled_by=er.RegistryEntryDisabler.INTEGRATION
    )
    assert hass.states.get(ent.entity_id) is None
    r = await start(hass)
    r = await hass.config_entries.flow.async_configure(r["flow_id"], pick(BOILER))
    r = await hass.config_entries.flow.async_configure(r["flow_id"], pick(ROOMS, quiet_bedroom=ent.entity_id))
    assert r["type"] is FlowResultType.FORM and r["step_id"] == "coexistence" and not r["errors"]


async def test_single_instance(hass, fake_home):
    MockConfigEntry(domain=DOMAIN, data=FAKE_ENTITIES).add_to_hass(hass)
    r = await start(hass)
    assert r["type"] is FlowResultType.ABORT and r["reason"] == "single_instance_allowed"


async def test_options_flow_changes_thermostat_and_reloads(hass, fake_home):
    entry = await setup_entry(hass)
    first = entry.runtime_data
    hass.states.async_set("climate.other", "heat", {"temperature": 21})

    r = await hass.config_entries.options.async_init(entry.entry_id)
    assert r["type"] is FlowResultType.FORM and r["step_id"] == "init"
    assert suggested(r)["boiler_call"] == "switch.boiler_heat_call"
    r = await hass.config_entries.options.async_configure(r["flow_id"], pick(BOILER))
    assert r["step_id"] == "rooms" and suggested(r)["quiet_bedroom"] == "switch.bedroom_ac_quiet"
    r = await hass.config_entries.options.async_configure(
        r["flow_id"],
        pick(ROOMS, quiet_living="switch.living_ac_quiet", quiet_bedroom="switch.bedroom_ac_quiet"),
    )
    assert r["step_id"] == "coexistence" and suggested(r)["thermostat"] == "climate.thermostat"
    r = await hass.config_entries.options.async_configure(
        r["flow_id"],
        {
            "thermostat": "climate.other",
            "overpower_automation": "automation.overpower_throttle",
            "disable_overpower_automation": True,
        },
    )
    assert r["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["thermostat"] == "climate.other"
    assert entry.options["disable_overpower_automation"] is True
    assert entry.state is ConfigEntryState.LOADED
    assert entry.runtime_data is not first and entry.runtime_data.entities.thermostat == "climate.other"


async def test_options_flow_can_clear_an_optional_entity(hass, fake_home):
    entry = await setup_entry(hass)
    r = await hass.config_entries.options.async_init(entry.entry_id)
    r = await hass.config_entries.options.async_configure(r["flow_id"], pick(BOILER))
    r = await hass.config_entries.options.async_configure(r["flow_id"], pick(ROOMS))  # quiet left empty
    r = await hass.config_entries.options.async_configure(r["flow_id"], {"thermostat": "climate.thermostat"})
    assert r["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.runtime_data.entities.quiet == {Room.LIVING: None, Room.BEDROOM: None}
    assert entry.runtime_data.entities.overpower_automation is None
