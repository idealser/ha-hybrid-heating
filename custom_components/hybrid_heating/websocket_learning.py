"""Websocket commands for the forecast, the suggestions and the Cold/Hot feedback.

hybrid_heating/get_forecast.
"""

from typing import Any

import probatio as vol
from homeassistant.components import websocket_api
from homeassistant.components.websocket_api.connection import ActiveConnection
from homeassistant.components.websocket_api.decorators import async_response, websocket_command
from homeassistant.core import HomeAssistant, callback

from .const import WS_PREFIX
from .weather_forecast import ForecastUnavailable, async_hourly_forecast
from .websocket import coordinator_for, not_loaded


@callback
def async_register_learning_commands(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_get_forecast)


@websocket_command({vol.Required("type"): f"{WS_PREFIX}get_forecast"})
@async_response
async def ws_get_forecast(hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]) -> None:
    c = coordinator_for(hass)
    if c is None:
        not_loaded(connection, msg)
        return
    try:
        reply = await async_hourly_forecast(hass, c.entities.weather)
    except ForecastUnavailable as err:
        connection.send_error(msg["id"], "forecast_unavailable", str(err))
        return
    connection.send_result(msg["id"], reply)
