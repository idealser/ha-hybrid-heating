"""Regression tests from the stage 2 review: paths that could leave the thermostat or the protection off."""

import asyncio
from itertools import pairwise
from unittest.mock import patch

import pytest
from homeassistant.components.persistent_notification import _async_get_or_create_notifications
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import EVENT_HOMEASSISTANT_FINAL_WRITE, EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import Context, CoreState
from homeassistant.exceptions import HomeAssistantError

from custom_components.hybrid_heating.const import DOMAIN
from custom_components.hybrid_heating.takeover import BoilerPrev, ThermostatPrev
from tests.fakes import BOILER, CALL, TH, WH
from tests.integration.conftest import (
    RESTORE_TH,
    STORE_KEY,
    THERMOSTAT_OFF,
    TICK,
    add_entry,
    log_codes,
    set_power,
    setup_integration,
    step,
)

WH_OFF = ("switch", "turn_off", {"entity_id": WH})
BOILER_ATTRS = {"target_temp_step": 1, "min_temp": 20, "max_temp": 80}


def notifications(hass) -> dict:
    return {k: v for k, v in _async_get_or_create_notifications(hass).items() if k.startswith(DOMAIN)}


@pytest.mark.real_time
async def test_unload_does_not_take_back_what_it_gave_back(hass, fake_home, calls, stored):
    stored(settings={"layers": {"boiler": "active"}})
    entry = await setup_integration(hass)
    assert THERMOSTAT_OFF in calls.log
    calls.clear()
    calls.delay("climate", "set_temperature", 0.3)  # give-back calls take a moment, like real devices
    unload = hass.async_create_task(hass.config_entries.async_unload(entry.entry_id))
    await asyncio.sleep(0.1)  # the release now holds the lock
    hass.states.async_set("climate.living_ac", "heat", {"temperature": 24}, context=Context())
    assert await unload
    await hass.async_block_till_done()
    assert RESTORE_TH in calls.log
    assert THERMOSTAT_OFF not in calls.log[calls.log.index(RESTORE_TH) :]
    assert entry.state is ConfigEntryState.NOT_LOADED


async def test_disabled_module_retries_the_boiler_giveback(hass, fake_home, calls, stored, freezer):
    stored(settings={"layers": {"boiler": "active"}})
    c = (await setup_integration(hass)).runtime_data
    hass.states.async_set(BOILER, "unavailable")
    await c.async_set_enabled(False)
    assert c.takeover.boiler_prev == BoilerPrev(50.0, 2)
    calls.clear()
    hass.states.async_set(BOILER, "heat", {"temperature": 36, **BOILER_ATTRS})  # back: a tick runs at once
    await step(freezer, hass, 61)
    assert ("climate", "set_temperature", {"entity_id": BOILER, "temperature": 50.0}) in calls.log
    assert c.takeover.boiler_prev is None


async def test_disabled_module_retries_the_thermostat_giveback(hass, fake_home, calls, stored, freezer):
    stored(settings={"layers": {"boiler": "active"}})
    c = (await setup_integration(hass)).runtime_data
    hass.states.async_set(TH, "unavailable")
    await c.async_set_enabled(False)
    assert c.takeover.thermostat_prev is not None
    calls.clear()
    hass.states.async_set(TH, "off", {"temperature": 22.5})
    for _ in range(2):
        await step(freezer, hass, 61)
    assert RESTORE_TH in calls.log and c.takeover.thermostat_prev is None


async def test_failed_restore_is_retried(hass, fake_home, calls, stored, freezer):
    stored(settings={"layers": {"boiler": "active"}})
    c = (await setup_integration(hass)).runtime_data
    calls.clear()
    calls.fail("climate", "set_temperature", HomeAssistantError("device did not answer"))
    await c.async_set_enabled(False)
    assert RESTORE_TH in calls.log and c.takeover.thermostat_prev is not None
    calls.stop_failing()
    calls.clear()
    for _ in range(2):
        await step(freezer, hass, 61)
    assert RESTORE_TH in calls.log and c.takeover.thermostat_prev is None


async def test_repeated_failed_giveback_is_logged_once(hass, fake_home, calls, stored, freezer):
    stored(settings={"layers": {"boiler": "active"}})
    c = (await setup_integration(hass)).runtime_data
    calls.fail("climate", "set_temperature", HomeAssistantError("device did not answer"))
    await c.async_set_enabled(False)
    n0 = len(c.log.to_data())
    for _ in range(10):
        await step(freezer, hass, 61)
    assert len(c.log.to_data()) - n0 <= 1


async def test_setup_failures_give_control_back_and_end_in_failsafe(
    hass, fake_home, calls, stored, freezer, hass_storage
):
    stored(settings={"layers": {"boiler": "active"}})
    entry = add_entry(hass)
    with patch(TICK, side_effect=RuntimeError("bug")):
        await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
        assert entry.state is ConfigEntryState.SETUP_RETRY
        assert (
            THERMOSTAT_OFF in calls.log and RESTORE_TH in calls.log
        )  # given back after the failed first tick
        for _ in range(10):
            await step(freezer, hass, 120)
    assert hass_storage[STORE_KEY]["data"]["enabled"] is False
    assert entry.state is ConfigEntryState.LOADED and entry.runtime_data.enabled is False
    assert "failsafe_released" in log_codes(entry.runtime_data)
    assert any("failsafe" in k for k in notifications(hass))


