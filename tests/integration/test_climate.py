"""The thermostat entity: one tile for the module, wherever Home Assistant shows a thermostat."""

import re
from pathlib import Path

import pytest
from homeassistant.exceptions import ServiceValidationError

from custom_components.hybrid_heating.climate import TARGET_RANGES
from custom_components.hybrid_heating.core.types import Layer, Preset, SeasonMode
from tests.conftest import T0
from tests.fakes import CALL
from tests.integration.conftest import log_codes, setup_integration

EID = "climate.hybrid_heating"


def limits(s):
    return s.attributes["min_temp"], s.attributes["max_temp"], s.attributes["target_temp_step"]


async def climate(hass, service, **data):
    await hass.services.async_call("climate", service, {"entity_id": EID, **data}, blocking=True)
    await hass.async_block_till_done()
    return hass.states.get(EID)


def driver(c):
    reason = next(r for r in c.data.decision.reasons if r.layer is Layer.BOILER and "driver" in r.data)
    return reason.data["driver"]


async def test_the_thermostat_shows_the_module(hass, fake_home):
    c = (await setup_integration(hass)).runtime_data
    s = hass.states.get(EID)
    assert s.state == "auto" and s.attributes["friendly_name"] == "Hybrid Heating"
    assert s.attributes["hvac_modes"] == ["auto", "heat", "off"]
    assert s.attributes["preset_modes"] == ["comfort", "eco", "night", "away"]
    assert s.attributes["preset_mode"] == "comfort" and s.attributes["effective_preset"] == "comfort"
    assert s.attributes["temperature"] == 23.0
    assert s.attributes["current_temperature"] == driver(c)  # what the boiler follows
    assert limits(s) == (18, 26, 0.1)
    assert s.attributes["hvac_action"] == "idle" and s.attributes["observe"] is True


async def test_moving_the_target_changes_the_preset_for_good(hass, fake_home):
    c = (await setup_integration(hass)).runtime_data
    s = await climate(hass, "set_temperature", temperature=22.4)
    assert c.settings.targets.comfort == 22.4 and s.attributes["temperature"] == 22.4
    assert c.settings.targets.eco == 21.5  # only the preset in effect
    assert "settings_changed" in log_codes(c)
    s = await climate(hass, "set_preset_mode", preset_mode="away")
    assert c.settings.preset is Preset.AWAY and s.attributes["temperature"] == 16.0
    assert limits(s) == (10, 20, 0.5)
    s = await climate(hass, "set_temperature", temperature=17.3)  # Away moves in half degrees
    assert c.settings.targets.away == 17.5 and s.attributes["temperature"] == 17.5
    with pytest.raises(ServiceValidationError):
        await climate(hass, "set_temperature", temperature=24)
    assert c.settings.targets.away == 17.5


async def test_inside_the_night_window_comfort_moves_the_night_target(hass, fake_home, frozen_now):
    c = (await setup_integration(hass)).runtime_data
    frozen_now.move_to(T0.replace(hour=23))
    await c.async_refresh()
    s = hass.states.get(EID)
    assert s.attributes["preset_mode"] == "comfort" and s.attributes["effective_preset"] == "night"
    s = await climate(hass, "set_temperature", temperature=21.8)
    assert c.settings.targets.night == 21.8 and c.settings.targets.comfort == 23.0
    assert s.attributes["temperature"] == 21.8


async def test_the_modes_are_the_heating_season(hass, fake_home):
    c = (await setup_integration(hass)).runtime_data
    s = await climate(hass, "set_hvac_mode", hvac_mode="off")
    assert c.settings.season.mode is SeasonMode.OFF and s.state == "off"
    assert s.attributes["hvac_action"] == "off"
    assert s.attributes["current_temperature"] is not None  # still shown while the module idles
    assert c.enabled  # Off keeps the module in charge: disabling it would hand the boiler back
    s = await climate(hass, "set_hvac_mode", hvac_mode="heat")
    assert c.settings.season.mode is SeasonMode.ON and s.state == "heat"
    s = await climate(hass, "turn_off")
    assert s.state == "off"
    s = await climate(hass, "turn_on")
    assert c.settings.season.mode is SeasonMode.AUTO and s.state == "auto"
    s = await climate(hass, "set_temperature", temperature=22.0, hvac_mode="heat")
    assert c.settings.season.mode is SeasonMode.ON and c.settings.targets.comfort == 22.0


async def test_heating_shows_while_the_boiler_heats(hass, fake_home):
    c = (await setup_integration(hass)).runtime_data
    hass.states.async_set(CALL, "on")
    await c.async_refresh()
    assert hass.states.get(EID).attributes["hvac_action"] == "heating"


def test_the_target_ranges_are_the_cards():
    ts = Path("frontend/src/logic/steppers.ts").read_text(encoding="utf-8")
    for preset, (low, high, step) in TARGET_RANGES.items():
        m = re.search(rf"'targets\.{preset}': \{{ min: ([\d.]+), max: ([\d.]+), step: ([\d.]+) \}}", ts)
        assert m and tuple(map(float, m.groups())) == (low, high, step), preset
