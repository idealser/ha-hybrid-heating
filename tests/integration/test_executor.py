from __future__ import annotations

from homeassistant.core import Context
from homeassistant.exceptions import HomeAssistantError

from custom_components.hybrid_heating.commands import Command
from custom_components.hybrid_heating.executor import async_run_commands

BOILER = "climate.boiler"


async def test_commands_run_in_order_and_failures_are_isolated(hass, fake_home, calls):
    calls.fail("climate", "set_temperature", HomeAssistantError("boom"))
    res = await async_run_commands(
        hass,
        [
            Command("climate", "set_temperature", {"entity_id": BOILER, "temperature": 36.0}),
            Command("switch", "turn_on", {"entity_id": "switch.boiler_heat_call"}),
        ],
        Context(),
    )
    assert [r.status for r in res] == ["failed", "ok"]
    assert "boom" in (res[0].detail or "")
    assert calls.names() == [("climate", "set_temperature"), ("switch", "turn_on")]
    assert calls.log[1][2] == {"entity_id": "switch.boiler_heat_call"}


async def test_unavailable_target_is_skipped(hass, fake_home, calls):
    hass.states.async_set("switch.boiler_heat_call", "unavailable")
    res = await async_run_commands(
        hass, [Command("switch", "turn_on", {"entity_id": "switch.boiler_heat_call"})], Context()
    )
    assert (res[0].status, res[0].detail) == ("skipped", "unavailable") and calls.log == []


async def test_missing_target_is_skipped(hass, fake_home, calls):
    res = await async_run_commands(
        hass, [Command("switch", "turn_on", {"entity_id": "switch.gone"})], Context()
    )
    assert (res[0].status, res[0].detail) == ("skipped", "unavailable") and calls.log == []


async def test_timeout_marks_failed(hass, fake_home, calls):
    calls.delay("number", "set_value", 1.0)
    res = await async_run_commands(
        hass,
        [Command("number", "set_value", {"entity_id": "number.boiler_max_rods", "value": 2})],
        Context(),
        timeout_s=0.05,
    )
    assert (res[0].status, res[0].detail) == ("failed", "timeout")


async def test_calls_carry_the_context(hass, fake_home, calls):
    ctx = Context()
    await async_run_commands(hass, [Command("switch", "turn_off", {"entity_id": "switch.water_heater"})], ctx)
    assert calls.contexts == [ctx.id]


async def test_recorder_does_not_change_states(hass, fake_home, calls):
    await async_run_commands(
        hass, [Command("switch", "turn_on", {"entity_id": "switch.boiler_heat_call"})], Context()
    )
    assert hass.states.get("switch.boiler_heat_call").state == "off"
    calls.clear()
    assert calls.log == []