async def test_overload_sheds_right_after_the_hold_time(hass, fake_home, calls, stored, freezer):
    # A 1 s hold makes the timing visible: fast ticks are 5 s apart, so only a deadline timer sheds in time.
    stored(settings={"layers": {"load": "active"}, "load": {"shed_after_s": 1.0}})
    await setup_integration(hass)
    calls.clear()
    set_power(hass, 8300)
    await hass.async_block_till_done()
    await step(freezer, hass, 1.1)
    assert WH_OFF in calls.log


async def test_load_layer_sheds_during_the_startup_grace(hass, fake_home, calls, stored, freezer):
    stored(settings={"layers": {"boiler": "active", "load": "active"}})
    hass.set_state(CoreState.starting)
    c = (await setup_integration(hass)).runtime_data
    hass.set_state(CoreState.running)
    hass.bus.async_fire(EVENT_HOMEASSISTANT_STARTED)
    await hass.async_block_till_done()
    set_power(hass, 8300)
    await hass.async_block_till_done()
    await step(freezer, hass, 6)
    assert WH_OFF in calls.log
    assert not any(d["entity_id"] == TH for *_, d in calls.log)  # the boiler layer still waits
    assert c.data.status == "Starting"


async def test_state_is_saved_every_few_minutes_while_ticking(hass, fake_home, freezer, hass_storage):
    await setup_integration(hass)
    first = hass_storage.get(STORE_KEY, {}).get("data", {}).get("saved_at")
    for _ in range(6):
        await step(freezer, hass, 61)
    later = hass_storage.get(STORE_KEY, {}).get("data", {}).get("saved_at")
    assert later is not None and later != first


async def test_state_is_saved_on_the_final_write(hass, fake_home, hass_storage):
    c = (await setup_integration(hass)).runtime_data
    await c.async_patch_settings({"targets": {"comfort": 22.0}}, "ws")  # flushed at once
    c.window.add(c.data.now, -30.0)  # only in memory so far: the bucket total turns negative
    hass.bus.async_fire(EVENT_HOMEASSISTANT_FINAL_WRITE)
    await hass.async_block_till_done()
    assert any(total < 0 for _, total, _ in hass_storage[STORE_KEY]["data"]["window"])


async def test_executed_actions_are_saved_at_once(hass, fake_home, calls, stored, hass_storage):
    stored(settings={"layers": {"ac": "active"}})
    await setup_integration(hass)
    owned = hass_storage[STORE_KEY]["data"]["controller"]["ac"]["owned"]
    assert owned == ["bedroom", "living"]


async def test_thermostat_found_on_after_restart_is_switched_off_again(
    hass, fake_home, calls, stored, freezer
):
    stored(
        settings={"layers": {"boiler": "active"}},
        takeover={"thermostat_prev": {"hvac_mode": "heat", "temperature": 21.5}},
    )
    hass.states.async_set(TH, "heat", {"temperature": 22.5})  # e.g. initial_hvac_mode: heat
    c = (await setup_integration(hass)).runtime_data
    assert THERMOSTAT_OFF in calls.log
    assert c.takeover.thermostat_prev == ThermostatPrev("heat", 21.5)  # still the user's own setting
    assert "thermostat_reasserted" in log_codes(c)
    calls.clear()
    await step(freezer, hass, 61)
    assert THERMOSTAT_OFF not in calls.log  # only once, right after the start


async def test_unreachable_relay_is_logged_once_and_notified(hass, fake_home, calls, stored, freezer):
    stored(settings={"layers": {"boiler": "active"}})
    c = (await setup_integration(hass)).runtime_data
    hass.states.async_set(CALL, "unavailable")
    await hass.async_block_till_done()
    n0 = len(c.log.to_data())
    for _ in range(10):
        await step(freezer, hass, 61)
    entries = c.log.to_data()[n0 - 1 :]
    assert len(entries) < 10
    for a, b in pairwise(entries):  # nothing logged just because it repeated
        assert ([r["code"] for r in a["reasons"]], a["actions"]) != (
            [r["code"] for r in b["reasons"]],
            b["actions"],
        )
    assert any(CALL in k for k in notifications(hass))
    hass.states.async_set(CALL, "off")
    await hass.async_block_till_done()
    await step(freezer, hass, 61)
    assert not any(CALL in k for k in notifications(hass))  # dismissed once it answers again


async def test_remove_with_a_pending_giveback_notifies(hass, fake_home, calls, stored):
    stored(settings={"layers": {"boiler": "active"}})
    entry = await setup_integration(hass)
    hass.states.async_set(TH, "unavailable")
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    pending = [v for k, v in notifications(hass).items() if "giveback" in k]
    assert pending and "climate.thermostat" in pending[0]["message"]
