"""Controller actions as Home Assistant service calls. No Home Assistant imports here."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal

from .core.types import Action, ActionKind, Room
from .entity_map import EntityMap
from .view import StateView, attr_float

type Status = Literal["ok", "skipped", "failed"]

_SEVERITY: Mapping[Status, int] = {"ok": 0, "skipped": 1, "failed": 2}


@dataclass(frozen=True)
class Command:
    domain: str
    service: str
    data: Mapping[str, Any]

    @property
    def entity_id(self) -> str:
        return str(self.data["entity_id"])


@dataclass(frozen=True)
class CommandResult:
    command: Command
    status: Status
    detail: str | None = None


@dataclass(frozen=True)
class ActionOutcome:
    action: Action
    status: Status
    detail: str | None


def outcome_for(action: Action, results: Sequence[CommandResult]) -> ActionOutcome:
    """The worst status among the action's commands (failed > skipped > ok); no commands is skipped."""
    if not results:
        return ActionOutcome(action, "skipped", None)
    worst = max(results, key=lambda r: _SEVERITY[r.status])
    return ActionOutcome(action, worst.status, worst.detail)


def toggle(domain: str, entity_id: str, on: bool) -> Command:
    return Command(domain, "turn_on" if on else "turn_off", {"entity_id": entity_id})


def set_hvac_mode(entity_id: str, mode: str) -> Command:
    return Command("climate", "set_hvac_mode", {"entity_id": entity_id, "hvac_mode": mode})


def _boiler_flow(value: float, entity_id: str, view: StateView) -> float:
    """Round to the boiler's setpoint step and clamp to its range, as far as the entity tells them."""
    state = view.get(entity_id)
    step = attr_float(state, "target_temp_step") or 1.0
    flow = round(round(value / step) * step, 3)
    low, high = attr_float(state, "min_temp"), attr_float(state, "max_temp")
    if low is not None:
        flow = max(flow, low)
    if high is not None:
        flow = min(flow, high)
    return float(flow)


def _room(action: Action) -> Room:
    if action.room is None:
        raise ValueError(f"{action.kind} needs a room")
    return action.room


def commands_for(action: Action, entities: EntityMap, view: StateView) -> list[Command]:
    kind, value = action.kind, action.value
    match kind:
        case ActionKind.BOILER_CALL:
            return [toggle("switch", entities.boiler_call, bool(value))]
        case ActionKind.BOILER_FLOW:
            flow = _boiler_flow(float(value), entities.boiler_flow, view)
            return [
                Command(
                    "climate", "set_temperature", {"entity_id": entities.boiler_flow, "temperature": flow}
                )
            ]
        case ActionKind.BOILER_RODS:
            return [Command("number", "set_value", {"entity_id": entities.boiler_rods, "value": int(value)})]
        case ActionKind.WATER_HEATER:
            return [toggle("switch", entities.water_heater, bool(value))]
        case ActionKind.AC_HVAC:
            return [set_hvac_mode(entities.acs[_room(action)], str(value))]
        case ActionKind.AC_SETPOINT:
            ac = entities.acs[_room(action)]
            return [Command("climate", "set_temperature", {"entity_id": ac, "temperature": value})]
        case ActionKind.AC_QUIET:
            room = _room(action)
            ac, quiet = entities.acs[room], entities.quiet[room]
            on = bool(value)
            fan = Command("climate", "set_fan_mode", {"entity_id": ac, "fan_mode": "low" if on else "auto"})
            if quiet is None:
                return [fan]
            return [fan, toggle("switch", quiet, True)] if on else [toggle("switch", quiet, False), fan]
