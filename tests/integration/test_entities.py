from __future__ import annotations

from custom_components.hybrid_heating.core.types import BoilerMode, Preset
from tests.integration.conftest import log_codes, setup_integration

IDS = (
    "switch.hybrid_heating_enabled",
    "switch.hybrid_heating_hybrid_mode",
    "select.hybrid_heating_preset",
    "select.hybrid_heating_boiler_mode",
    "sensor.hybrid_heating_flow_target",
    "sensor.hybrid_heating_zone",
    "sensor.hybrid_heating_status",
    "sensor.hybrid_heating_heat_loss",
    "binary_sensor.hybrid_heating_boiler_call",
    "binary_sensor.hybrid_heating_load_shedding",
)


async def test_entity_ids_follow_spec(hass, fake_home):
    await setup_integration(hass)
    for eid in IDS:
        assert hass.states.get(eid) is not None, eid
    assert hass.states.get("switch.hybrid_heating_hybrid_mode").attributes["friendly_name"] == (
        "Hybrid Heating Hybrid mode"
    )


async def test_sensors_now_scenario(hass, fake_home):
    await setup_integration(hass)
    flow = hass.states.get("sensor.hybrid_heating_flow_target")
    assert 32.0 <= float(flow.state) <= 37.0
    assert flow.attributes["boiler_setpoint"] == 50.0 and flow.attributes["observe"] is True
    z = hass.states.get("sensor.hybrid_heating_zone")
    assert z.state == "warm" and z.attributes["index"] == 0
    status = hass.states.get("sensor.hybrid_heating_status")
    assert status.state.startswith("Observe · Warm · Comfort 23.0° · ")
    assert "season_started" in status.attributes["codes"]
    assert hass.states.get("sensor.hybrid_heating_heat_loss").state == "150.0"
    b = hass.states.get("binary_sensor.hybrid_heating_boiler_call")
    assert b.state == "on" and b.attributes["actual"] is False and b.attributes["observe"] is True
    shed = hass.states.get("binary_sensor.hybrid_heating_load_shedding")
    assert shed.state == "off" and shed.attributes["observe"] is True and shed.attributes["load_kw"] == 1.3
    assert hass.states.get("switch.hybrid_heating_enabled").state == "on"
    assert hass.states.get("switch.hybrid_heating_hybrid_mode").state == "on"


async def test_preset_and_boiler_mode_selects(hass, fake_home):
    c = (await setup_integration(hass)).runtime_data
    preset = hass.states.get("select.hybrid_heating_preset")
    assert preset.attributes["options"] == ["comfort", "eco", "night", "away"] and preset.state == "comfort"
    assert preset.attributes["effective_preset"] == "comfort" and preset.attributes["target"] == 23.0
    await hass.services.async_call(
        "select",
        "select_option",
        {"entity_id": "select.hybrid_heating_preset", "option": "away"},
        blocking=True,
    )
    await hass.services.async_call(
        "select",
        "select_option",
        {"entity_id": "select.hybrid_heating_boiler_mode", "option": "classic"},
        blocking=True,
    )
    assert c.settings.preset is Preset.AWAY and c.settings.boiler.mode is BoilerMode.CLASSIC
    assert "settings_changed" in log_codes(c)
    assert hass.states.get("select.hybrid_heating_preset").state == "away"
    assert hass.states.get("select.hybrid_heating_boiler_mode").state == "classic"


async def test_hybrid_switch_and_enabled_switch(hass, fake_home):
    c = (await setup_integration(hass)).runtime_data
    await hass.services.async_call(
        "switch", "turn_off", {"entity_id": "switch.hybrid_heating_hybrid_mode"}, blocking=True
    )
    assert c.settings.hybrid is False and hass.states.get("switch.hybrid_heating_hybrid_mode").state == "off"
    await hass.services.async_call(
        "switch", "turn_off", {"entity_id": "switch.hybrid_heating_enabled"}, blocking=True
    )
    await hass.async_block_till_done()
    assert c.enabled is False and hass.states.get("sensor.hybrid_heating_status").state == "Disabled"
    assert hass.states.get("switch.hybrid_heating_enabled").state == "off"
    await hass.services.async_call(
        "switch", "turn_on", {"entity_id": "switch.hybrid_heating_enabled"}, blocking=True
    )
    await hass.async_block_till_done()
    assert c.enabled is True and hass.states.get("switch.hybrid_heating_enabled").state == "on"


async def test_russian_status_text(hass, fake_home):
    hass.config.language = "ru"
    await setup_integration(hass)
    assert hass.states.get("sensor.hybrid_heating_status").state.startswith(
        "Наблюдение · Тепло · Комфорт 23,0° · "
    )
