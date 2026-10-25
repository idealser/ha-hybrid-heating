from datetime import date, datetime, timedelta

import pytest

from custom_components.hybrid_heating.core.boiler import (
    BoilerState,
    budget_remaining,
    carry_integral,
    decide_call_classic,
    decide_call_smooth,
    driver_temperature,
    pi_step,
    register_write,
    should_write_flow,
)
from custom_components.hybrid_heating.core.types import BoilerSettings, Room
from tests.conftest import TZ

R = {Room.LIVING: 23.3, Room.BEDROOM: 22.8, Room.CHILD: 22.6, Room.BATH: 23.4}


def test_driver():
    assert driver_temperature(R, follows_coldest=True) == 22.6
    assert driver_temperature(R, follows_coldest=False) == pytest.approx(22.9)
    assert driver_temperature({**R, Room.CHILD: None}, True) == 22.8
    assert driver_temperature(dict.fromkeys(R), True) is None


def test_pi_step_values_and_limit():
    corr, integ = pi_step(BoilerSettings(), 0.5, 0.0, 300, False, False)
    assert integ == pytest.approx(0.5 * 300 / 3600) and corr == pytest.approx(1.0 + integ)
    assert pi_step(BoilerSettings(), 3.0, 0.0, 300, False, False)[0] == 5.0
    assert pi_step(BoilerSettings(), -3.0, 0.0, 300, False, False)[0] == -5.0


def test_pi_anti_windup():
    _, integ = pi_step(BoilerSettings(), 1.0, 0.4, 300, True, False)
    assert integ == 0.4
    _, integ = pi_step(BoilerSettings(), -1.0, 0.4, 300, True, False)
    assert integ < 0.4
    _, integ = pi_step(BoilerSettings(), -1.0, -0.4, 300, False, True)
    assert integ == -0.4


def test_smooth_overheat_pause_and_resume():
    s, st, t0 = BoilerSettings(), BoilerState(call=True), datetime(2026, 11, 1, 12, tzinfo=TZ)
    assert decide_call_smooth(s, st, 22.6, 23.0, t0) == (True, "smooth_on")
    assert decide_call_smooth(s, st, 23.6, 23.0, t0)[0] is True
    assert decide_call_smooth(s, st, 23.6, 23.0, t0 + timedelta(seconds=899)) == (
        True,
        "smooth_overheat_wait",
    )
    assert decide_call_smooth(s, st, 23.6, 23.0, t0 + timedelta(seconds=900)) == (False, "smooth_paused")
    assert st.call is False
    assert decide_call_smooth(s, st, 23.3, 23.0, t0 + timedelta(seconds=960))[0] is False
    assert decide_call_smooth(s, st, 23.1, 23.0, t0 + timedelta(seconds=1020)) == (True, "smooth_resumed")


def test_smooth_overheat_timer_resets_when_room_cools():
    s, st, t0 = BoilerSettings(), BoilerState(call=True), datetime(2026, 11, 1, 12, tzinfo=TZ)
    decide_call_smooth(s, st, 23.6, 23.0, t0)
    decide_call_smooth(s, st, 23.2, 23.0, t0 + timedelta(seconds=600))
    assert decide_call_smooth(s, st, 23.6, 23.0, t0 + timedelta(seconds=1000))[0] is True


def test_classic():
    s = BoilerSettings()
    assert decide_call_classic(s, BoilerState(), 22.6, 22.6, 23.0) == (True, "classic_on_avg")
    assert decide_call_classic(s, BoilerState(), 22.8, 22.1, 23.0) == (True, "classic_on_coldest")
    assert decide_call_classic(s, BoilerState(), 22.8, 22.5, 23.0) == (False, "classic_off")
    assert decide_call_classic(s, BoilerState(classic_on=True), 22.9, 22.5, 23.0)[0] is True
    assert decide_call_classic(s, BoilerState(classic_on=True), 23.0, 22.5, 23.0) == (False, "classic_off")


def test_write_gating_and_budget():
    s, now = BoilerSettings(), datetime(2026, 11, 1, 12, tzinfo=TZ)
    st = BoilerState(last_write_at=now - timedelta(minutes=11), writes_today=0, writes_day=now.date())
    assert should_write_flow(s, st, 50.0, 50.6, now) is False
    assert should_write_flow(s, st, 50.0, 51.5, now) is True
    assert should_write_flow(s, st, None, 51.5, now) is True
    st.last_write_at = now - timedelta(minutes=5)
    assert should_write_flow(s, st, 50.0, 55.0, now) is False
    st.last_write_at, st.writes_today = now - timedelta(hours=1), 41
    assert should_write_flow(s, st, 50.0, 52.0, now) is False
    assert should_write_flow(s, st, 50.0, 53.0, now) is True
    st.writes_today = 48
    assert should_write_flow(s, st, 50.0, 60.0, now) is False


def test_budget_resets_after_local_midnight():
    st = BoilerState(writes_today=48, writes_day=date(2026, 11, 1))
    assert budget_remaining(BoilerSettings(), st, datetime(2026, 11, 2, 0, 0, 30, tzinfo=TZ)) == 48


def test_register_write_counts_and_rolls_over():
    st = BoilerState()
    day1 = datetime(2026, 11, 1, 23, 50, tzinfo=TZ)
    register_write(st, day1)
    register_write(st, day1, flow=False)
    assert st.writes_today == 2 and st.last_write_at == day1
    register_write(st, day1 + timedelta(minutes=20))
    assert st.writes_today == 1 and st.writes_day == date(2026, 11, 2)


def test_unreadable_setpoint_compares_with_what_we_wrote():
    s, now = BoilerSettings(), datetime(2026, 11, 1, 12, tzinfo=TZ)
    st = BoilerState(
        last_write_at=now - timedelta(minutes=11),
        writes_today=1,
        writes_day=now.date(),
        last_flow_written=50.0,
    )
    assert should_write_flow(s, st, None, 50.4, now) is False
    assert should_write_flow(s, st, None, 52.0, now) is True


def test_a_curve_change_takes_over_what_the_correction_already_adds():
    from dataclasses import replace

    from custom_components.hybrid_heating.core.types import BoilerSettings, CurveSettings

    s = BoilerSettings()  # ki 1/h: the integral (°C·h) adds as many °C to the flow
    old = CurveSettings()
    raised = replace(old, points=tuple((t, f + 1.5 if t == 5 else f) for t, f in old.points))
    lowered = replace(old, points=tuple((t, f - 1.5 if t == 5 else f) for t, f in old.points))
    assert carry_integral(s, 2.0, old, raised, 5.0) == pytest.approx(0.5)  # the curve takes 1.5° of the 2°
    assert carry_integral(s, 1.0, old, raised, 5.0) == pytest.approx(0.0)  # never past zero
    assert carry_integral(s, 0.0, old, raised, 5.0) == 0.0  # nothing to take: the change acts at once
    assert carry_integral(s, 2.0, old, lowered, 5.0) == 2.0  # the other way: nothing to take
    assert carry_integral(s, -2.0, old, lowered, 5.0) == pytest.approx(-0.5)
    assert carry_integral(s, 2.0, old, raised, 15.0) == 2.0  # the change does not reach this weather
    assert carry_integral(s, 2.0, old, raised, None) == 2.0
    assert carry_integral(replace(s, ki_per_hour=2.0), 2.0, old, raised, 5.0) == pytest.approx(1.25)
