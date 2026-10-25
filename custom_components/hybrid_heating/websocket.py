"""Websocket commands for the dashboard card.

hybrid_heating/get_config, hybrid_heating/set_config (admins only), hybrid_heating/get_status,
hybrid_heating/get_log, hybrid_heating/get_plan and hybrid_heating/set_plan (admins only).
The forecast, the suggestions and the feedback are in websocket_learning.py.
"""

from typing import Any

import probatio as vol
from homeassistant.components import websocket_api
from homeassistant.components.websocket_api.connection import ActiveConnection
from homeassistant.components.websocket_api.decorators import async_response, require_admin, websocket_command
from homeassistant.core import HomeAssistant, callback

from .codec import parse_ts
from .const import DOMAIN, LOG_SIZE, WS_PREFIX
from .coordinator import HybridHeatingCoordinator
from .core.types import Reason
from .floor_plan import validate_plan
from .status import build_status
from .texts import LANGS, lang_for, render_reason


@callback
def async_register_websocket(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_get_config)
    websocket_api.async_register_command(hass, ws_set_config)
    websocket_api.async_register_command(hass, ws_get_log)
    websocket_api.async_register_command(hass, ws_get_status)
    websocket_api.async_register_command(hass, ws_get_plan)
    websocket_api.async_register_command(hass, ws_set_plan)


def coordinator_for(hass: HomeAssistant) -> HybridHeatingCoordinator | None:
    entries = hass.config_entries.async_loaded_entries(DOMAIN)
    return entries[0].runtime_data if entries else None


def not_loaded(connection: ActiveConnection, msg: dict[str, Any]) -> None:
    connection.send_error(msg["id"], "not_loaded", "Hybrid Heating is not set up or not loaded")


def _config(c: HybridHeatingCoordinator) -> dict[str, Any]:
    return {**c.config_view(), "status": c.data.status}


@websocket_command({vol.Required("type"): f"{WS_PREFIX}get_config"})
@callback
def ws_get_config(hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]) -> None:
    c = coordinator_for(hass)
    if c is None:
        not_loaded(connection, msg)
        return
    connection.send_result(msg["id"], _config(c))


@require_admin
@websocket_command({vol.Required("type"): f"{WS_PREFIX}set_config", vol.Required("settings"): dict})
@async_response
async def ws_set_config(hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]) -> None:
    c = coordinator_for(hass)
    if c is None:
        not_loaded(connection, msg)
        return
    try:
        await c.async_patch_settings(msg["settings"], "ws")
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_config", str(err))
        return
    connection.send_result(msg["id"], _config(c))


def _with_texts(entry: dict[str, Any], lang: str) -> dict[str, Any]:
    reasons = [
        {**r, "text": render_reason(Reason("system", r.get("code", "?"), r.get("data") or {}), lang)}
        for r in entry.get("reasons", [])
    ]
    return {**entry, "reasons": reasons}


@websocket_command(
    {
        vol.Required("type"): f"{WS_PREFIX}get_log",
        vol.Optional("limit", default=100): vol.All(int, vol.Range(min=1, max=LOG_SIZE)),
        vol.Optional("before"): str,
        vol.Optional("language"): vol.In(list(LANGS)),
    }
)
@callback
def ws_get_log(hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]) -> None:
    c = coordinator_for(hass)
    if c is None:
        not_loaded(connection, msg)
        return
    before = None
    if "before" in msg and (before := parse_ts(msg["before"])) is None:
        message = f"before must be an ISO time with a time zone: {msg['before']!r}"
        connection.send_error(msg["id"], "invalid_format", message)
        return
    lang = msg.get("language") or lang_for(hass.config.language)
    entries = [_with_texts(e, lang) for e in c.log.latest(msg["limit"], before)]
    connection.send_result(msg["id"], {"entries": entries})


@websocket_command(
    {vol.Required("type"): f"{WS_PREFIX}get_status", vol.Optional("language"): vol.In(list(LANGS))}
)
@callback
def ws_get_status(hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]) -> None:
    c = coordinator_for(hass)
    if c is None:
        not_loaded(connection, msg)
        return
    data = c.data
    status = build_status(
        settings=c.settings,
        snap=data.snapshot,
        decision=data.decision,
        state=c.state,
        revision=c.revision,
        log_seq=c.log.revision,
        suggestions_seq=c.learning.revision,
        enabled=c.enabled,
        now=data.now,
        language=msg.get("language") or lang_for(hass.config.language),
        text=render_reason,
    )
    connection.send_result(msg["id"], status)


@websocket_command({vol.Required("type"): f"{WS_PREFIX}get_plan"})
@async_response
async def ws_get_plan(hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]) -> None:
    c = coordinator_for(hass)
    if c is None:
        not_loaded(connection, msg)
        return
    connection.send_result(msg["id"], {"plan": await c.store.async_load_plan()})


@require_admin
@websocket_command({vol.Required("type"): f"{WS_PREFIX}set_plan", vol.Required("plan"): vol.Any(None, dict)})
@async_response
async def ws_set_plan(hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]) -> None:
    """Store the user's floor plan for the card; null goes back to the built-in schematic."""
    c = coordinator_for(hass)
    if c is None:
        not_loaded(connection, msg)
        return
    try:
        plan = None if msg["plan"] is None else validate_plan(msg["plan"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], "invalid_plan", str(err))
        return
    await c.store.async_save_plan(plan)
    connection.send_result(msg["id"], {"plan": plan})
