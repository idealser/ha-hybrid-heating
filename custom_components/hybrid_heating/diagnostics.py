"""Diagnostics download: everything the module knows. It holds no secrets, so nothing is redacted."""

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .codec import to_data
from .const import LOG_SIZE
from .coordinator import HybridHeatingConfigEntry


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: HybridHeatingConfigEntry
) -> dict[str, Any]:
    c = entry.runtime_data
    return {
        **c.config_view(),
        "controller": to_data(c.state),
        "window": {"buckets": len(c.window.to_data()), "mean": c.window_mean(dt_util.now())},
        "log": c.log.latest(LOG_SIZE),
    }
