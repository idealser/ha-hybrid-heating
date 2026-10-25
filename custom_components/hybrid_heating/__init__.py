"""Hybrid Heating integration for Home Assistant."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN
from .entity_map import EntityMap

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

type HybridHeatingConfigEntry = ConfigEntry[EntityMap]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    return True


async def async_setup_entry(hass: HomeAssistant, entry: HybridHeatingConfigEntry) -> bool:
    entry.runtime_data = EntityMap.from_entry_dicts(entry.data, entry.options)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: HybridHeatingConfigEntry) -> bool:
    return True
