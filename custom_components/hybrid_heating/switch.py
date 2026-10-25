"""Switches: the module on or off, and hybrid mode (heat pumps first)."""

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .coordinator import HybridHeatingConfigEntry
from .entity import HybridHeatingEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: HybridHeatingConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    coordinator = entry.runtime_data
    async_add_entities([EnabledSwitch(coordinator), HybridModeSwitch(coordinator)])


class EnabledSwitch(HybridHeatingEntity, SwitchEntity):
    _attr_translation_key = "enabled"

    @property
    def available(self) -> bool:
        return True  # so the module can be switched back on after a failsafe

    @property
    def is_on(self) -> bool:
        return self.coordinator.enabled

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self.coordinator.async_set_enabled(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self.coordinator.async_set_enabled(False)


class HybridModeSwitch(HybridHeatingEntity, SwitchEntity):
    _attr_translation_key = "hybrid_mode"

    @property
    def is_on(self) -> bool:
        return self.coordinator.settings.hybrid

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self.coordinator.async_patch_settings({"hybrid": True}, "entity")

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self.coordinator.async_patch_settings({"hybrid": False}, "entity")
