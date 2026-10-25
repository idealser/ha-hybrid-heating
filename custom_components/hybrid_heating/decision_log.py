"""Bounded log of what the module decided and did, newest last. No Home Assistant imports here."""

from collections import deque
from collections.abc import Iterable, Sequence
from datetime import datetime
from itertools import islice
from typing import Any, Self

from .codec import parse_ts, to_data
from .commands import ActionOutcome, CommandResult
from .const import LOG_SIZE
from .core.timeutil import before as earlier
from .core.types import Decision, Reason


def _entry(
    now: datetime,
    kind: str,
    reasons: Sequence[Reason],
    actions: list[dict[str, Any]],
    decision: Decision | None = None,
) -> dict[str, Any]:
    """One log entry in the shape the dashboard reads; a system entry has no tick fields."""
    return {
        "ts": now.isoformat(),
        "kind": kind,
        "zone": decision.zone if decision else None,
        "target": decision.target if decision else None,
        "preset": to_data(decision.preset) if decision else None,
        "flow_target": decision.flow_target if decision else None,
        "season_active": decision.season_active if decision else None,
        "reasons": to_data(list(reasons)),
        "actions": actions,
    }


class DecisionLog:
    def __init__(self, entries: Iterable[dict[str, Any]] = ()) -> None:
        self._entries: deque[dict[str, Any]] = deque(entries, maxlen=LOG_SIZE)
        self.revision = 0  # bumped on every append, so an unchanged log need not be saved again
        self._last_codes: frozenset[tuple[str, str]] = frozenset()
        self._last_outcomes: tuple[tuple[Any, ...], ...] = ()
        self._last_failed_system: tuple[Any, ...] | None = None

    def _append(self, entry: dict[str, Any]) -> None:
        self._entries.append(entry)
        self.revision += 1

    def record_tick(self, now: datetime, decision: Decision, outcomes: Sequence[ActionOutcome]) -> bool:
        """Log a tick if it acted differently, or brought a reason the previous tick did not have."""
        codes = frozenset((str(to_data(r.layer)), r.code) for r in decision.reasons)
        new = codes - self._last_codes
        self._last_codes = codes
        signature = tuple((o.action, o.status, o.detail) for o in outcomes)
        repeated = signature == self._last_outcomes  # e.g. the same command skipped every tick
        self._last_outcomes = signature
        if not new and (not outcomes or repeated):
            return False
        actions = [{**to_data(o.action), "status": o.status, "detail": o.detail} for o in outcomes]
        self._append(_entry(now, "tick", decision.reasons, actions, decision))
        return True

    def record_system(
        self, now: datetime, reasons: Sequence[Reason], results: Sequence[CommandResult] = ()
    ) -> None:
        """Log a system event. A give-back that keeps failing the same way is logged once."""
        failing = bool(results) and all(r.status != "ok" for r in results)
        signature = (tuple(reasons), tuple(results))
        if failing and signature == self._last_failed_system:
            return
        self._last_failed_system = signature if failing else None
        actions = [
            {
                "kind": f"{r.command.domain}.{r.command.service}",
                "value": r.command.entity_id,
                "room": None,
                "status": r.status,
                "detail": r.detail,
            }
            for r in results
        ]
        self._append(_entry(now, "system", reasons, actions))

    def latest(self, limit: int, before: datetime | None = None) -> list[dict[str, Any]]:
        """Up to `limit` entries, newest first, optionally only those older than `before`."""
        entries: Iterable[dict[str, Any]] = reversed(self._entries)
        if before is not None:
            entries = (e for e in entries if (ts := parse_ts(e["ts"])) is not None and earlier(ts, before))
        return list(islice(entries, limit))

    def to_data(self) -> list[dict[str, Any]]:
        return list(self._entries)

    @classmethod
    def from_data(cls, data: Any) -> Self:
        if not isinstance(data, list):
            return cls()
        return cls(e for e in data if isinstance(e, dict) and parse_ts(e.get("ts")) is not None)
