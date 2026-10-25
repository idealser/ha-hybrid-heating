"""Hybrid Heating integration for Home Assistant."""

from __future__ import annotations

from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN
from .coordinator import HybridHeatingConfigEntry, HybridHeatingCoordinator
from .storage import HybridStore

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

PLATFORMS: list[Platform] = []


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    return True


async def async_setup_entry(hass: HomeAssistant, entry: HybridHeatingConfigEntry) -> bool:
    coordinator = HybridHeatingCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: HybridHeatingConfigEntry) -> bool:
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    coordinator = entry.runtime_data
    await coordinator.async_release_all("module_disabled")
    await coordinator.async_flush()
    return True


async def async_remove_entry(hass: HomeAssistant, entry: HybridHeatingConfigEntry) -> None:
    await HybridStore(hass, entry.entry_id).async_remove()
