"""Season replay: the spec's invariants on a thermal model of the flat.

Runs on real history from local/data/season.csv when present (never committed),
otherwise on a deterministic synthetic season.
"""

import csv
from dataclasses import replace
from pathlib import Path
from types import MappingProxyType

import pytest

from custom_components.hybrid_heating.core.types import Layer, LayerMode, Room, Settings
from tests.replay.sim import simulate
from tests.replay.synthetic import synthetic_season

pytestmark = pytest.mark.replay

REAL = Path(__file__).parents[2] / "local" / "data" / "season.csv"
ROWS = list(csv.DictReader(REAL.open(encoding="utf-8"))) if REAL.exists() else synthetic_season()
HISTORY_BOILER_KWH = sum(float(r["boiler_kw"]) for r in ROWS if r["boiler_kw"])
ACTIVE = replace(Settings(), layers=MappingProxyType({layer: LayerMode.ACTIVE for layer in Layer}))
STEP_S = 60
TRVS = frozenset({Room.LIVING, Room.BEDROOM})

_cache: dict[str, object] = {}


def run(key, fn):
    if key not in _cache:
        _cache[key] = fn()
    return _cache[key]


def hybrid():
    return run("hybrid", lambda: simulate(ACTIVE, ROWS, step_s=STEP_S))


def legacy():
    return run("legacy", lambda: simulate(Settings(), ROWS, step_s=STEP_S, legacy=True))


@pytest.mark.skipif(not REAL.exists(), reason="calibration needs the real history in local/data/season.csv")
def test_sim_is_calibrated_against_last_season():
    assert legacy().boiler_kwh == pytest.approx(HISTORY_BOILER_KWH, rel=0.15)


def test_rooms_stay_on_their_own_targets():
    # Gree accepts whole degrees only, so AC rooms are held within ±0.5 °C (spec decision 2026-10-25).
    r = hybrid()
    assert r.share_within(Room.LIVING, 0.5) >= 0.90
    assert r.share_within(Room.BEDROOM, 0.5) >= 0.90
    # The child room has no heater of its own: with doors open and one water temperature for all
    # radiators it cannot be kept 1 °C cooler than its neighbours, only kept from getting cold.
    # Keeping it cooler needs its radiator valve or an (optional) TRV.
    assert r.share_not_below(Room.CHILD, 0.5) >= 0.90


def test_write_budget_never_exceeded():
    assert max(hybrid().writes_per_day.values()) <= 48


def test_no_sustained_overload():
    # The controller ticks once per simulated step, so it can react no faster than two steps.
    # Real-time reaction (shedding after 5 s) is covered by tests/core/test_load.py.
    assert hybrid().max_over_limit_run_s <= 2 * STEP_S


def test_boiler_call_is_calm():
    days = hybrid().call_cycles_per_day
    assert sum(1 for c in days.values() if c <= 12) / len(days) >= 0.95


def test_ac_setpoints_in_range():
    lo, hi = hybrid().ac_setpoint_range
    assert lo >= 16 and hi <= 30


def test_boiler_uses_less_than_legacy():
    assert hybrid().boiler_kwh < legacy().boiler_kwh


def test_total_heating_electricity_below_legacy():
    # The module's purpose: less electricity for heat in total (boiler + ACs), not just a quieter boiler.
    assert hybrid().heating_kwh < legacy().heating_kwh


def test_trvs_unlock_heat_pump_savings():
    # Optional TRVs on the AC rooms' radiators (support planned, off by default) are what lets the
    # heat pumps carry those rooms; the replay keeps that decision basis visible.
    with_trvs = run("trv", lambda: simulate(ACTIVE, ROWS, step_s=STEP_S, trv_rooms=TRVS, trv_offset=-1.0))
    assert with_trvs.heating_kwh < legacy().heating_kwh * 0.7
