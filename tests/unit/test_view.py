from __future__ import annotations

import pytest

from custom_components.hybrid_heating.view import as_float, as_switch, attr_float, is_available, power_kw
from tests.fakes import st


@pytest.mark.parametrize(
    ("s", "expected"),
    [(None, False), (st("unavailable"), False), (st("unknown"), False), (st(""), True), (st("on"), True)],
)
def test_is_available(s, expected):
    assert is_available(s) is expected


@pytest.mark.parametrize(
    ("s", "expected"),
    [
        (st("13.8"), 13.8),
        (st("-2"), -2.0),
        (st("2.0"), 2.0),
        (st(""), None),
        (st("nan"), None),
        (st("inf"), None),
        (st("-inf"), None),
        (st("warm"), None),
        (st("unavailable"), None),
        (None, None),
    ],
)
def test_as_float(s, expected):
    assert as_float(s) == expected


@pytest.mark.parametrize(
    ("s", "expected"),
    [(st("on"), True), (st("off"), False), (st("unknown"), None), (st("heat"), None), (None, None)],
)
def test_as_switch(s, expected):
    assert as_switch(s) is expected


@pytest.mark.parametrize(
    ("s", "expected"),
    [
        (st("1300", unit_of_measurement="W"), 1.3),
        (st("1300"), 1.3),
        (st("1.3", unit_of_measurement="kW"), 1.3),
        (st("1.3", unit_of_measurement="MW"), None),
        (st("nan", unit_of_measurement="W"), None),
        (st("unavailable", unit_of_measurement="W"), None),
        (None, None),
    ],
)
def test_power_kw(s, expected):
    got = power_kw(s)
    assert got == (pytest.approx(expected) if expected is not None else None)


@pytest.mark.parametrize(
    ("s", "expected"),
    [
        (st("heat", temperature=50), 50.0),
        (st("heat", temperature=22.5), 22.5),
        (st("heat", temperature="23"), 23.0),
        (st("heat", temperature=None), None),
        (st("heat", temperature=True), None),
        (st("heat", temperature=float("nan")), None),
        (st("heat"), None),
        (st("unavailable", temperature=50), None),
        (None, None),
    ],
)
def test_attr_float(s, expected):
    assert attr_float(s, "temperature") == expected
