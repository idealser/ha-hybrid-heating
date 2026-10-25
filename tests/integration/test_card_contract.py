"""The dashboard card's fixtures (frontend/test/fixtures) describe the websocket replies it expects."""

import json
from pathlib import Path

from tests.integration.conftest import setup_integration
from tests.unit.test_build_status import nullable_shape, shape

FIXTURES = Path("frontend/test/fixtures")


def fixture(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


async def ws(hass_ws_client, hass, **msg):
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def test_get_config_matches_the_card_fixture(hass, fake_home, hass_ws_client):
    await setup_integration(hass)
    r = (await ws(hass_ws_client, hass, type="hybrid_heating/get_config"))["result"]
    fx = fixture("config.json")
    assert r["settings"] == fx["settings"]  # same defaults, same JSON shape
    assert set(r) == set(fx)
    assert r["controls"] == fx["controls"] and r["revision"] == 1


async def test_set_config_bumps_the_revision(hass, fake_home, hass_ws_client):
    await setup_integration(hass)
    before = (await ws(hass_ws_client, hass, type="hybrid_heating/get_config"))["result"]
    r = await ws(
        hass_ws_client,
        hass,
        type="hybrid_heating/set_config",
        settings={"curve": {"shift": 2.0}, "zones": {"bounds": [7.0, -3.0, -15.0]}},
    )
    after = r["result"]
    assert after["settings"]["curve"]["shift"] == 2.0
    assert after["settings"]["curve"]["points"] == before["settings"]["curve"]["points"]
    assert (
        after["settings"]["zones"]["bounds"] == [7.0, -3.0, -15.0]
        and after["revision"] == before["revision"] + 1
    )


async def test_status_and_log_shapes(hass, fake_home, hass_ws_client):
    await setup_integration(hass)
    status = (await ws(hass_ws_client, hass, type="hybrid_heating/get_status", language="ru"))["result"]
    assert nullable_shape(shape(status), shape(fixture("status-now.json")))
    assert status["reasons"] and all(r["text"] for r in status["reasons"])
    entries = (await ws(hass_ws_client, hass, type="hybrid_heating/get_log", limit=5, language="ru"))[
        "result"
    ]["entries"]
    expected = fixture("log.json")["ru"]["entries"][0]
    assert entries and all(set(e) == set(expected) for e in entries)
    assert all(set(r) == {"layer", "code", "data", "text"} for e in entries for r in e["reasons"])


async def test_status_follows_the_settings_revision(hass, fake_home, hass_ws_client):
    c = (await setup_integration(hass)).runtime_data
    await c.async_patch_settings({"targets": {"comfort": 22.0}}, "ws")
    status = (await ws(hass_ws_client, hass, type="hybrid_heating/get_status"))["result"]
    assert status["revision"] == 2 and status["seq"]["log"] == c.log.revision
