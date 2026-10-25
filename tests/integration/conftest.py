from __future__ import annotations

import pytest
from homeassistant.core import HomeAssistant

from tests.fakes import FAKE_ENTITIES, NOW_STATES


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    return


@pytest.fixture
async def fake_home(hass: HomeAssistant) -> dict[str, str | bool]:
    """Sets the "now" scenario states (tests/fakes.py) and returns the entity map."""
    await hass.config.async_set_time_zone("Europe/Berlin")
    for entity_id, s in NOW_STATES.items():
        hass.states.async_set(entity_id, s.state, dict(s.attributes))
    return dict(FAKE_ENTITIES)
