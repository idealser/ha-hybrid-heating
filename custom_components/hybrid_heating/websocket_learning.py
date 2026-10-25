"""Websocket commands for the forecast, the suggestions and the Cold/Hot feedback.

hybrid_heating/get_forecast, hybrid_heating/get_suggestions, hybrid_heating/apply_suggestion and
hybrid_heating/dismiss_suggestion (admins only), hybrid_heating/feedback (anyone in the house).
"""

from typing import Any

import probatio as vol
from homeassistant.components import websocket_api
from homeassistant.components.websocket_api.connection import ActiveConnection
from homeassistant.components.websocket_api.decorators import async_response, require_admin, websocket_command
from homeassistant.core import HomeAssistant, callback

from .const import WS_PREFIX
from .core.learning import StaleSuggestion
from .core.types import Room
from .learning_manager import NoSuchSuggestion, NotReady
from .texts import LANGS, lang_for
from .weather_forecast import ForecastUnavailable, async_hourly_forecast
from .websocket import config_reply, coordinator_for, not_loaded

LANGUAGE = vol.Optional("language")


@callback
def async_register_learning_commands(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_get_forecast)
    websocket_api.async_register_command(hass, ws_get_suggestions)
    websocket_api.async_register_command(hass, ws_apply_suggestion)
    websocket_api.async_register_command(hass, ws_dismiss_suggestion)
    websocket_api.async_register_command(hass, ws_feedback)


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


def _lang(hass: HomeAssistant, msg: dict[str, Any]) -> str:
    return str(msg.get("language") or lang_for(hass.config.language))


@websocket_command({vol.Required("type"): f"{WS_PREFIX}get_suggestions", LANGUAGE: vol.In(list(LANGS))})
@callback
def ws_get_suggestions(hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]) -> None:
    c = coordinator_for(hass)
    if c is None:
        not_loaded(connection, msg)
        return
    connection.send_result(msg["id"], {"suggestions": c.learning.views(_lang(hass, msg))})


@require_admin
@websocket_command(
    {
        vol.Required("type"): f"{WS_PREFIX}apply_suggestion",
        vol.Required("suggestion_id"): str,
        LANGUAGE: vol.In(list(LANGS)),
    }
)
@async_response
async def ws_apply_suggestion(hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]) -> None:
    c = coordinator_for(hass)
    if c is None:
        not_loaded(connection, msg)
        return
    try:
        await c.learning.async_apply(msg["suggestion_id"])
    except NoSuchSuggestion:
        connection.send_error(msg["id"], "not_found", f"No such suggestion: {msg['suggestion_id']}")
        return
    except StaleSuggestion:
        connection.send_error(
            msg["id"], "stale", "The setting was changed since; the suggestion is withdrawn"
        )
        return
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_config", str(err))
        return
    connection.send_result(msg["id"], config_reply(c))


@require_admin
@websocket_command(
    {vol.Required("type"): f"{WS_PREFIX}dismiss_suggestion", vol.Required("suggestion_id"): str}
)
@async_response
async def ws_dismiss_suggestion(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    c = coordinator_for(hass)
    if c is None:
        not_loaded(connection, msg)
        return
    try:
        await c.learning.async_dismiss(msg["suggestion_id"])
    except NoSuchSuggestion:
        connection.send_error(msg["id"], "not_found", f"No such suggestion: {msg['suggestion_id']}")
        return
    connection.send_result(msg["id"], {})


@websocket_command(
    {
        vol.Required("type"): f"{WS_PREFIX}feedback",
        vol.Required("room"): vol.In([r.value for r in Room]),
        vol.Required("kind"): vol.In(["cold", "hot"]),
        LANGUAGE: vol.In(list(LANGS)),
    }
)
@async_response
async def ws_feedback(hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]) -> None:
    c = coordinator_for(hass)
    if c is None:
        not_loaded(connection, msg)
        return
    try:
        sg = await c.learning.async_feedback(Room(msg["room"]), msg["kind"])
    except NotReady:
        connection.send_error(msg["id"], "not_ready", "The module has not decided anything yet")
        return
    view = None if sg is None else next(v for v in c.learning.views(_lang(hass, msg)) if v["id"] == sg.id)
    connection.send_result(msg["id"], {"suggestion": view})
