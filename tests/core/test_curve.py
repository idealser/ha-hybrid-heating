from dataclasses import replace

import pytest
from hypothesis import given
from hypothesis import strategies as st

from custom_components.hybrid_heating.core.curve import flow_for, raw_curve, validate_curve
from custom_components.hybrid_heating.core.types import CurveSettings

C = CurveSettings()


def test_points_and_interpolation():
    assert raw_curve(C, 0) == 49.5 and raw_curve(C, -10) == 58.0 and raw_curve(C, 15) == 34.0
    assert raw_curve(C, 13.8) == pytest.approx(35.32, abs=0.01)


def test_flat_beyond_ends():
    assert raw_curve(C, 25) == 28.0 and raw_curve(C, -25) == 66.0


def test_shift_moves_whole_curve():
    assert raw_curve(replace(C, shift=2.0), 0) == 51.5


def test_clamp():
    assert flow_for(C, -20, ac_active=False, hybrid=True) == 65.0
    assert flow_for(C, 20, ac_active=False, hybrid=True) == 30.0


def test_background_shift_only_with_hybrid_and_ac():
    assert flow_for(C, 0, ac_active=True, hybrid=True) == 46.5
    assert flow_for(C, 0, ac_active=True, hybrid=False) == 49.5


def test_correction_then_clamp():
    assert flow_for(C, 0, ac_active=False, hybrid=True, correction=2.5) == 52.0
    assert flow_for(C, -20, ac_active=False, hybrid=True, correction=3) == 65.0


@given(st.floats(-30, 30), st.floats(-30, 30))
def test_monotonic_for_default_curve(a, b):
    lo, hi = sorted((a, b))
    assert raw_curve(C, lo) >= raw_curve(C, hi)


def test_validate_rejects_bad_curve():
    validate_curve(C)
    with pytest.raises(ValueError):
        validate_curve(replace(C, flow_min=70))
    with pytest.raises(ValueError):
        validate_curve(replace(C, points=C.points[:4]))
    with pytest.raises(ValueError):
        validate_curve(replace(C, points=((20, 28.0), *C.points[2:], (-25, 70.0))))
