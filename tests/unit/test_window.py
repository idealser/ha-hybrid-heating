from __future__ import annotations

from datetime import timedelta

import pytest

from custom_components.hybrid_heating.window import OutdoorWindow
from tests.conftest import T0


def test_window_mean_over_12h():
    w = OutdoorWindow()
    w.add(T0 - timedelta(hours=13), 30.0)
    for m in range(12 * 60):
        w.add(T0 - timedelta(hours=12) + timedelta(minutes=m), 10.0 if m < 360 else 14.0)
    assert w.mean(T0, 12) == pytest.approx(12.0, abs=0.05)
    assert OutdoorWindow().mean(T0, 12) is None


def test_buckets_weigh_equally_however_many_samples():
    w = OutdoorWindow()
    for s in range(0, 300, 10):  # 30 samples in one bucket
        w.add(T0 - timedelta(hours=1) + timedelta(seconds=s), 10.0)
    w.add(T0, 20.0)  # one sample in another
    assert w.mean(T0, 2) == pytest.approx(15.0)


def test_none_is_skipped():
    w = OutdoorWindow()
    w.add(T0, None)
    assert w.mean(T0, 12) is None and w.to_data() == []


def test_window_round_trip_and_prune():
    w = OutdoorWindow()
    w.add(T0 - timedelta(hours=80), 1.0)
    w.add(T0, 13.8)
    w.prune(T0)
    w2 = OutdoorWindow.from_data(w.to_data())
    assert w2.mean(T0, 72) == pytest.approx(13.8) and len(w2.to_data()) == 1
    assert OutdoorWindow.from_data("junk").mean(T0, 12) is None


@pytest.mark.parametrize("junk", [None, 5, [[1, 2]], [["a", 1, 1]], [[0, 1.0, 0]], [[0, float("nan"), 1]]])
def test_from_data_garbage_gives_empty_window(junk):
    assert OutdoorWindow.from_data(junk).to_data() == []
