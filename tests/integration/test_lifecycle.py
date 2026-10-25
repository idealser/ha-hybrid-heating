from __future__ import annotations

import pytest

from custom_components.hybrid_heating.core.types import Settings
from tests.integration.conftest import ENTRY_ID, log_codes, setup_integration

BOILER = "climate.boiler"
TH = "climate.thermostat"
AUT = "automation.overpower_throttle"
RESTORE_TH = ("climate", "set_temperature", {"entity_id": TH, "temperature": 22.5, "hvac_mode": "heat"})


async def test_unload_restores_thermostat_and_automation(hass, fake_home, calls, stored):
    stored(settings={"layers": {"boiler": "active", "load": "active"}})
    entry = await setup_integration(hass, disable_overpower_automation=True)
    assert ("automation", "turn_off", {"entity_id": AUT}) in calls.log
    c = entry.runtime_data  # Home Assistant drops runtime_data on unload
    calls.clear()
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert RESTORE_TH in calls.log
    assert ("automation", "turn_on", {"entity_id": AUT}) in calls.log
    assert "module_disabled" in log_codes(c)


async def test_restart_restores_state_without_retaking(hass, fake_home, calls, stored):
    stored(
        settings={"layers": {"boiler": "active"}},
        controller={
            "boiler": {"integral": 0.4, "writes_today": 7, "writes_day": "2026-11-01", "call": True},
            "load": {"over_since": "2026-11-01T14:59:00+01:00", "rods_shed": 1},
        },
        takeover={
            "thermostat_prev": {"hvac_mode": "heat", "temperature": 22.5},
            "boiler_prev": {"flow": 50.0, "rods": 3},
        },
        saved_at="2026-11-01T14:58:00+01:00",
    )
    hass.states.async_set(TH, "off", {"temperature": 22.5})
    c = (await setup_integration(hass)).runtime_data
    assert c.state.boiler.integral == pytest.approx(0.4, abs=0.05) and c.state.boiler.writes_today in (7, 8)
    assert c.state.load.rods_shed == 1 and c.state.load.over_since is None
    assert c.takeover.thermostat_prev == {"hvac_mode": "heat", "temperature": 22.5}
    assert not any(d["entity_id"] == TH for *_, d in calls.log)
    assert "restored_after_restart" in log_codes(c)
    restored = next(r for e in c.log.to_data() for r in e["reasons"] if r["code"] == "restored_after_restart")
    assert restored["data"]["saved_at"] == "2026-11-01T14:58:00+01:00"


async def test_reload_restores_boiler_and_counts_writes(hass, fake_home, calls, stored):
    stored(settings={"layers": {"boiler": "active"}})
    entry = await setup_integration(hass)
    hass.states.async_set(
        BOILER, "heat", {"temperature": 33.0, "target_temp_step": 1, "min_temp": 20, "max_temp": 80}
    )
    w0 = entry.runtime_data.state.boiler.writes_today
    calls.clear()
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert ("climate", "set_temperature", {"entity_id": BOILER, "temperature": 50.0}) in calls.log
    assert entry.runtime_data.state.boiler.writes_today >= w0 + 1


async def test_corrupt_section_resets_only_that_section(hass, fake_home, calls, stored):
    # The settings fall back to the defaults (all layers observe), so the thermostat is given back at once,
    # with the values from the takeover section: that section survived.
    stored(
        settings={"layers": {"boiler": "turbo"}},
        takeover={"thermostat_prev": {"hvac_mode": "heat", "temperature": 21.5}},
    )
    c = (await setup_integration(hass)).runtime_data
    assert c.settings == Settings()
    assert (
        "climate",
        "set_temperature",
        {"entity_id": TH, "temperature": 21.5, "hvac_mode": "heat"},
    ) in calls.log
    resets = [r["data"] for e in c.log.to_data() for r in e["reasons"] if r["code"] == "store_section_reset"]
    assert resets == [{"section": "settings"}]


async def test_set_enabled_false_releases_and_stops(hass, fake_home, calls, stored):
    stored(settings={"layers": {"boiler": "active"}})
    c = (await setup_integration(hass)).runtime_data
    calls.clear()
    await c.async_set_enabled(False)
    assert RESTORE_TH in calls.log
    assert c.data.decision is None and c.data.status == "Disabled" and c.enabled is False
    calls.clear()
    await c.async_refresh()
    assert calls.log == []
    await c.async_set_enabled(True)
    assert ("climate", "set_hvac_mode", {"entity_id": TH, "hvac_mode": "off"}) in calls.log
    assert "module_enabled" in log_codes(c)


async def test_disabled_survives_restart(hass, fake_home, calls, stored):
    stored(enabled=False, settings={"layers": {"boiler": "active"}})
    c = (await setup_integration(hass)).runtime_data
    assert c.enabled is False and calls.log == [] and c.data.status == "Disabled"


async def test_remove_entry_deletes_store(hass, fake_home, hass_storage):
    entry = await setup_integration(hass)
    await entry.runtime_data.async_flush()
    assert f"hybrid_heating.{ENTRY_ID}" in hass_storage
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert f"hybrid_heating.{ENTRY_ID}" not in hass_storage
    assert f"hybrid_heating.{ENTRY_ID}.log" not in hass_storage
