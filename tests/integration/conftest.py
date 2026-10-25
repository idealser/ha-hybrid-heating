import asyncio
import inspect
from collections.abc import Callable
from typing import Any

import pytest
from homeassistant.core import Context, HomeAssistant, ServiceRegistry
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from custom_components.hybrid_heating.const import DOMAIN, STORAGE_VERSION
from tests.conftest import T0, TZ, sec
from tests.fakes import FAKE_ENTITIES, NOW_STATES, TH, TOTAL

ENTRY_ID = "hybrid_heating_test_entry"
STORE_KEY = f"{DOMAIN}.{ENTRY_ID}"
LOG_KEY = f"{STORE_KEY}.log"
TICK = "custom_components.hybrid_heating.coordinator.tick"  # patch target for a failing or spied tick
ACTIVE_ALL = {"layers": {"boiler": "active", "ac": "active", "load": "active"}}
THERMOSTAT_OFF = ("climate", "set_hvac_mode", {"entity_id": TH, "hvac_mode": "off"})
RESTORE_TH = ("climate", "set_temperature", {"entity_id": TH, "temperature": 22.5, "hvac_mode": "heat"})


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    return


@pytest.fixture(autouse=True)
def frozen_now(request: pytest.FixtureRequest) -> Any:
    """Freeze the clock at T0. Tests marked real_time need asyncio timers that actually run."""
    if request.node.get_closest_marker("real_time"):
        return None
    freezer = request.getfixturevalue("freezer")
    freezer.move_to(T0)
    return freezer


@pytest.fixture
async def fake_home(hass: HomeAssistant) -> None:
    """Set the "now" scenario states from tests/fakes.py."""
    await hass.config.async_set_time_zone(TZ.key)
    for entity_id, s in NOW_STATES.items():
        hass.states.async_set(entity_id, s.state, dict(s.attributes))


_ASYNC_CALL = inspect.signature(ServiceRegistry.async_call)


class ServiceRecorder:
    """Records service calls to the devices the module drives. States are left as they were.

    Calls are caught at the service registry, so it does not matter which Home Assistant components
    have registered the same services (the switch platform does once our entities load). Calls to
    this integration's own entities go through to Home Assistant as usual.
    """

    def __init__(self, hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch) -> None:
        self.log: list[tuple[str, str, dict[str, Any]]] = []
        self.contexts: list[str] = []
        self._fail: dict[tuple[str, str], Exception] = {}
        self._delay: dict[tuple[str, str], float] = {}
        original = ServiceRegistry.async_call
        recorder = self

        async def async_call(registry: ServiceRegistry, *args: Any, **kwargs: Any) -> Any:
            call = _ASYNC_CALL.bind(registry, *args, **kwargs)
            call.apply_defaults()
            domain, data = call.arguments["domain"], call.arguments["service_data"] or {}
            entity_id = data.get("entity_id")
            if (
                registry is hass.services
                and isinstance(entity_id, str)
                and not entity_id.startswith(f"{domain}.{DOMAIN}_")
            ):
                return await recorder._handle(
                    domain, call.arguments["service"], dict(data), call.arguments["context"]
                )
            return await original(registry, *args, **kwargs)

        monkeypatch.setattr(ServiceRegistry, "async_call", async_call)

    async def _handle(self, domain: str, service: str, data: dict[str, Any], context: Context | None) -> None:
        key = (domain, service)
        self.log.append((domain, service, data))
        self.contexts.append(context.id if context is not None else "")
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

    def stop_failing(self) -> None:
        self._fail.clear()

    def delay(self, domain: str, service: str, seconds: float) -> None:
        self._delay[(domain, service)] = seconds


@pytest.fixture
def calls(hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch) -> ServiceRecorder:
    return ServiceRecorder(hass, monkeypatch)


@pytest.fixture
def stored(hass_storage: dict[str, Any]) -> Callable[..., None]:
    """Pre-fill the module's store as if it had been saved before this start."""

    def write(**sections: Any) -> None:
        hass_storage[STORE_KEY] = {
            "version": STORAGE_VERSION,
            "minor_version": 1,
            "key": STORE_KEY,
            "data": sections,
        }

    return write


def add_entry(hass: HomeAssistant, **data_overrides: Any) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, entry_id=ENTRY_ID, data=FAKE_ENTITIES | data_overrides)
    entry.add_to_hass(hass)
    return entry


async def setup_integration(hass: HomeAssistant, **data_overrides: Any) -> MockConfigEntry:
    entry = add_entry(hass, **data_overrides)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def log_reasons(coordinator: Any, code: str | None = None) -> list[dict[str, Any]]:
    """Every logged reason, oldest first; only those with `code` if given."""
    return [r for e in coordinator.log.to_data() for r in e["reasons"] if code is None or r["code"] == code]


def log_codes(coordinator: Any) -> list[str]:
    return [r["code"] for r in log_reasons(coordinator)]


def set_power(hass: HomeAssistant, watts: float) -> None:
    hass.states.async_set(TOTAL, str(watts), {"unit_of_measurement": "W"})


async def step(freezer: Any, hass: HomeAssistant, seconds: float) -> None:
    """Move the frozen clock on and run whatever became due."""
    freezer.tick(sec(seconds))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
