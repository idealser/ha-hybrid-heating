"""What survives a restart: settings, controller and takeover state, the outdoor window, the log, the plan
and what the module learns."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import probatio as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .codec import from_data, parse_ts, restore_controller_state, settings_from_saved
from .const import DOMAIN, STORAGE_VERSION
from .core.controller import ControllerState
from .core.types import Settings
from .decision_log import DecisionLog
from .floor_plan import validate_plan
from .takeover import TakeoverState
from .window import OutdoorWindow


@dataclass(frozen=True)
class Loaded:
    enabled: bool
    settings: Settings
    state: ControllerState
    takeover: TakeoverState
    window: OutdoorWindow
    log: DecisionLog
    saved_at: datetime | None
    reset_sections: tuple[str, ...]
    failures: int  # failed ticks in a row, kept across setup retries and restarts


def _failures(data: Any) -> int:
    count = from_data(int, data)
    if count < 0:
        raise ValueError(f"failures must be a count, got {count}")
    return count


def _window(data: Any) -> OutdoorWindow:
    if not isinstance(data, list):
        raise ValueError("window must be a list")
    return OutdoorWindow.from_data(data)


def _takeover(data: Any) -> TakeoverState:
    return from_data(TakeoverState, data, strict=False)


class HybridStore:
    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        key = f"{DOMAIN}.{entry_id}"
        # Written atomically: a power cut while saving must not leave a half-written state file.
        self._state: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, key, atomic_writes=True)
        # The log is large and only appended to, so it is encoded off the event loop.
        self._log: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, f"{key}.log", serialize_in_event_loop=False
        )
        # The user's floor plan for the card; read only when a card asks for it.
        self._plan: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, f"{key}.plan", atomic_writes=True)
        # Marks, mornings, suggestions, day tallies and the heat-loss estimate.
        self._learning: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, f"{key}.learning", atomic_writes=True
        )

    async def _load_state(self) -> dict[str, Any]:
        raw = await self._state.async_load()
        return raw if isinstance(raw, dict) else {}

    async def async_load(self, now: datetime) -> Loaded:
        """Each section is read on its own; an unreadable one falls back to its default and is reported."""
        data = await self._load_state()
        log_raw = await self._log.async_load()
        reset: list[str] = []

        def section[T](name: str, parse: Callable[[Any], T], default: T) -> T:
            if name not in data:
                return default
            try:
                return parse(data[name])
            except ValueError, TypeError:
                reset.append(name)
                return default

        enabled = section("enabled", lambda d: from_data(bool, d), True)
        settings = section("settings", settings_from_saved, Settings())
        state = section(
            "controller", lambda d: restore_controller_state(d, now), ControllerState.initial(now)
        )
        takeover = section("takeover", _takeover, TakeoverState())
        window = section("window", _window, OutdoorWindow())
        failures = section("failures", _failures, 0)
        return Loaded(
            enabled=enabled,
            settings=settings,
            state=state,
            takeover=takeover,
            window=window,
            log=DecisionLog.from_data(log_raw.get("entries") if isinstance(log_raw, dict) else None),
            saved_at=parse_ts(data.get("saved_at")),
            reset_sections=tuple(reset),
            failures=failures,
        )

    async def async_load_takeover(self) -> TakeoverState:
        """Only what the module still holds (for removal), without reading the log."""
        data = await self._load_state()
        try:
            return _takeover(data.get("takeover", {}))
        except ValueError, TypeError:
            return TakeoverState()

    async def async_save_now(self, state_data: dict[str, Any], log_data: dict[str, Any] | None) -> None:
        """Save the state; the log too unless it is None (nothing was appended since the last save)."""
        await self._state.async_save(state_data)
        if log_data is not None:
            await self._log.async_save(log_data)

    async def async_load_plan(self) -> dict[str, Any] | None:
        """The uploaded plan, or None for the card's schematic (also when the saved one is unreadable)."""
        raw = await self._plan.async_load()
        if not isinstance(raw, dict) or raw.get("plan") is None:
            return None
        try:
            return validate_plan(raw["plan"])
        except vol.Invalid:
            return None

    async def async_save_plan(self, plan: dict[str, Any] | None) -> None:
        if plan is None:
            await self._plan.async_remove()
        else:
            await self._plan.async_save({"plan": plan})

    async def async_load_learning(self) -> Any:
        return await self._learning.async_load()

    async def async_save_learning(self, data: dict[str, Any]) -> None:
        await self._learning.async_save(data)

    async def async_remove(self) -> None:
        await self._state.async_remove()
        await self._log.async_remove()
        await self._plan.async_remove()
        await self._learning.async_remove()
