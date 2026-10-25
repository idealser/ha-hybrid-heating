"""Selects: the preset and the boiler mode."""

from typing import Any

from homeassistant.components.select import SelectEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .coordinator import HybridHeatingConfigEntry
from .core.types import BoilerMode, Preset
from .entity import HybridHeatingEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: HybridHeatingConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    coordinator = entry.runtime_data
    async_add_entities([PresetSelect(coordinator), BoilerModeSelect(coordinator)])


class PresetSelect(HybridHeatingEntity, SelectEntity):
    _attr_translation_key = "preset"
    _attr_options = [p.value for p in Preset]

    @property
    def current_option(self) -> str:
        return self.coordinator.settings.preset.value

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        d = self.decision
        # Comfort turns into Night inside the night window: show what is in effect now.
        return {
            "effective_preset": d.preset.value if d is not None else None,
            "target": d.target if d is not None else None,
        }

    async def async_select_option(self, option: str) -> None:
        await self.coordinator.async_patch_settings({"preset": option}, "entity")


class BoilerModeSelect(HybridHeatingEntity, SelectEntity):
    _attr_translation_key = "boiler_mode"
    _attr_options = [m.value for m in BoilerMode]

    @property
    def current_option(self) -> str:
        return self.coordinator.settings.boiler.mode.value

    async def async_select_option(self, option: str) -> None:
        await self.coordinator.async_patch_settings({"boiler": {"mode": option}}, "entity")
