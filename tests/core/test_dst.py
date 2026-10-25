"""Timers must count real seconds across the autumn DST change (02:00-02:59 repeats in the test zone)."""

from datetime import datetime, timedelta

from custom_components.hybrid_heating.core.ac import AcState, decide_ac
from custom_components.hybrid_heating.core.boiler import BoilerState, should_write_flow
from custom_components.hybrid_heating.core.load import LoadState, load_step
from custom_components.hybrid_heating.core.types import (
    AcSettings,
    ActionKind,
    BoilerSettings,
    LoadSettings,
    Room,
)
from tests.conftest import TZ, codes

BEFORE = datetime(2026, 10, 25, 2, 59, 57, fold=0, tzinfo=TZ)  # summer time
AFTER_5S = datetime(2026, 10, 25, 2, 0, 2, fold=1, tzinfo=TZ)  # winter time, 5 real seconds later


def test_fixture_spans_the_change():
    assert AFTER_5S.timestamp() - BEFORE.timestamp() == 5


def test_overload_timer_spans_dst_change():
    st = LoadState()
    load_step(LoadSettings(), st, BEFORE, 8.5, False, 3, True)
    _, r = load_step(LoadSettings(), st, AFTER_5S, 8.5, False, 3, True)
    assert "pause_boiler" in codes(r)


def test_pause_lasts_20_real_seconds_across_dst():
    st = LoadState()
    start = datetime(2026, 10, 25, 2, 59, 40, fold=0, tzinfo=TZ)
    load_step(LoadSettings(), st, start, 8.5, False, 3, True)
    load_step(LoadSettings(), st, start + timedelta(seconds=5), 8.5, False, 3, True)
    assert st.emergency_until is not None
    assert st.emergency_until.timestamp() == start.timestamp() + 25


def test_flow_write_interval_counts_real_time_across_dst():
    last = datetime(2026, 10, 25, 2, 55, fold=0, tzinfo=TZ)
    now = datetime(2026, 10, 25, 2, 6, fold=1, tzinfo=TZ)  # 11 real minutes later
    st = BoilerState(last_write_at=last, writes_today=1, writes_day=now.date())
    assert should_write_flow(BoilerSettings(), st, 50.0, 52.0, now) is True


def test_ac_step_interval_counts_real_time_across_dst():
    last = datetime(2026, 10, 25, 2, 55, fold=0, tzinfo=TZ)
    now = datetime(2026, 10, 25, 2, 6, fold=1, tzinfo=TZ)
    st = AcState(owned={Room.LIVING}, last_step_at={Room.LIVING: last})
    acts, _ = decide_ac(
        AcSettings(),
        st,
        Room.LIVING,
        allowed=True,
        target=23.0,
        room_temp=22.5,
        hvac="heat",
        setpoint=24,
        available=True,
        quiet_wanted=False,
        now=now,
    )
    assert [(a.kind, a.value) for a in acts] == [(ActionKind.AC_SETPOINT, 25)]
