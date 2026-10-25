"""Suggestions, apply, dismiss and the Cold/Hot marks over the websocket, as the card uses them."""

from datetime import datetime, timedelta

from custom_components.hybrid_heating.core.model import HeatLossEstimate
from custom_components.hybrid_heating.core.types import Room
from tests.conftest import TZ
from tests.integration.conftest import log_codes, log_reasons, setup_integration
from tests.integration.test_card_contract import fixture


async def call(client, **msg):
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def mark(client, room, kind, lang="en"):
    return await call(client, type="hybrid_heating/feedback", room=room, kind=kind, language=lang)


async def listed(client, lang="en"):
    return (await call(client, type="hybrid_heating/get_suggestions", language=lang))["result"]["suggestions"]


async def two_marks(client, freezer, room, kind):
    await mark(client, room, kind)
    freezer.tick(timedelta(hours=2))
    return (await mark(client, room, kind))["result"]["suggestion"]


async def test_marks_make_a_suggestion_an_admin_applies(hass, fake_home, hass_ws_client, freezer):
    c = (await setup_integration(hass)).runtime_data
    client = await hass_ws_client(hass)
    first = await mark(client, "child", "cold")
    assert first["success"] and first["result"] == {"suggestion": None}
    seq = c.learning.revision
    freezer.tick(timedelta(hours=2))
    sg = (await mark(client, "child", "cold"))["result"]["suggestion"]
    assert (sg["kind"], sg["state"], sg["title"]) == (
        "feedback",
        "new",
        "Child's room: raise its target by 0.3°",
    )
    assert c.learning.revision == seq + 1
    assert [s["id"] for s in await listed(client)] == [sg["id"]]
    applied = await call(
        client, type="hybrid_heating/apply_suggestion", suggestion_id=sg["id"], language="en"
    )
    assert applied["success"] and applied["result"]["settings"]["room_offsets"]["child"] == -0.7
    assert applied["result"]["revision"] == 2  # the reply is get_config's: the card adopts it
    assert c.settings.room_offsets[Room.CHILD] == -0.7
    assert [(s["id"], s["state"]) for s in await listed(client)] == [(sg["id"], "applied")]
    codes = log_codes(c)
    assert codes.count("feedback_marked") == 2 and {"suggestion_created", "suggestion_applied"} <= set(codes)
    assert log_reasons(c, "settings_changed")[-1]["data"]["source"] == "suggestion"
    freezer.tick(timedelta(hours=2))
    assert (await mark(client, "child", "cold"))["result"]["suggestion"] is None  # old marks count once


async def test_a_dismissed_suggestion_waits_30_days_in_similar_weather(
    hass, fake_home, hass_ws_client, freezer
):
    c = (await setup_integration(hass)).runtime_data
    client = await hass_ws_client(hass)
    sg = await two_marks(client, freezer, "bath", "cold")
    assert sg["title"] == "Bathroom: raise the whole curve by 1°"
    r = await call(client, type="hybrid_heating/dismiss_suggestion", suggestion_id=sg["id"])
    assert r["success"] and r["result"] == {}
    assert [(s["id"], s["state"]) for s in await listed(client)] == [(sg["id"], "dismissed")]
    assert c.settings.curve.shift == 0.0 and "suggestion_dismissed" in log_codes(c)
    freezer.tick(timedelta(hours=2))
    assert await two_marks(client, freezer, "bath", "cold") is None
    freezer.tick(timedelta(days=31))
    again = await two_marks(client, freezer, "bath", "cold")
    assert again is not None and again["id"] != sg["id"]
    assert [s["state"] for s in await listed(client)] == ["new"]  # the old dismissal is over a week old


async def test_a_suggestion_the_user_overtook_is_withdrawn(hass, fake_home, hass_ws_client, freezer):
    c = (await setup_integration(hass)).runtime_data
    client = await hass_ws_client(hass)
    sg = await two_marks(client, freezer, "living", "hot")
    await c.async_patch_settings({"room_offsets": {"living": -0.5}}, "ws")
    assert await listed(client) == []
    r = await call(client, type="hybrid_heating/apply_suggestion", suggestion_id=sg["id"])
    assert r["error"]["code"] == "not_found" and c.settings.room_offsets[Room.LIVING] == -0.5
    assert [r["data"] for r in log_reasons(c, "suggestion_stale")] == [{"setting": "room_offsets.living"}]


async def test_errors(hass, fake_home, hass_ws_client, hass_read_only_access_token):
    c = (await setup_integration(hass)).runtime_data
    client = await hass_ws_client(hass)
    assert (await call(client, type="hybrid_heating/apply_suggestion", suggestion_id="nope"))["error"][
        "code"
    ] == "not_found"
    assert (await call(client, type="hybrid_heating/dismiss_suggestion", suggestion_id="nope"))["error"][
        "code"
    ] == "not_found"
    assert (await mark(client, "garage", "cold"))["error"]["code"] == "invalid_format"
    assert (await mark(client, "child", "warm"))["error"]["code"] == "invalid_format"
    user = await hass_ws_client(hass, hass_read_only_access_token)
    assert (await call(user, type="hybrid_heating/apply_suggestion", suggestion_id="x"))["error"][
        "code"
    ] == "unauthorized"
    assert (await call(user, type="hybrid_heating/dismiss_suggestion", suggestion_id="x"))["error"][
        "code"
    ] == "unauthorized"
    assert (await mark(user, "child", "cold"))["success"]  # anyone in the house may say it is cold
    await c.async_set_enabled(False)
    assert (await mark(client, "child", "cold"))["error"]["code"] == "not_ready"


async def test_the_heat_loss_is_listed_for_information(hass, fake_home, hass_ws_client):
    c = (await setup_integration(hass)).runtime_data
    c.learning.data.heat_loss = HeatLossEstimate(
        "ok", 148.0, 310.0, 0.93, 9, 28, datetime(2026, 11, 1, 4, 30, tzinfo=TZ)
    )
    client = await hass_ws_client(hass)
    items = await listed(client, "ru")
    assert [(s["kind"], s["state"], s["title"]) for s in items] == [
        ("heat_loss", "info", "Теплопотери за неделю: 148 Вт/К")
    ]


async def test_suggestions_have_the_card_fixture_shape(hass, fake_home, hass_ws_client, freezer):
    await setup_integration(hass)
    client = await hass_ws_client(hass)
    await two_marks(client, freezer, "bedroom", "cold")
    items = await listed(client)
    fx = fixture("suggestions.json")["en"]["suggestions"]
    assert items and all(set(s) == set(fx[0]) for s in items)


async def test_the_card_hears_about_new_suggestions(hass, fake_home, hass_ws_client, freezer):
    await setup_integration(hass)
    client = await hass_ws_client(hass)
    before = (await call(client, type="hybrid_heating/get_status"))["result"]["seq"]["suggestions"]
    await two_marks(client, freezer, "bedroom", "cold")
    after = (await call(client, type="hybrid_heating/get_status"))["result"]["seq"]["suggestions"]
    assert after == before + 1
