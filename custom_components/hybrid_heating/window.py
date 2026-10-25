"""Rolling mean of the outdoor temperature in fixed time buckets, for the heating-season switch."""

import math
from datetime import datetime
from typing import Any, Self

from .const import WINDOW_BUCKET_S, WINDOW_MAX_HOURS


class OutdoorWindow:
    def __init__(self) -> None:
        self._buckets: dict[int, list[float]] = {}  # bucket start (epoch s) -> [sum, count]

    def add(self, now: datetime, value: float | None) -> None:
        if value is None:
            return
        start = int(now.timestamp()) // WINDOW_BUCKET_S * WINDOW_BUCKET_S
        bucket = self._buckets.setdefault(start, [0.0, 0])
        bucket[0] += value
        bucket[1] += 1

    def mean(self, now: datetime, hours: float) -> float | None:
        """Mean of bucket means, each bucket weighted equally, over buckets starting since now - hours."""
        since = now.timestamp() - hours * 3600
        means = [total / count for start, (total, count) in self._buckets.items() if start >= since]
        return sum(means) / len(means) if means else None

    def prune(self, now: datetime) -> None:
        since = now.timestamp() - WINDOW_MAX_HOURS * 3600
        self._buckets = {start: b for start, b in self._buckets.items() if start >= since}

    def to_data(self) -> list[list[float]]:
        return [[start, total, count] for start, (total, count) in sorted(self._buckets.items())]

    @classmethod
    def from_data(cls, data: Any) -> Self:
        """Rebuild from to_data(); anything malformed gives an empty window."""
        w = cls()
        if not isinstance(data, list):
            return w
        buckets: dict[int, list[float]] = {}
        for row in data:
            if not (isinstance(row, list) and len(row) == 3):
                return w
            if not all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in row):
                return w
            start, total, count = row
            if count < 1 or not math.isfinite(total) or not math.isfinite(start):
                return w
            buckets[int(start)] = [float(total), int(count)]
        w._buckets = buckets
        return w
