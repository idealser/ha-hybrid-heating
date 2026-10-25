from unittest.mock import patch

from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.config_entries import ConfigEntryState
from homeassistant.setup import async_setup_component

from custom_components.hybrid_heating.card_resource import CARD_FILE, URL_BASE
from custom_components.hybrid_heating.const import VERSION
from tests.integration.conftest import TICK, add_entry, setup_integration

CARD_URL = f"{URL_BASE}/{CARD_FILE}?v={VERSION}"


def ours(hass) -> list[str]:
    items = hass.data[LOVELACE_DATA].resources.async_items()
    return [i["url"] for i in items if i["url"].startswith(URL_BASE)]


async def test_card_is_served(hass, fake_home, hass_client):
    await setup_integration(hass)
    r = await (await hass_client()).get(f"{URL_BASE}/{CARD_FILE}")
    assert r.status == 200 and "javascript" in r.headers["Content-Type"]


async def test_resource_created_once_in_storage_mode(hass, fake_home):
    assert await async_setup_component(hass, "lovelace", {})
    entry = await setup_integration(hass)
    items = [i for i in hass.data[LOVELACE_DATA].resources.async_items() if i["url"].startswith(URL_BASE)]
    assert len(items) == 1 and items[0]["type"] == "module" and items[0]["url"] == CARD_URL
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert ours(hass) == [CARD_URL]  # a reload keeps it and adds no second one


async def test_new_version_updates_instead_of_duplicating(hass, fake_home):
    assert await async_setup_component(hass, "lovelace", {})
    resources = hass.data[LOVELACE_DATA].resources
    await resources.async_get_info()
    await resources.async_create_item({"res_type": "module", "url": f"{URL_BASE}/{CARD_FILE}?v=0.0.1"})
    await resources.async_create_item({"res_type": "module", "url": f"{URL_BASE}/{CARD_FILE}?v=0.0.2"})
    await setup_integration(hass)
    assert ours(hass) == [CARD_URL]


async def test_other_resources_are_left_alone(hass, fake_home):
    assert await async_setup_component(hass, "lovelace", {})
    resources = hass.data[LOVELACE_DATA].resources
    await resources.async_get_info()
    await resources.async_create_item({"res_type": "module", "url": "/local/other-card.js"})
    await setup_integration(hass)
    assert "/local/other-card.js" in [i["url"] for i in resources.async_items()]


async def test_yaml_mode_falls_back_to_an_extra_module(hass, fake_home):
    assert await async_setup_component(hass, "lovelace", {"lovelace": {"resource_mode": "yaml"}})
    hass.config.components.add("frontend")
    with patch("custom_components.hybrid_heating.card_resource.add_extra_js_url") as add:
        await setup_integration(hass)
    add.assert_called_once_with(hass, CARD_URL)


async def test_removal_drops_the_resource(hass, fake_home):
    assert await async_setup_component(hass, "lovelace", {})
    entry = await setup_integration(hass)
    assert ours(hass) == [CARD_URL]
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert ours(hass) == []


async def test_without_lovelace_nothing_breaks(hass, fake_home):
    entry = await setup_integration(hass)
    assert entry.runtime_data.enabled is True


async def test_a_failing_resource_registration_does_not_fail_setup(hass, fake_home, caplog):
    with patch(
        "custom_components.hybrid_heating.async_register_card", side_effect=RuntimeError("lovelace broke")
    ):
        entry = await setup_integration(hass)
    assert entry.state is ConfigEntryState.LOADED
    assert "lovelace broke" in caplog.text


async def test_card_is_served_while_setup_retries(hass, fake_home, hass_client):
    entry = add_entry(hass)
    with patch(TICK, side_effect=RuntimeError("bug")):
        await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.SETUP_RETRY
    r = await (await hass_client()).get(f"{URL_BASE}/{CARD_FILE}")
    assert r.status == 200
