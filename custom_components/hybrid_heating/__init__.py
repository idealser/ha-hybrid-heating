"""Hybrid Heating integration for Home Assistant."""

from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .alerts import notify_pending_giveback
from .const import DOMAIN
from .coordinator import HybridHeatingConfigEntry, HybridHeatingCoordinator
from .entity_map import EntityMap
from .storage import HybridStore
from .takeover import pending_giveback
from .websocket import async_register_websocket

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

PLATFORMS: list[Platform] = [Platform.SWITCH, Platform.SELECT, Platform.SENSOR, Platform.BINARY_SENSOR]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    async_register_websocket(hass)  # once for the whole of Home Assistant, not per entry
    return True


async def async_setup_entry(hass: HomeAssistant, entry: HybridHeatingConfigEntry) -> bool:
    coordinator = HybridHeatingCoordinator(hass, entry)
    try:
        await coordinator.async_config_entry_first_refresh()
    except Exception:
        # The failed first tick may already have taken the thermostat: give it back before Home Assistant
        # retries. Each retry counts towards the failsafe (the count is saved).
        await coordinator.async_stop("setup_failed_released")
        raise
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: HybridHeatingConfigEntry) -> bool:
    # Stop and give back first, so no tick can take anything again while the platforms unload.
    await entry.runtime_data.async_stop("module_disabled")
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_entry(hass: HomeAssistant, entry: HybridHeatingConfigEntry) -> None:
    store = HybridStore(hass, entry.entry_id)
    items = pending_giveback(
        await store.async_load_takeover(), EntityMap.from_entry_dicts(entry.data, entry.options)
    )
    if items:  # a device was unavailable when the module let go: tell the user what to set back
        notify_pending_giveback(hass, items)
    await store.async_remove()
