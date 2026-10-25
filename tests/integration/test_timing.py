from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import Context, CoreState

from custom_components.hybrid_heating.core.controller import tick
from custom_components.hybrid_heating.core.types import Layer, LayerMode
from tests.integration.conftest import log_codes, setup_integration, step

TOTAL = "sensor.mains_power"
TH = "climate.thermostat"
AUT = "automation.overpower_throttle"
CALL = "switch.boiler_heat_call"
WH = "switch.water_heater"
RESTORE_TH = ("climate", "set_temperature", {"entity_id": TH, "temperature": 22.5, "hvac_mode": "heat"})
TAKEN = {"thermostat_prev": {"hvac_mode": "heat", "temperature": 22.5}}


async def test_observe_overload_is_logged_within_seconds(hass, fake_home, calls, freezer):
    c = (await setup_integration(hass)).runtime_data
    assert c.update_interval == timedelta(seconds=60)
    hass.states.async_set(TOTAL, "8300", {"unit_of_measurement": "W"})
    await hass.async_block_till_done()
    assert c.update_interval == timedelta(seconds=5)
    await step(freezer, hass, 6)
    shed = [r for e in c.log.latest(20) for r in e["reasons"] if r["code"] == "shed_water_heater"]
    assert shed and shed[0]["data"]["observe"] is True and calls.log == []


async def test_fast_ticks_end_when_load_is_back_to_normal(hass, fake_home, freezer):
    c = (await setup_integration(hass)).runtime_data
    hass.states.async_set(TOTAL, "8300", {"unit_of_measurement": "W"})
    await hass.async_block_till_done()
    await step(freezer, hass, 6)
    hass.states.async_set(TOTAL, "1300", {"unit_of_measurement": "W"})
    await hass.async_block_till_done()
    for _ in range(6):  # the observed pause runs out after 20 s
        await step(freezer, hass, 6)
    assert c.update_interval == timedelta(seconds=60)


async def test_state_changes_are_debounced(hass, fake_home, freezer):
    await setup_integration(hass)
    with patch("custom_components.hybrid_heating.coordinator.tick", wraps=tick) as spy:
        for v in ("on", "off", "on"):
            hass.states.async_set(CALL, v)
        await hass.async_block_till_done()
        await step(freezer, hass, 6)
        assert spy.call_count == 2
        spy.reset_mock()
        hass.states.async_set(TOTAL, "2500", {"unit_of_measurement": "W"})
        await hass.async_block_till_done()
        await step(freezer, hass, 6)
        assert spy.call_count == 0


async def test_own_changes_do_not_trigger_a_tick(hass, fake_home, freezer):
    c = (await setup_integration(hass)).runtime_data
    with patch("custom_components.hybrid_heating.coordinator.tick", wraps=tick) as spy:
        ctx = Context()
        c.remember_context(ctx)
        hass.states.async_set(CALL, "on", context=ctx)
        await hass.async_block_till_done()
        await step(freezer, hass, 6)
        assert spy.call_count == 0


async def test_constant_overload_sheds_after_five_seconds(hass, fake_home, calls, stored, freezer):
    stored(settings={"layers": {"load": "active"}})
    c = (await setup_integration(hass)).runtime_data
    calls.clear()
    hass.states.async_set(TOTAL, "8300", {"unit_of_measurement": "W"})
    await hass.async_block_till_done()
    assert c.update_interval == timedelta(seconds=5)
    await step(freezer, hass, 6)
    assert ("switch", "turn_off", {"entity_id": WH}) in calls.log


async def test_no_actions_during_startup_grace(hass, fake_home, calls, stored, freezer):
    stored(settings={"layers": {"boiler": "active"}})
    hass.set_state(CoreState.starting)
    c = (await setup_integration(hass)).runtime_data
    assert calls.log == [] and c.data.decision is None and c.data.status == "Starting"
    hass.set_state(CoreState.running)
    hass.bus.async_fire(EVENT_HOMEASSISTANT_STARTED)
    await hass.async_block_till_done()
    await step(freezer, hass, 30)
    assert calls.log == []
    await step(freezer, hass, 35)
    assert ("climate", "set_hvac_mode", {"entity_id": TH, "hvac_mode": "off"}) in calls.log


