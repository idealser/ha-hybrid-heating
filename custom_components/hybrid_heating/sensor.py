"""Sensors: flow target, weather zone, status line and the heat loss estimate."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .codec import to_data
from .const import DEFAULT_HEAT_LOSS_W_PER_K
from .coordinator import HybridHeatingConfigEntry
from .core.types import Layer
from .entity import HybridHeatingEntity
from .texts import ZONE_KEYS


async def async_setup_entry(
    hass: HomeAssistant, entry: HybridHeatingConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    coordinator = entry.runtime_data
    async_add_entities(
        [
            FlowTargetSensor(coordinator, "flow_target"),
            ZoneSensor(coordinator, "zone"),
            StatusSensor(coordinator, "status"),
            HeatLossSensor(coordinator, "heat_loss"),
        ]
    )


class FlowTargetSensor(HybridHeatingEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.TEMPERATURE
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS
    _attr_suggested_display_precision = 1

    @property
    def native_value(self) -> float | None:
        d = self.decision
        return d.flow_target if d is not None else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        data = self.coordinator.data
        return {
            "boiler_setpoint": data.snapshot.boiler_setpoint if data is not None else None,
            "observe": self.observed(Layer.BOILER),
        }


class ZoneSensor(HybridHeatingEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = list(ZONE_KEYS)

    @property
    def native_value(self) -> str | None:
        d = self.decision
        return ZONE_KEYS[d.zone] if d is not None and 0 <= d.zone < len(ZONE_KEYS) else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        d = self.decision
        return {"index": d.zone if d is not None else None}


class StatusSensor(HybridHeatingEntity, SensorEntity):
    _unrecorded_attributes = frozenset({"codes", "reasons"})  # change every tick, no use in history

    @property
    def native_value(self) -> str | None:
        data = self.coordinator.data
        return data.status if data is not None else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        d = self.decision
        reasons = d.reasons if d is not None else ()
        return {"codes": [r.code for r in reasons], "reasons": to_data(reasons)}


class HeatLossSensor(HybridHeatingEntity, SensorEntity):
    """The model's default for now; stage 5 replaces it with a value learned from history."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "W/K"
    _attr_extra_state_attributes = {"source": "model_default"}

    @property
    def native_value(self) -> float:
        return DEFAULT_HEAT_LOSS_W_PER_K
