"""Sensors: flow target, weather zone, status line, and the heat loss and heat capacity estimates."""

from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .codec import to_data
from .const import DEFAULT_CAPACITY_KWH_PER_K, DEFAULT_HEAT_LOSS_W_PER_K
from .coordinator import HybridHeatingConfigEntry
from .core.types import Layer
from .entity import HybridHeatingEntity
from .texts import ZONE_KEYS, zone_key


async def async_setup_entry(
    hass: HomeAssistant, entry: HybridHeatingConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    coordinator = entry.runtime_data
    async_add_entities(
        [
            FlowTargetSensor(coordinator),
            ZoneSensor(coordinator),
            StatusSensor(coordinator),
            HeatLossSensor(coordinator),
            HeatCapacitySensor(coordinator),
        ]
    )


class FlowTargetSensor(HybridHeatingEntity, SensorEntity):
    _attr_translation_key = "flow_target"
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
        return {
            "boiler_setpoint": self.coordinator.data.snapshot.boiler_setpoint,
            "observe": self.observed(Layer.BOILER),
        }


class ZoneSensor(HybridHeatingEntity, SensorEntity):
    _attr_translation_key = "zone"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = list(ZONE_KEYS)

    @property
    def native_value(self) -> str | None:
        d = self.decision
        return zone_key(d.zone) if d is not None else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        d = self.decision
        return {"index": d.zone if d is not None else None}


class StatusSensor(HybridHeatingEntity, SensorEntity):
    _attr_translation_key = "status"
    _unrecorded_attributes = frozenset({"codes", "reasons"})  # change every tick, no use in history

    @property
    def native_value(self) -> str:
        return self.coordinator.data.status

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        d = self.decision
        reasons = d.reasons if d is not None else ()
        return {"codes": [r.code for r in reasons], "reasons": to_data(reasons)}


class HeatLossSensor(HybridHeatingEntity, SensorEntity):
    """What the estimates use: the weekly estimate when it is good, else the model's default."""

    _attr_translation_key = "heat_loss"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "W/K"

    @property
    def native_value(self) -> float:
        learned = self.coordinator.learning.heat_loss_w_per_k()
        return learned if learned is not None else DEFAULT_HEAT_LOSS_W_PER_K

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        e = self.coordinator.learning.data.heat_loss
        source = "model_default" if self.coordinator.learning.heat_loss_w_per_k() is None else "estimate"
        if e is None:
            return {"source": source}
        return {
            "source": source,
            "status": e.status,
            "estimate": e.w_per_k,
            "days_used": e.days_used,
            "r2": e.r2,
            "window_days": e.window_days,
            "computed_at": e.computed_at.isoformat(),
        }


class HeatCapacitySensor(HybridHeatingEntity, SensorEntity):
    """What the forecast uses: the nightly estimate when it is good, else the card's default."""

    _attr_translation_key = "heat_capacity"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "kWh/K"

    @property
    def native_value(self) -> float:
        learned = self.coordinator.learning.capacity_kwh_per_k()
        return learned if learned is not None else DEFAULT_CAPACITY_KWH_PER_K

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        e = self.coordinator.learning.data.capacity
        source = "model_default" if self.coordinator.learning.capacity_kwh_per_k() is None else "estimate"
        if e is None:
            return {"source": source}
        return {
            "source": source,
            "status": e.status,
            "estimate": e.kwh_per_k,
            "hours_used": e.hours_used,
            "cooled_k": e.cooled_k,
            "heat_loss_w_per_k": e.h_w_per_k,
            "window_days": e.window_days,
            "computed_at": e.computed_at.isoformat(),
        }
