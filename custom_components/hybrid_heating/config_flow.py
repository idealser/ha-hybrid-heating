"""Setup wizard and options: which entities Hybrid Heating reads and drives."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import probatio as vol
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
    OptionsFlowWithReload,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.selector import (
    BooleanSelector,
    EntitySelector,
    EntitySelectorConfig,
)

from .const import (
    CONF_AC_BEDROOM,
    CONF_AC_LIVING,
    CONF_ACTIVE_RODS,
    CONF_BOILER_CALL,
    CONF_BOILER_FLOW,
    CONF_BOILER_POWER,
    CONF_BOILER_RODS,
    CONF_DISABLE_OVERPOWER_AUTOMATION,
    CONF_FLOW_TEMPERATURE,
    CONF_OUTDOOR,
    CONF_OVERPOWER_AUTOMATION,
    CONF_QUIET_BEDROOM,
    CONF_QUIET_LIVING,
    CONF_TEMP_BATH,
    CONF_TEMP_BEDROOM,
    CONF_TEMP_CHILD,
    CONF_TEMP_LIVING,
    CONF_THERMOSTAT,
    CONF_TOTAL_POWER,
    CONF_WATER_HEATER,
    CONF_WEATHER,
    DOMAIN,
    OPTIONAL_KEYS,
    TITLE,
)

type Fields = tuple[tuple[str, str], ...]

# (key, entity domain) per wizard step
BOILER_FIELDS: Fields = (
    (CONF_BOILER_CALL, "switch"),
    (CONF_BOILER_FLOW, "climate"),
    (CONF_BOILER_RODS, "number"),
    (CONF_FLOW_TEMPERATURE, "sensor"),
    (CONF_ACTIVE_RODS, "sensor"),
    (CONF_BOILER_POWER, "sensor"),
    (CONF_TOTAL_POWER, "sensor"),
    (CONF_WATER_HEATER, "switch"),
)
ROOM_FIELDS: Fields = (
    (CONF_TEMP_LIVING, "sensor"),
    (CONF_TEMP_BEDROOM, "sensor"),
    (CONF_TEMP_CHILD, "sensor"),
    (CONF_TEMP_BATH, "sensor"),
    (CONF_OUTDOOR, "sensor"),
    (CONF_WEATHER, "weather"),
    (CONF_AC_LIVING, "climate"),
    (CONF_AC_BEDROOM, "climate"),
    (CONF_QUIET_LIVING, "switch"),
    (CONF_QUIET_BEDROOM, "switch"),
)
COEXISTENCE_FIELDS: Fields = (
    (CONF_THERMOSTAT, "climate"),
    (CONF_OVERPOWER_AUTOMATION, "automation"),
)


def _entity_schema(fields: Fields) -> dict[vol.Marker, Any]:
    # No defaults: entity ids are never guessed, the user picks each one.
    return {
        (vol.Optional(key) if key in OPTIONAL_KEYS else vol.Required(key)): EntitySelector(
            EntitySelectorConfig(filter={"domain": domain})
        )
        for key, domain in fields
    }


def boiler_schema() -> vol.Schema:
    return vol.Schema(_entity_schema(BOILER_FIELDS))


def rooms_schema() -> vol.Schema:
    return vol.Schema(_entity_schema(ROOM_FIELDS))


def coexistence_schema(disable_automation: bool = False) -> vol.Schema:
    return vol.Schema(
        _entity_schema(COEXISTENCE_FIELDS)
        | {vol.Required(CONF_DISABLE_OVERPOWER_AUTOMATION, default=disable_automation): BooleanSelector()}
    )


def _unknown_entities(hass: HomeAssistant, values: dict[str, Any]) -> dict[str, str]:
    """Each chosen id must have a state or a registry entry (a disabled entity has only the latter)."""
    registry = er.async_get(hass)
    return {
        key: "entity_not_found"
        for key, value in values.items()
        if isinstance(value, str) and hass.states.get(value) is None and registry.async_get(value) is None
    }


async def _step(
    flow: ConfigFlow | OptionsFlow,
    step_id: str,
    schema: vol.Schema,
    values: dict[str, Any],
    user_input: dict[str, Any] | None,
    next_step: Callable[[], Awaitable[ConfigFlowResult]],
) -> ConfigFlowResult:
    """Show one wizard page; on valid input store it in `values` and go on."""
    errors: dict[str, str] = {}
    suggestions = values
    if user_input is not None:
        cleaned = {k: v for k, v in user_input.items() if v not in (None, "")}
        errors = _unknown_entities(flow.hass, cleaned)
        if not errors:
            for marker in schema.schema:
                values.pop(str(marker), None)  # an optional field left empty clears it
            values.update(cleaned)
            return await next_step()
        suggestions = {**values, **cleaned}
    return flow.async_show_form(
        step_id=step_id,
        data_schema=flow.add_suggested_values_to_schema(schema, suggestions),
        errors=errors,
    )


class HybridHeatingConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._values: dict[str, Any] = {}

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> HybridHeatingOptionsFlow:
        return HybridHeatingOptionsFlow()

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        return await _step(self, "user", boiler_schema(), self._values, user_input, self.async_step_rooms)

    async def async_step_rooms(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        return await _step(
            self, "rooms", rooms_schema(), self._values, user_input, self.async_step_coexistence
        )

    async def async_step_coexistence(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        return await _step(self, "coexistence", coexistence_schema(), self._values, user_input, self._finish)

    async def _finish(self) -> ConfigFlowResult:
        return self.async_create_entry(title=TITLE, data=self._values)


class HybridHeatingOptionsFlow(OptionsFlowWithReload):
    """The same three pages, prefilled from the entry. Reloads the entry when anything changed."""

    def __init__(self) -> None:
        self._values: dict[str, Any] = {}

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if not self._values:
            entry = self.config_entry
            self._values = {k: v for k, v in {**entry.data, **entry.options}.items() if v is not None}
        return await _step(self, "init", boiler_schema(), self._values, user_input, self.async_step_rooms)

    async def async_step_rooms(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        return await _step(
            self, "rooms", rooms_schema(), self._values, user_input, self.async_step_coexistence
        )

    async def async_step_coexistence(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        flag = bool(self._values.get(CONF_DISABLE_OVERPOWER_AUTOMATION, False))
        return await _step(
            self, "coexistence", coexistence_schema(flag), self._values, user_input, self._finish
        )

    async def _finish(self) -> ConfigFlowResult:
        # Options override data key by key, so a cleared optional entity is stored as None.
        cleared = {key: None for key in OPTIONAL_KEYS if key not in self._values}
        return self.async_create_entry(data={**self._values, **cleared})
