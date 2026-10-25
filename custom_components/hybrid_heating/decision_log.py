"""Bounded log of what the module decided and did, newest last. No Home Assistant imports here."""

from __future__ import annotations

from collections import deque
from collections.abc import Iterable, Sequence
from datetime import datetime
from typing import Any

from .codec import to_data
from .commands import ActionOutcome, CommandResult
from .const import LOG_SIZE
from .core.types import Decision, Reason


def _reasons(reasons: Iterable[Reason]) -> list[dict[str, Any]]:
    return [{"layer": to_data(r.layer), "code": r.code, "data": to_data(r.data)} for r in reasons]


def _parse_ts(entry: Any) -> datetime | None:
    if not isinstance(entry, dict) or not isinstance(entry.get("ts"), str):
        return None
    try:
        return datetime.fromisoformat(entry["ts"])
    except ValueError:
        return None


class DecisionLog:
    def __init__(self, entries: Iterable[dict[str, Any]] = ()) -> None:
        self._entries: deque[dict[str, Any]] = deque(entries, maxlen=LOG_SIZE)
        self.last_codes: frozenset[tuple[str, str]] = frozenset()
        self._last_outcomes: tuple[tuple[Any, ...], ...] = ()
        self._last_failed_system: tuple[Any, ...] | None = None

    def record_tick(self, now: datetime, decision: Decision, outcomes: Sequence[ActionOutcome]) -> bool:
        """Log a tick if it acted or brought a reason that the previous tick did not have."""
        codes = frozenset((str(to_data(r.layer)), r.code) for r in decision.reasons)
        new = codes - self.last_codes
        self.last_codes = codes
        signature = tuple(
            (o.action.kind, o.action.value, o.action.room, o.status, o.detail) for o in outcomes
        )
        repeated = signature == self._last_outcomes  # e.g. the same command skipped every tick
        self._last_outcomes = signature
        if not new and (not outcomes or repeated):
            return False
        self._entries.append(
            {
                "ts": now.isoformat(),
                "kind": "tick",
                "zone": decision.zone,
                "target": decision.target,
                "preset": to_data(decision.preset),
                "flow_target": decision.flow_target,
                "season_active": decision.season_active,
                "reasons": _reasons(decision.reasons),
                "actions": [
                    {
                        "kind": to_data(o.action.kind),
                        "value": o.action.value,
                        "room": to_data(o.action.room),
                        "status": o.status,
                        "detail": o.detail,
                    }
                    for o in outcomes
                ],
            }
        )
        return True

    def record_system(
        self, now: datetime, reasons: Sequence[Reason], results: Sequence[CommandResult] = ()
    ) -> None:
        """Log a system event. A give-back that keeps failing the same way is logged once."""
        failing = bool(results) and all(r.status != "ok" for r in results)
        signature = (
            tuple((r.layer, r.code) for r in reasons),
            tuple((r.command, r.status, r.detail) for r in results),
        )
        if failing and signature == self._last_failed_system:
            return
        self._last_failed_system = signature if failing else None
        self._entries.append(
            {
                "ts": now.isoformat(),
                "kind": "system",
                "zone": None,
                "target": None,
                "preset": None,
                "flow_target": None,
                "season_active": None,
                "reasons": _reasons(reasons),
                "actions": [
                    {
                        "kind": f"{r.command.domain}.{r.command.service}",
                        "value": r.command.entity_id,
                        "room": None,
                        "status": r.status,
                        "detail": r.detail,
                    }
                    for r in results
                ],
            }
        )

    def latest(self, limit: int, before: datetime | None = None) -> list[dict[str, Any]]:
        """Up to `limit` entries, newest first, optionally only those older than `before`."""
        out: list[dict[str, Any]] = []
        for entry in reversed(self._entries):
            if len(out) >= limit:
                break
            if before is not None:
                ts = _parse_ts(entry)
                if ts is None or ts >= before:
                    continue
            out.append(entry)
        return out

    def to_data(self) -> list[dict[str, Any]]:
        return list(self._entries)

    @classmethod
    def from_data(cls, data: Any) -> DecisionLog:
        if not isinstance(data, list):
            return cls()
        return cls(e for e in data if _parse_ts(e) is not None)
