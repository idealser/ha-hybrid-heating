"""Diagnostics download: everything the module knows. It holds no secrets, so nothing is redacted."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .codec import to_data
from .const import LOG_SIZE, VERSION
from .coordinator import HybridHeatingConfigEntry


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: HybridHeatingConfigEntry
) -> dict[str, Any]:
    c = entry.runtime_data
    now = dt_util.now()
    return {
        "version": VERSION,
        "enabled": c.enabled,
        "entities": c.entities.to_mapping(),
        "settings": to_data(c.settings),
        "controller": to_data(c.state),
        "takeover": to_data(c.takeover),
        "window": {
            "buckets": len(c.window.to_data()),
            "mean": c.window.mean(now, c.settings.season.window_hours),
        },
        "log": c.log.latest(LOG_SIZE),
    }
