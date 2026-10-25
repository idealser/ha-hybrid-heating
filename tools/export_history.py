"""Export hourly long-term statistics from Home Assistant into the replay CSV.

Entity ids are private, so they live in a local JSON file (default local/entities.json):

    {"outdoor_temperature": "sensor....", "boiler_power": "sensor....", "total_power": "sensor...."}

Usage (token from HA profile -> Security -> Long-lived access tokens):

    HA_TOKEN=... uv run python tools/export_history.py --url http://<your-ha> \\
        --start 2025-10-01 --end 2026-05-01

The CSV goes to local/data/season.csv by default; the season replay picks it up from there.
"""

import argparse
import asyncio
import csv
import json
import os
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

COLUMNS = ("ts", "t_out", "boiler_kw", "total_kw")
SCALE = {"t_out": 1.0, "boiler_kw": 0.001, "total_kw": 0.001}  # power sensors report W
ENTITY_KEYS = {"outdoor_temperature": "t_out", "boiler_power": "boiler_kw", "total_power": "total_kw"}


def load_entities(path: Path) -> dict[str, str]:
    """Map CSV columns to entity ids from the local entities file."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    missing = [k for k in ENTITY_KEYS if not raw.get(k)]
    if missing:
        raise SystemExit(f"{path} lacks: {', '.join(missing)}")
    return {column: raw[key] for key, column in ENTITY_KEYS.items()}


def rows_from_statistics(
    stats: Mapping[str, list[dict[str, Any]]], tz: str, ids: Mapping[str, str]
) -> list[dict[str, Any]]:
    zone = ZoneInfo(tz)
    by_start: dict[int, dict[str, Any]] = {}
    for column, entity in ids.items():
        for item in stats.get(entity, []):
            mean = item.get("mean")
            row = by_start.setdefault(int(item["start"]), {})
            row[column] = None if mean is None else round(float(mean) * SCALE[column], 3)
    rows = []
    for start in sorted(by_start):
        ts = datetime.fromtimestamp(start / 1000, tz=UTC).astimezone(zone).isoformat()
        rows.append({"ts": ts, **{c: by_start[start].get(c) for c in COLUMNS[1:]}})
    return rows


async def fetch_statistics(
    url: str, token: str, start: str, end: str, entity_ids: list[str]
) -> dict[str, list[dict[str, Any]]]:
    import websockets  # dev-only dependency

    ws_url = url.replace("http", "ws", 1).rstrip("/") + "/api/websocket"
    async with websockets.connect(ws_url, max_size=64 * 1024 * 1024) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "auth", "access_token": token}))
        if json.loads(await ws.recv()).get("type") != "auth_ok":
            raise SystemExit("authentication failed: check HA_TOKEN")
        await ws.send(
            json.dumps(
                {
                    "id": 1,
                    "type": "recorder/statistics_during_period",
                    "start_time": f"{start}T00:00:00Z",
                    "end_time": f"{end}T00:00:00Z",
                    "statistic_ids": entity_ids,
                    "period": "hour",
                    "types": ["mean"],
                }
            )
        )
        reply = json.loads(await ws.recv())
        if not reply.get("success"):
            raise SystemExit(f"statistics request failed: {reply.get('error')}")
        result: dict[str, list[dict[str, Any]]] = reply["result"]
        return result


def write_csv(rows: list[dict[str, Any]], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--url", required=True)
    p.add_argument("--start", required=True)
    p.add_argument("--end", required=True)
    p.add_argument("--entities", type=Path, default=Path("local/entities.json"))
    p.add_argument("--out", type=Path, default=Path("local/data/season.csv"))
    p.add_argument("--tz", default="UTC", help="time zone for the ts column, e.g. Europe/Berlin")
    args = p.parse_args()
    token = os.environ.get("HA_TOKEN")
    if not token:
        raise SystemExit("set HA_TOKEN to a long-lived access token")
    ids = load_entities(args.entities)
    stats = asyncio.run(fetch_statistics(args.url, token, args.start, args.end, list(ids.values())))
    rows = rows_from_statistics(stats, args.tz, ids)
    write_csv(rows, args.out)
    missing = sum(1 for r in rows if None in (r["t_out"], r["boiler_kw"], r["total_kw"]))
    print(f"wrote {len(rows)} rows to {args.out}, {missing} with gaps")


if __name__ == "__main__":
    main()
