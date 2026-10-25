from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

import pytest
from homeassistant.core import HomeAssistant, ServiceCall
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.hybrid_heating.const import DOMAIN
from tests.fakes import FAKE_ENTITIES, NOW_STATES

ENTRY_ID = "hybrid_heating_test_entry"
ACTIVE_ALL = {"layers": {"boiler": "active", "ac": "active", "load": "active"}}

RECORDED_SERVICES = (
    ("switch", "turn_on"),
    ("switch", "turn_off"),
    ("climate", "set_temperature"),
    ("climate", "set_hvac_mode"),
    ("climate", "set_fan_mode"),
    ("number", "set_value"),
    ("automation", "turn_on"),
    ("automation", "turn_off"),
)


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    return


@pytest.fixture(autouse=True)
def frozen_now(request: pytest.FixtureRequest) -> Any:
    """Freeze the clock at T0 (15:00 in Berlin). Tests marked real_time need asyncio timers to run."""
    if request.node.get_closest_marker("real_time"):
        return None
    freezer = request.getfixturevalue("freezer")
    freezer.move_to("2026-11-01T14:00:00+00:00")
    return freezer


@pytest.fixture
async def fake_home(hass: HomeAssistant) -> dict[str, str | bool]:
    """Sets the "now" scenario states (tests/fakes.py) and returns the entity map."""
    await hass.config.async_set_time_zone("Europe/Berlin")
    for entity_id, s in NOW_STATES.items():
        hass.states.async_set(entity_id, s.state, dict(s.attributes))
    return dict(FAKE_ENTITIES)


class ServiceRecorder:
    """Records service calls to the devices the module drives. States are left as they were."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.log: list[tuple[str, str, dict[str, Any]]] = []
        self.contexts: list[str] = []
        self._fail: dict[tuple[str, str], Exception] = {}
        self._delay: dict[tuple[str, str], float] = {}
        for domain, service in RECORDED_SERVICES:
            hass.services.async_register(domain, service, self._handle)

    async def _handle(self, call: ServiceCall) -> None:
        key = (call.domain, call.service)
        self.log.append((call.domain, call.service, dict(call.data)))
        self.contexts.append(call.context.id)
        if key in self._delay:
            await asyncio.sleep(self._delay[key])
        if key in self._fail:
            raise self._fail[key]

    def names(self) -> list[tuple[str, str]]:
        return [(d, s) for d, s, _ in self.log]

    def clear(self) -> None:
        self.log.clear()
        self.contexts.clear()

    def fail(self, domain: str, service: str, exc: Exception) -> None:
        self._fail[(domain, service)] = exc

    def delay(self, domain: str, service: str, seconds: float) -> None:
        self._delay[(domain, service)] = seconds


@pytest.fixture
def calls(hass: HomeAssistant) -> ServiceRecorder:
    return ServiceRecorder(hass)


@pytest.fixture
def stored(hass_storage: dict[str, Any]) -> Callable[..., None]:
    """Pre-fill the module's store as if it had been saved before this start."""

    def write(**sections: Any) -> None:
        key = f"{DOMAIN}.{ENTRY_ID}"
        hass_storage[key] = {"version": 1, "minor_version": 1, "key": key, "data": sections}

    return write


async def setup_integration(hass: HomeAssistant, **data_overrides: Any) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, entry_id=ENTRY_ID, data=FAKE_ENTITIES | data_overrides)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def log_codes(coordinator: Any) -> list[str]:
    return [r["code"] for e in coordinator.log.to_data() for r in e["reasons"]]
