"""Common base for the module's entities: one service device, names from the translations."""

from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, TITLE, VERSION
from .coordinator import HybridHeatingCoordinator
from .core.types import Decision, Layer
from .status import is_live


class HybridHeatingEntity(CoordinatorEntity[HybridHeatingCoordinator]):
    """Entities only read the coordinator and change things through its methods.

    Subclasses set _attr_translation_key; it names the entity and makes its unique id.
    """

    _attr_has_entity_name = True
    _attr_translation_key: str

    def __init__(self, coordinator: HybridHeatingCoordinator) -> None:
        super().__init__(coordinator)
        entry_id = coordinator.config_entry.entry_id
        self._attr_unique_id = f"{entry_id}_{self._attr_translation_key}"
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
        return self.coordinator.data.decision

    def observed(self, layer: Layer) -> bool:
        """True when the layer is not ACTIVE, so the value shows what it would do."""
        return not is_live(self.coordinator.settings, layer)
