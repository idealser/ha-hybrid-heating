"""Binary sensors: whether the module wants the boiler to heat, and whether it is shedding load."""

from __future__ import annotations

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
    async_add_entities(
        [BoilerCallSensor(coordinator, "boiler_call"), LoadSheddingSensor(coordinator, "load_shedding")]
    )


class BoilerCallSensor(HybridHeatingEntity, BinarySensorEntity):
    @property
    def is_on(self) -> bool | None:
        data = self.coordinator.data
        if data is None:
            return None
        return desired_call(self.coordinator.settings, data.decision, self.coordinator.state, data.now)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        data = self.coordinator.data
        return {
            "actual": data.snapshot.boiler_call_on if data is not None else None,
            "observe": self.observed(Layer.BOILER),
        }


class LoadSheddingSensor(HybridHeatingEntity, BinarySensorEntity):
    @property
    def is_on(self) -> bool | None:
        data = self.coordinator.data
        if data is None:
            return None
        return load_shedding_active(
            layer_load_state(self.coordinator.settings, self.coordinator.state), data.now
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        data = self.coordinator.data
        load = layer_load_state(self.coordinator.settings, self.coordinator.state)
        return {
            "water_heater_shed": load.water_heater_shed,
            "rods_shed": load.rods_shed,
            "load_kw": data.snapshot.load_kw if data is not None else None,
            "observe": self.observed(Layer.LOAD),
        }
