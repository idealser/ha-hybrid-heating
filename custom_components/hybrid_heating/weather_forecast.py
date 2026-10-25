"""The hourly forecast of the weather entity chosen in the setup wizard."""

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import dt as dt_util

from .core.forecast import forecast_reply, parse_hourly


class ForecastUnavailable(Exception):
    """The weather entity gave no usable hourly forecast."""


async def async_hourly_forecast(hass: HomeAssistant, weather_entity: str) -> dict[str, Any]:
    now = dt_util.utcnow()
    try:
        response = await hass.services.async_call(
            "weather",
            "get_forecasts",
            {"type": "hourly"},
            target={"entity_id": weather_entity},
            blocking=True,
            return_response=True,
        )
    except HomeAssistantError as err:  # no weather integration, or no hourly forecast from this one
        raise ForecastUnavailable(f"{weather_entity}: {err}") from err
    entity = response.get(weather_entity) if response else None
    items = entity.get("forecast") if isinstance(entity, dict) else None
    if not isinstance(items, list):
        raise ForecastUnavailable(f"{weather_entity}: the reply has no forecast")
    return forecast_reply(parse_hourly([i for i in items if isinstance(i, dict)], now), weather_entity, now)
