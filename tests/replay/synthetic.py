"""A deterministic synthetic heating season in the replay CSV format.

Used when no real history is available (CI, public clones). Real history goes to
local/data/season.csv, which is never committed.
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

HOURS = 5088  # 1 Oct 2025 - 1 May 2026


def synthetic_season(seed: int = 7, tz: str = "Europe/Berlin") -> list[dict[str, Any]]:
    zone = ZoneInfo(tz)
    rng = random.Random(seed)
    fronts = [(rng.uniform(3, 9) * 24, rng.uniform(0, 2 * math.pi), rng.uniform(1.5, 3.5)) for _ in range(4)]
    start = datetime(2025, 10, 1, tzinfo=ZoneInfo("UTC"))
    rows: list[dict[str, Any]] = []
    cooking_days = {d for d in range(213) if rng.random() < 0.4}
    for h in range(HOURS):
        ts = (start + timedelta(hours=h)).astimezone(zone)
        day = h / 24
        seasonal = 10.0 - 13.0 * math.sin(math.pi * day / 212)
        diurnal = 3.5 * math.cos(2 * math.pi * (ts.hour - 15) / 24)
        weather = sum(a * math.sin(2 * math.pi * h / p + ph) for p, ph, a in fronts)
        t_out = seasonal + diurnal + weather
        base = 0.35 + (0.25 if 7 <= ts.hour < 9 else 0.0) + (0.6 if 18 <= ts.hour < 22 else 0.0)
        if int(day) in cooking_days and ts.hour == 19:
            base += rng.uniform(2.0, 4.0)  # oven and kettle: exercises load shedding
        boiler = min(6.0, max(0.0, (150 * (22.8 - t_out) - 900 * base) / 1000))
        rows.append(
            {
                "ts": ts.isoformat(),
                "t_out": round(t_out, 2),
                "boiler_kw": round(boiler, 3),
                "total_kw": round(boiler + base, 3),
            }
        )
    return rows
