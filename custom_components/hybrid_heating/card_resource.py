"""Serve the dashboard card and add it to Lovelace's resources, so no YAML is needed."""

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http.server import StaticPathConfig
from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.core import HomeAssistant
from homeassistant.util.hass_dict import HassKey

from .const import DOMAIN, VERSION

_LOGGER = logging.getLogger(__name__)

URL_BASE = "/hybrid_heating_static"
CARD_FILE = "hybrid-heating-card.js"
FRONTEND_DIR = Path(__file__).parent / "frontend"
_STATIC: HassKey[bool] = HassKey(f"{DOMAIN}_static_registered")


def card_url() -> str:
    return f"{URL_BASE}/{CARD_FILE}?v={VERSION}"


async def async_serve_card(hass: HomeAssistant) -> None:
    """Serve the bundle, once per run of Home Assistant (also while an entry waits to retry its setup)."""
    if not hass.data.get(_STATIC) and hass.http is not None:
        await hass.http.async_register_static_paths([StaticPathConfig(URL_BASE, str(FRONTEND_DIR), True)])
        hass.data[_STATIC] = True


async def async_register_card(hass: HomeAssistant) -> str:
    """Make Lovelace load the card. Safe to call on every setup."""
    url = card_url()
    lovelace = hass.data.get(LOVELACE_DATA)
    if lovelace is None:
        return url
    resources = lovelace.resources
    if isinstance(resources, ResourceStorageCollection):
        await resources.async_get_info()  # the collection loads lazily
        ours = [item for item in resources.async_items() if str(item["url"]).startswith(URL_BASE)]
        if not ours:
            await resources.async_create_item({"res_type": "module", "url": url})
        else:
            if ours[0]["url"] != url:
                await resources.async_update_item(ours[0]["id"], {"res_type": "module", "url": url})
            for extra in ours[1:]:
                await resources.async_delete_item(extra["id"])
    elif "frontend" in hass.config.components:
        add_extra_js_url(hass, url)  # resources in YAML cannot be changed from here
    return url


async def async_unregister_card(hass: HomeAssistant) -> None:
    """Drop the card from Lovelace when the integration is removed."""
    lovelace = hass.data.get(LOVELACE_DATA)
    if lovelace is None:
        return
    resources = lovelace.resources
    if isinstance(resources, ResourceStorageCollection):
        await resources.async_get_info()
        for item in list(resources.async_items()):
            if str(item["url"]).startswith(URL_BASE):
                await resources.async_delete_item(item["id"])
    elif "frontend" in hass.config.components:
        remove_extra_js_url(hass, card_url())
