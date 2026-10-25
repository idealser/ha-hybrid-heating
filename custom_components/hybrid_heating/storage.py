"""What survives a restart: settings, controller and takeover state, the outdoor window and the log."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .codec import from_data, restore_controller_state, settings_from_saved
from .const import DOMAIN, SAVE_DELAY_S, STORAGE_VERSION
from .core.controller import ControllerState
from .core.types import Settings
from .decision_log import DecisionLog
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


def _enabled(data: Any) -> bool:
    if not isinstance(data, bool):
        raise ValueError(f"enabled must be a bool, got {data!r}")
    return data


def _controller(data: Any, now: datetime) -> ControllerState:
    from_data(ControllerState, data, strict=False)  # raises if unreadable, so the reset is reported
    return restore_controller_state(data, now)


def _window(data: Any) -> OutdoorWindow:
    if not isinstance(data, list):
        raise ValueError("window must be a list")
    return OutdoorWindow.from_data(data)


def _saved_at(data: Any) -> datetime | None:
    try:
        return datetime.fromisoformat(data) if isinstance(data, str) else None
    except ValueError:
        return None


class HybridStore:
    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self._state: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, f"{DOMAIN}.{entry_id}")
        self._log: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, f"{DOMAIN}.{entry_id}.log")

    async def async_load(self, now: datetime) -> Loaded:
        """Each section is read on its own; an unreadable one falls back to its default and is reported."""
        raw = await self._state.async_load()
        data = raw if isinstance(raw, dict) else {}
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

        enabled = section("enabled", _enabled, True)
        settings = section("settings", settings_from_saved, Settings())
        state = section("controller", lambda d: _controller(d, now), ControllerState.initial(now))
        takeover = section("takeover", lambda d: from_data(TakeoverState, d, strict=False), TakeoverState())
        window = section("window", _window, OutdoorWindow())
        return Loaded(
            enabled=enabled,
            settings=settings,
            state=state,
            takeover=takeover,
            window=window,
            log=DecisionLog.from_data(log_raw.get("entries") if isinstance(log_raw, dict) else None),
            saved_at=_saved_at(data.get("saved_at")) if data else None,
            reset_sections=tuple(reset),
        )

    async def async_save_now(self, state_data: dict[str, Any], log_data: dict[str, Any]) -> None:
        await self._state.async_save(state_data)
        await self._log.async_save(log_data)

    def schedule_save(
        self, state_func: Callable[[], dict[str, Any]], log_func: Callable[[], dict[str, Any]]
    ) -> None:
        self._state.async_delay_save(state_func, SAVE_DELAY_S)
        self._log.async_delay_save(log_func, SAVE_DELAY_S)

    async def async_remove(self) -> None:
        await self._state.async_remove()
        await self._log.async_remove()
