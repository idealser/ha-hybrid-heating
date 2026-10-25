from __future__ import annotations

import json

from custom_components.hybrid_heating.diagnostics import async_get_config_entry_diagnostics
from tests.integration.conftest import setup_integration


async def test_diagnostics(hass, fake_home):
    entry = await setup_integration(hass)
    d = await async_get_config_entry_diagnostics(hass, entry)
    assert {"version", "enabled", "entities", "settings", "controller", "takeover", "window", "log"} <= set(d)
    assert d["entities"]["thermostat"] == "climate.thermostat" and d["log"]
    assert d["window"] == {"buckets": 1, "mean": 13.8}
    json.dumps(d)
