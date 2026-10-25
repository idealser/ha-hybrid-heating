import json
from datetime import UTC, datetime

import pytest

from tools.export_history import load_entities, rows_from_statistics

IDS = {"t_out": "sensor.outdoor", "boiler_kw": "sensor.boiler_power", "total_kw": "sensor.flat_power"}


def ms(y, m, d, h):
    return int(datetime(y, m, d, h, tzinfo=UTC).timestamp() * 1000)


def test_rows_from_statistics_converts_and_aligns():
    stats = {
        IDS["t_out"]: [
            {"start": ms(2025, 12, 1, 10), "mean": 2.5},
            {"start": ms(2025, 12, 1, 11), "mean": 3.0},
        ],
        IDS["boiler_kw"]: [{"start": ms(2025, 12, 1, 10), "mean": 2500.0}],
        IDS["total_kw"]: [
            {"start": ms(2025, 12, 1, 10), "mean": 3100.0},
            {"start": ms(2025, 12, 1, 11), "mean": 900.0},
        ],
    }
    rows = rows_from_statistics(stats, "Europe/Berlin", IDS)
    assert rows[0] == {"ts": "2025-12-01T11:00:00+01:00", "t_out": 2.5, "boiler_kw": 2.5, "total_kw": 3.1}
    assert rows[1]["ts"] == "2025-12-01T12:00:00+01:00" and rows[1]["boiler_kw"] is None
    assert rows[1]["total_kw"] == 0.9


def test_entities_come_from_a_local_file(tmp_path):
    path = tmp_path / "entities.json"
    path.write_text(
        json.dumps({"outdoor_temperature": "sensor.a", "boiler_power": "sensor.b", "total_power": "sensor.c"})
    )
    assert load_entities(path) == {"t_out": "sensor.a", "boiler_kw": "sensor.b", "total_kw": "sensor.c"}
    path.write_text(json.dumps({"outdoor_temperature": "sensor.a"}))
    with pytest.raises(SystemExit):
        load_entities(path)
