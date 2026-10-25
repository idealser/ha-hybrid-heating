"""The user's own floor plan: uploaded by an admin, kept in Home Assistant, read by the card."""

import json
from pathlib import Path

from tests.integration.conftest import STORE_KEY, setup_integration

PLAN_KEY = f"{STORE_KEY}.plan"
PLAN = json.loads(Path("frontend/src/plan/schematic.json").read_text(encoding="utf-8"))


async def ws(client, **msg):
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def test_no_plan_until_one_is_uploaded(hass, fake_home, hass_ws_client):
    await setup_integration(hass)
    r = await ws(await hass_ws_client(hass), type="hybrid_heating/get_plan")
    assert r["success"] and r["result"] == {"plan": None}


async def test_uploaded_plan_is_kept_across_a_reload(hass, fake_home, hass_ws_client, hass_storage):
    entry = await setup_integration(hass)
    client = await hass_ws_client(hass)
    r = await ws(client, type="hybrid_heating/set_plan", plan=PLAN)
    assert r["success"] and r["result"] == {"plan": PLAN}
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert (await ws(await hass_ws_client(hass), type="hybrid_heating/get_plan"))["result"] == {"plan": PLAN}
    assert hass_storage[PLAN_KEY]["data"] == {"plan": PLAN}


async def test_null_goes_back_to_the_schematic(hass, fake_home, hass_ws_client):
    await setup_integration(hass)
    client = await hass_ws_client(hass)
    await ws(client, type="hybrid_heating/set_plan", plan=PLAN)
    assert (await ws(client, type="hybrid_heating/set_plan", plan=None))["result"] == {"plan": None}
    assert (await ws(client, type="hybrid_heating/get_plan"))["result"] == {"plan": None}


async def test_an_invalid_plan_is_refused(hass, fake_home, hass_ws_client):
    await setup_integration(hass)
    client = await hass_ws_client(hass)
    r = await ws(client, type="hybrid_heating/set_plan", plan={**PLAN, "version": 9})
    assert not r["success"] and r["error"]["code"] == "invalid_plan"
    assert (await ws(client, type="hybrid_heating/get_plan"))["result"] == {"plan": None}


async def test_an_unreadable_saved_plan_falls_back_to_the_schematic(
    hass, fake_home, hass_ws_client, hass_storage
):
    hass_storage[PLAN_KEY] = {"version": 1, "minor_version": 1, "key": PLAN_KEY, "data": {"plan": {"x": 1}}}
    await setup_integration(hass)
    assert (await ws(await hass_ws_client(hass), type="hybrid_heating/get_plan"))["result"] == {"plan": None}


async def test_set_plan_requires_admin(hass, fake_home, hass_ws_client, hass_read_only_access_token):
    await setup_integration(hass)
    client = await hass_ws_client(hass, hass_read_only_access_token)
    r = await ws(client, type="hybrid_heating/set_plan", plan=PLAN)
    assert r["error"]["code"] == "unauthorized"


async def test_removal_deletes_the_plan(hass, fake_home, hass_ws_client, hass_storage):
    entry = await setup_integration(hass)
    await ws(await hass_ws_client(hass), type="hybrid_heating/set_plan", plan=PLAN)
    assert PLAN_KEY in hass_storage
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert PLAN_KEY not in hass_storage
