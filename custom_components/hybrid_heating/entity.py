"""Common base for the module's entities: one service device, names from the translations."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, TITLE, VERSION
from .coordinator import HybridHeatingCoordinator
from .core.types import Decision, Layer, LayerMode


class HybridHeatingEntity(CoordinatorEntity[HybridHeatingCoordinator]):
    """Entities only read the coordinator and change things through its methods."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: HybridHeatingCoordinator, key: str) -> None:
        super().__init__(coordinator)
        entry_id = coordinator.config_entry.entry_id
        self._attr_translation_key = key
        self._attr_unique_id = f"{entry_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry_id)},
            name=TITLE,
            manufacturer="idealser",
            model=TITLE,
            entry_type=DeviceEntryType.SERVICE,
            sw_version=VERSION,
        )

    @property
    def decision(self) -> Decision | None:
        data = self.coordinator.data
        return data.decision if data is not None else None

    def observed(self, layer: Layer) -> bool:
        """True when the layer is not ACTIVE, so the value shows what it would do."""
        return self.coordinator.settings.layers.get(layer) is not LayerMode.ACTIVE