async def test_user_turning_thermostat_on_hands_boiler_back(hass, fake_home, calls, stored):
    stored(settings={"layers": {"boiler": "active"}}, takeover=TAKEN)
    hass.states.async_set(TH, "off", {"temperature": 22.5})
    c = (await setup_integration(hass)).runtime_data
    calls.clear()
    hass.states.async_set(TH, "heat", {"temperature": 21.0}, context=Context())
    await hass.async_block_till_done()
    assert c.settings.layers[Layer.BOILER] is LayerMode.OBSERVE and c.takeover.thermostat_prev is None
    assert not any(d["entity_id"] == TH for *_, d in calls.log)
    assert "thermostat_user_override" in log_codes(c)


async def test_own_thermostat_change_is_not_override(hass, fake_home, stored):
    stored(settings={"layers": {"boiler": "active"}}, takeover=TAKEN)
    hass.states.async_set(TH, "off", {"temperature": 22.5})
    c = (await setup_integration(hass)).runtime_data
    ctx = Context()
    c.remember_context(ctx)
    hass.states.async_set(TH, "heat", {"temperature": 22.5}, context=ctx)
    await hass.async_block_till_done()
    assert c.takeover.thermostat_prev is not None and c.settings.layers[Layer.BOILER] is LayerMode.ACTIVE


async def test_user_turning_automation_back_on_is_respected(hass, fake_home, calls, stored):
    stored(settings={"layers": {"load": "active"}})
    c = (await setup_integration(hass, disable_overpower_automation=True)).runtime_data
    assert c.takeover.automation_disabled
    hass.states.async_set(AUT, "off")
    await hass.async_block_till_done()
    calls.clear()
    hass.states.async_set(AUT, "on", context=Context())
    await hass.async_block_till_done()
    assert not c.takeover.automation_disabled and c.settings.layers[Layer.LOAD] is LayerMode.ACTIVE
    assert "automation_user_override" in log_codes(c)
    assert not any(d["entity_id"] == AUT for *_, d in calls.log)


async def test_failsafe_after_five_failed_ticks(hass, fake_home, calls, stored, freezer):
    stored(settings={"layers": {"boiler": "active"}})
    c = (await setup_integration(hass)).runtime_data
    calls.clear()
    with patch("custom_components.hybrid_heating.coordinator.tick", side_effect=RuntimeError("bug")):
        for _ in range(4):
            await step(freezer, hass, 60)
        assert c.enabled is True
        await step(freezer, hass, 60)
    assert c.enabled is False and "failsafe_released" in log_codes(c) and "tick_failed" in log_codes(c)
    assert RESTORE_TH in calls.log


async def test_a_good_tick_resets_the_failure_count(hass, fake_home, stored, freezer):
    stored(settings={"layers": {"boiler": "active"}})
    c = (await setup_integration(hass)).runtime_data
    with patch("custom_components.hybrid_heating.coordinator.tick", side_effect=RuntimeError("bug")):
        for _ in range(4):
            await step(freezer, hass, 60)
    await step(freezer, hass, 60)
    with patch("custom_components.hybrid_heating.coordinator.tick", side_effect=RuntimeError("bug")):
        for _ in range(4):
            await step(freezer, hass, 60)
    assert c.enabled is True


async def test_ticks_every_minute_even_without_entity_listeners(hass, fake_home, freezer):
    await setup_integration(hass)
    with patch("custom_components.hybrid_heating.coordinator.tick", wraps=tick) as spy:
        await step(freezer, hass, 61)
        await step(freezer, hass, 61)
        assert spy.call_count == 2
