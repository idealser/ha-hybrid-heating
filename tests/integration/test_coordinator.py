import pytest

from custom_components.hybrid_heating.core.types import Layer, LayerMode
from custom_components.hybrid_heating.takeover import ThermostatPrev
from tests.fakes import AUT, BOILER, CALL
from tests.integration.conftest import (
    ACTIVE_ALL,
    LOG_KEY,
    STORE_KEY,
    THERMOSTAT_OFF,
    log_codes,
    log_reasons,
    setup_integration,
)


async def test_observe_default_makes_no_service_calls(hass, fake_home, calls):
    entry = await setup_integration(hass)
    c = entry.runtime_data
    assert calls.log == [] and c.enabled is True and c.data.decision is not None
    assert all(mode is LayerMode.OBSERVE for mode in c.settings.layers.values())
    assert "season_started" in log_codes(c)
    assert c.data.status.startswith("Observe · Warm · Comfort 23.0°")


async def test_active_now_scenario_executes_through_services(hass, fake_home, calls, stored):
    stored(settings=ACTIVE_ALL)
    entry = await setup_integration(hass)
    assert calls.log[0] == THERMOSTAT_OFF
    assert ("switch", "turn_on", {"entity_id": CALL}) in calls.log
    flow = [d["temperature"] for _, _, d in calls.log if d["entity_id"] == BOILER]
    assert len(flow) == 1 and 32.0 <= flow[0] <= 37.0
    for ac in ("climate.living_ac", "climate.bedroom_ac"):
        assert ("climate", "set_hvac_mode", {"entity_id": ac, "hvac_mode": "heat"}) in calls.log
    assert not any(d["entity_id"] == AUT for *_, d in calls.log)
    c = entry.runtime_data
    assert "automation_still_enabled" in log_codes(c)
    assert all(o.status == "ok" for o in c.data.outcomes) and c.data.outcomes
    assert len(set(calls.contexts)) == 2  # one context for the takeover, one for the tick
    assert all(c.is_own(ctx) for ctx in calls.contexts)


async def test_boiler_active_ac_observe_no_background_shift(hass, fake_home, calls, stored):
    stored(settings={"layers": {"boiler": "active"}})
    entry = await setup_integration(hass)
    flow = [d["temperature"] for _, _, d in calls.log if d["entity_id"] == BOILER]
    # curve(13.8) = 35.3 on the 9-point curve; ACs are off, so no 3° background shift (that would be ~33)
    assert flow and flow[0] >= 35.0
    assert entry.runtime_data.settings.layers[Layer.AC] is LayerMode.OBSERVE


async def test_state_saved_to_store(hass, fake_home, hass_storage):
    entry = await setup_integration(hass)
    await entry.runtime_data.async_flush()
    data = hass_storage[STORE_KEY]["data"]
    assert data["enabled"] is True and data["settings"]["layers"]["boiler"] == "observe"
    assert "boiler" in data["controller"] and "shadow_load" in data["controller"]
    assert data["takeover"]["thermostat_prev"] is None and data["window"] and data["saved_at"]
    assert len(hass_storage[LOG_KEY]["data"]["entries"]) >= 1


async def test_patch_settings_merges_logs_and_rejects_bad(hass, fake_home, calls):
    c = (await setup_integration(hass)).runtime_data
    s = await c.async_patch_settings({"targets": {"comfort": 22.0}}, source="ws")
    assert s.targets.comfort == 22.0 and c.settings is s
    assert "settings_changed" in log_codes(c)
    assert log_reasons(c, "settings_changed")[-1]["data"] == {"keys": "targets", "source": "ws"}
    with pytest.raises(ValueError):
        await c.async_patch_settings({"layers": {"boiler": "turbo"}}, source="ws")
    assert c.settings is s


async def test_patch_to_active_takes_over_at_once(hass, fake_home, calls):
    c = (await setup_integration(hass)).runtime_data
    await c.async_patch_settings({"layers": {"boiler": "active"}}, source="ws")
    assert calls.log[0] == THERMOSTAT_OFF
    assert c.takeover.thermostat_prev == ThermostatPrev("heat", 22.5)
