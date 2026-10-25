"""Binary sensors: whether the module wants the boiler to heat, and whether it is shedding load."""

from typing import Any

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .coordinator import HybridHeatingConfigEntry
from .core.types import Layer
from .entity import HybridHeatingEntity
from .status import desired_call, layer_load_state, load_shedding_active


async def async_setup_entry(
    hass: HomeAssistant, entry: HybridHeatingConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    coordinator = entry.runtime_data
    async_add_entities([BoilerCallSensor(coordinator), LoadSheddingSensor(coordinator)])


class BoilerCallSensor(HybridHeatingEntity, BinarySensorEntity):
    _attr_translation_key = "boiler_call"

    @property
    def is_on(self) -> bool | None:
        data = self.coordinator.data
        return desired_call(self.coordinator.settings, data.decision, self.coordinator.state, data.now)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            "actual": self.coordinator.data.snapshot.boiler_call_on,
            "observe": self.observed(Layer.BOILER),
        }


class LoadSheddingSensor(HybridHeatingEntity, BinarySensorEntity):
    _attr_translation_key = "load_shedding"
    _unrecorded_attributes = frozenset({"load_kw"})  # changes every tick; the power meter has the history

    @property
    def is_on(self) -> bool:
        load = layer_load_state(self.coordinator.settings, self.coordinator.state)
        return load_shedding_active(load, self.coordinator.data.now)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        load = layer_load_state(self.coordinator.settings, self.coordinator.state)
        return {
            "water_heater_shed": load.water_heater_shed,
            "rods_shed": load.rods_shed,
            "load_kw": self.coordinator.data.snapshot.load_kw,
            "observe": self.observed(Layer.LOAD),
        }
