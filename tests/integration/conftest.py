from __future__ import annotations

import pytest
from homeassistant.core import HomeAssistant

from tests.fakes import FAKE_ENTITIES


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    return


@pytest.fixture
async def fake_home(hass: HomeAssistant) -> dict[str, str | bool]:
    """The "now" scenario: a mild evening, ACs off, boiler idle with 2 rods."""
    await hass.config.async_set_time_zone("Europe/Berlin")
    e = FAKE_ENTITIES
    s = hass.states.async_set
    s(e["outdoor"], "13.8")
    for key, value in (
        ("temp_living", "23.3"),
        ("temp_bedroom", "22.8"),
        ("temp_child", "22.6"),
        ("temp_bath", "23.4"),
    ):
        s(e[key], value)
    s(e["ac_living"], "off", {"temperature": 24, "fan_mode": "auto"})
    s(e["ac_bedroom"], "off", {"temperature": 25, "fan_mode": "auto"})
    s(e["boiler_flow"], "heat", {"temperature": 50, "target_temp_step": 1, "min_temp": 20, "max_temp": 80})
    s(e["boiler_rods"], "2")
    s(e["flow_temperature"], "48.5")
    s(e["active_rods"], "0")
    s(e["boiler_power"], "0", {"unit_of_measurement": "W"})
    s(e["total_power"], "1300", {"unit_of_measurement": "W"})
    s(e["boiler_call"], "off")
    s(e["water_heater"], "on")
    s(e["thermostat"], "heat", {"temperature": 22.5})
    s(e["overpower_automation"], "on")
    s(e["weather"], "cloudy")
    s(e["quiet_living"], "off")
    s(e["quiet_bedroom"], "off")
    return dict(e)
