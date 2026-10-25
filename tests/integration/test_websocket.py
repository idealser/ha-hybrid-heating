from __future__ import annotations

import pytest
from homeassistant.setup import async_setup_component

from custom_components.hybrid_heating.const import DOMAIN
from custom_components.hybrid_heating.core.types import Settings
from tests.integration.conftest import ENTRY_ID, setup_integration


async def ws(hass_ws_client, hass, **msg):
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def test_get_config_defaults(hass, fake_home, hass_ws_client):
    await setup_integration(hass)
    r = await ws(hass_ws_client, hass, type="hybrid_heating/get_config")
    assert r["success"] and r["result"]["version"] == "0.2.0" and r["result"]["enabled"] is True
    assert r["result"]["settings"]["layers"] == {"boiler": "observe", "ac": "observe", "load": "observe"}
    assert r["result"]["entities"]["boiler_call"] == "switch.boiler_heat_call"
    assert r["result"]["takeover"]["thermostat_prev"] is None
    assert r["result"]["status"].startswith("Observe · Warm")


async def test_set_config_merges_persists_and_takes_over(
    hass, fake_home, calls, hass_ws_client, hass_storage
):
    c = (await setup_integration(hass)).runtime_data
    r = await ws(
        hass_ws_client,
        hass,
        type="hybrid_heating/set_config",
        settings={"targets": {"comfort": 23.5}, "layers": {"boiler": "active"}},
    )
    assert (
        r["success"]
        and r["result"]["settings"]["targets"]["comfort"] == 23.5
        and c.settings.targets.eco == 21.5
    )
    assert hass_storage[f"hybrid_heating.{ENTRY_ID}"]["data"]["settings"]["targets"]["comfort"] == 23.5
    assert ("climate", "set_hvac_mode", {"entity_id": "climate.thermostat", "hvac_mode": "off"}) in calls.log
    assert r["result"]["takeover"]["thermostat_prev"] == {"hvac_mode": "heat", "temperature": 22.5}


@pytest.mark.parametrize(
    "patch", [{"curve": {"flow_min": 70}}, {"bogus": 1}, {"layers": {"boiler": "turbo"}}]
)
async def test_set_config_rejects_invalid(hass, fake_home, hass_ws_client, patch):
    c = (await setup_integration(hass)).runtime_data
    r = await ws(hass_ws_client, hass, type="hybrid_heating/set_config", settings=patch)
    assert not r["success"] and r["error"]["code"] == "invalid_config" and c.settings == Settings()


async def test_set_config_requires_admin(hass, fake_home, hass_ws_client, hass_read_only_access_token):
    await setup_integration(hass)
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json_auto_id({"type": "hybrid_heating/set_config", "settings": {}})
    assert (await client.receive_json())["error"]["code"] == "unauthorized"


async def test_get_log_newest_first_with_ru_texts(hass, fake_home, hass_ws_client):
    await setup_integration(hass)
    r = await ws(hass_ws_client, hass, type="hybrid_heating/get_log", limit=2, language="ru")
    e = r["result"]["entries"]
    assert 1 <= len(e) <= 2 and all("text" in x for x in e[0]["reasons"])
    if len(e) == 2:
        assert e[0]["ts"] >= e[1]["ts"]
    e = (await ws(hass_ws_client, hass, type="hybrid_heating/get_log", limit=500, language="ru"))["result"][
        "entries"
    ]
    assert any(x["text"].startswith("Отопительный сезон начался") for entry in e for x in entry["reasons"])


async def test_get_log_defaults_to_the_server_language(hass, fake_home, hass_ws_client):
    await setup_integration(hass)
    e = (await ws(hass_ws_client, hass, type="hybrid_heating/get_log"))["result"]["entries"]
    assert any(x["text"].startswith("Heating season started") for entry in e for x in entry["reasons"])


async def test_get_log_before(hass, fake_home, hass_ws_client, freezer):
    c = (await setup_integration(hass)).runtime_data
    first_ts = c.log.latest(1)[0]["ts"]
    r = await ws(hass_ws_client, hass, type="hybrid_heating/get_log", before=first_ts)
    assert r["success"] and all(e["ts"] < first_ts for e in r["result"]["entries"])
    bad = await ws(hass_ws_client, hass, type="hybrid_heating/get_log", before="yesterday")
    assert bad["error"]["code"] == "invalid_format"


@pytest.mark.parametrize("limit", [0, 501])
async def test_get_log_limit_bounds(hass, fake_home, hass_ws_client, limit):
    await setup_integration(hass)
    r = await ws(hass_ws_client, hass, type="hybrid_heating/get_log", limit=limit)
    assert r["error"]["code"] == "invalid_format"


async def test_not_loaded(hass, hass_ws_client):
    assert await async_setup_component(hass, DOMAIN, {})
    assert (await ws(hass_ws_client, hass, type="hybrid_heating/get_config"))["error"]["code"] == "not_loaded"
