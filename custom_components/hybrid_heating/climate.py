"""The thermostat: the module as one climate entity, for tiles, the phone and voice assistants."""

from typing import Any

from homeassistant.components.climate import ClimateEntity
from homeassistant.components.climate.const import ATTR_HVAC_MODE, ClimateEntityFeature, HVACAction, HVACMode
from homeassistant.const import ATTR_TEMPERATURE, PRECISION_TENTHS, UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.util import dt as dt_util

from .coordinator import HybridHeatingConfigEntry
from .core.context import effective_target
from .core.types import AC_ROOMS, Layer, Preset, SeasonMode, Settings
from .entity import HybridHeatingEntity
from .status import boiler_driver

# What the card's steppers offer for each preset: min, max, step
TARGET_RANGES: dict[Preset, tuple[float, float, float]] = {
    Preset.COMFORT: (18.0, 26.0, 0.1),
    Preset.ECO: (16.0, 26.0, 0.1),
    Preset.NIGHT: (16.0, 26.0, 0.1),
    Preset.AWAY: (10.0, 20.0, 0.5),
}
# The modes are the heating season: Off keeps the heating off and the module in charge, where switching
# the module off would hand the boiler back to the old thermostat.
SEASON_FOR_MODE = {HVACMode.AUTO: SeasonMode.AUTO, HVACMode.HEAT: SeasonMode.ON, HVACMode.OFF: SeasonMode.OFF}
MODE_FOR_SEASON = {season: mode for mode, season in SEASON_FOR_MODE.items()}


async def async_setup_entry(
    hass: HomeAssistant, entry: HybridHeatingConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    async_add_entities([Thermostat(entry.runtime_data)])


class Thermostat(HybridHeatingEntity, ClimateEntity):
    _attr_translation_key = "thermostat"
    _attr_name = None  # the device's main entity: "Hybrid Heating"
    _attr_temperature_unit = UnitOfTemperature.CELSIUS
    _attr_precision = PRECISION_TENTHS
    _attr_hvac_modes = list(SEASON_FOR_MODE)
    _attr_preset_modes = [p.value for p in Preset]
    _attr_supported_features = (
        ClimateEntityFeature.TARGET_TEMPERATURE
        | ClimateEntityFeature.PRESET_MODE
        | ClimateEntityFeature.TURN_ON
        | ClimateEntityFeature.TURN_OFF
    )

    def _in_effect(self) -> tuple[Preset, float]:
        """From the settings, not the last decision, so a change shows before the next tick."""
        s = self.coordinator.settings
        return effective_target(s.targets, s.preset, dt_util.now())

    @property
    def hvac_mode(self) -> HVACMode:
        return MODE_FOR_SEASON[self.coordinator.settings.season.mode]

    @property
    def hvac_action(self) -> HVACAction | None:
        data = self.coordinator.data
        if data.decision is None:
            return None
        snap = data.snapshot
        if snap.boiler_call_on or any(snap.ac_hvac.get(r) == "heat" for r in AC_ROOMS):
            return HVACAction.HEATING  # whoever drives it: the flat is being heated
        season = self.coordinator.settings.season.mode
        if season is SeasonMode.OFF or (season is SeasonMode.AUTO and not data.decision.season_active):
            return HVACAction.OFF
        return HVACAction.IDLE

    @property
    def current_temperature(self) -> float | None:
        data = self.coordinator.data
        return boiler_driver(self.coordinator.settings, data.snapshot, data.decision)

    @property
    def target_temperature(self) -> float:
        return self._in_effect()[1]

    @property
    def min_temp(self) -> float:
        return TARGET_RANGES[self._in_effect()[0]][0]

    @property
    def max_temp(self) -> float:
        return TARGET_RANGES[self._in_effect()[0]][1]

    @property
    def target_temperature_step(self) -> float:
        return TARGET_RANGES[self._in_effect()[0]][2]

    @property
    def preset_mode(self) -> str:
        return self.coordinator.settings.preset.value

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        # Comfort turns into Night inside the night window: the target shown and moved is Night's then.
        return {"effective_preset": self._in_effect()[0].value, "observe": self.observed(Layer.BOILER)}

    async def async_set_temperature(self, **kwargs: Any) -> None:
        temperature: float | None = kwargs.get(ATTR_TEMPERATURE)
        mode: HVACMode | None = kwargs.get(ATTR_HVAC_MODE)
        now = dt_util.now()

        def patch(s: Settings) -> dict[str, Any]:
            out: dict[str, Any] = {}
            if mode is not None:
                out["season"] = {"mode": SEASON_FOR_MODE[HVACMode(mode)].value}
            if temperature is not None:
                # The preset in effect when the change lands keeps the new target for good.
                preset, _ = effective_target(s.targets, s.preset, now)
                step = TARGET_RANGES[preset][2]
                out["targets"] = {preset.value: round(round(temperature / step) * step, 1)}
            return out

        await self.coordinator.async_patch_settings(patch, "entity")

    async def async_set_hvac_mode(self, hvac_mode: HVACMode) -> None:
        season = SEASON_FOR_MODE[hvac_mode].value
        await self.coordinator.async_patch_settings({"season": {"mode": season}}, "entity")

    async def async_turn_on(self) -> None:
        await self.async_set_hvac_mode(HVACMode.AUTO)

    async def async_turn_off(self) -> None:
        await self.async_set_hvac_mode(HVACMode.OFF)

    async def async_set_preset_mode(self, preset_mode: str) -> None:
        await self.coordinator.async_patch_settings({"preset": preset_mode}, "entity")
