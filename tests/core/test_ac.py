from datetime import timedelta

from custom_components.hybrid_heating.core.ac import AcState, ac_allowed, decide_ac
from custom_components.hybrid_heating.core.types import (
    AcSettings,
    ActionKind,
    NightMode,
    Preset,
    Room,
    ZoneSettings,
)
from tests.conftest import T0

P = ZoneSettings().policies[0]


def kinds(acts):
    return [(a.kind, a.value) for a in acts]


def run(st, room=Room.LIVING, **kw):
    args = {
        "allowed": True,
        "target": 23.0,
        "room_temp": 23.0,
        "hvac": "heat",
        "setpoint": 24,
        "available": True,
        "quiet_wanted": False,
        "now": T0,
    }
    args.update(kw)
    return decide_ac(AcSettings(), st, room, **args)


def test_allowed():
    assert ac_allowed(True, P, Room.LIVING, -10, Preset.COMFORT, None) is True
    assert ac_allowed(True, P, Room.LIVING, -15.0, Preset.COMFORT, None) is True
    assert ac_allowed(True, P, Room.LIVING, -15.1, Preset.COMFORT, None) is False
    assert ac_allowed(True, P, Room.LIVING, 5, Preset.AWAY, None) is False
    assert ac_allowed(True, P, Room.BEDROOM, 5, Preset.NIGHT, NightMode.OFF) is False
    assert ac_allowed(True, P, Room.BEDROOM, 5, Preset.NIGHT, NightMode.QUIET) is True
    assert ac_allowed(False, P, Room.LIVING, 5, Preset.COMFORT, None) is False
    assert ac_allowed(True, ZoneSettings().policies[3], Room.LIVING, 5, Preset.COMFORT, None) is False


def test_start_takes_ownership():
    st = AcState()
    acts, reasons = run(st, room_temp=22.6, hvac="off", setpoint=25)
    assert kinds(acts) == [(ActionKind.AC_HVAC, "heat"), (ActionKind.AC_SETPOINT, 24)]
    assert Room.LIVING in st.owned and reasons[0].code == "ac_started"


def test_steps_rate_limited_and_bounded():
    st = AcState(owned={Room.LIVING}, last_step_at={Room.LIVING: T0 - timedelta(minutes=11)})
    acts, _ = run(st, room_temp=22.6, setpoint=24)
    assert kinds(acts) == [(ActionKind.AC_SETPOINT, 25)]
    acts, _ = run(st, room_temp=22.6, setpoint=25, now=T0 + timedelta(minutes=5))
    assert acts == []
    st.last_step_at[Room.LIVING] = T0 - timedelta(hours=1)
    acts, _ = run(st, room_temp=21.0, setpoint=30)
    assert acts == []
    acts, _ = run(st, room_temp=23.4, setpoint=24)
    assert kinds(acts) == [(ActionKind.AC_SETPOINT, 23)]


def test_within_deadband_no_step():
    st = AcState(owned={Room.LIVING}, last_step_at={Room.LIVING: T0 - timedelta(hours=1)})
    assert run(st, room_temp=22.8, setpoint=24)[0] == []


def test_manual_ac_left_alone():
    st = AcState()
    acts, reasons = run(st, room=Room.BEDROOM, allowed=False)
    assert acts == [] and reasons[0].code == "ac_manual_left_alone"


def test_manual_mode_change_drops_ownership():
    st = AcState(owned={Room.LIVING})
    acts, reasons = run(st, hvac="cool")
    assert acts == [] and Room.LIVING not in st.owned and reasons[0].code == "ac_manual_left_alone"


def test_owned_ac_stopped_when_not_allowed():
    st = AcState(owned={Room.BEDROOM})
    acts, reasons = run(st, room=Room.BEDROOM, allowed=False)
    assert kinds(acts) == [(ActionKind.AC_HVAC, "off")] and Room.BEDROOM not in st.owned
    assert reasons[0].code == "ac_stopped"


def test_not_coping_after_an_hour():
    st = AcState(
        owned={Room.LIVING},
        fail_since={Room.LIVING: T0 - timedelta(seconds=3600)},
        last_step_at={Room.LIVING: T0},
    )
    _, reasons = run(st, room_temp=21.9, setpoint=30)
    assert "ac_not_coping" in [r.code for r in reasons] and Room.LIVING in st.degraded


def test_not_coping_timer_resets():
    st = AcState(owned={Room.LIVING}, fail_since={Room.LIVING: T0 - timedelta(seconds=3000)})
    run(st, room_temp=22.5, setpoint=30, now=T0)
    assert st.fail_since[Room.LIVING] is None and Room.LIVING not in st.degraded


def test_unavailable_marks_degraded_without_actions():
    st = AcState(owned={Room.LIVING})
    acts, reasons = run(st, available=False, hvac=None)
    assert acts == [] and reasons[0].code == "ac_unavailable" and Room.LIVING in st.degraded


def test_quiet_toggles_once():
    st = AcState(owned={Room.BEDROOM}, last_step_at={Room.BEDROOM: T0})
    acts, _ = run(st, room=Room.BEDROOM, target=22.5, room_temp=22.5, quiet_wanted=True)
    assert kinds(acts) == [(ActionKind.AC_QUIET, True)]
    acts, _ = run(st, room=Room.BEDROOM, target=22.5, room_temp=22.5, quiet_wanted=True)
    assert acts == []
    acts, reasons = run(st, room=Room.BEDROOM, target=22.5, room_temp=22.5, quiet_wanted=False)
    assert kinds(acts) == [(ActionKind.AC_QUIET, False)] and reasons[-1].code == "ac_quiet_off"


def test_off_right_after_our_start_is_waited_out():
    st = AcState(owned={Room.LIVING}, last_step_at={Room.LIVING: T0 - timedelta(seconds=10)})
    acts, _ = run(st, hvac="off")
    assert acts == [] and Room.LIVING in st.owned and Room.LIVING not in st.manual_hold


def test_user_switching_an_owned_ac_off_is_respected():
    st = AcState(owned={Room.LIVING}, last_step_at={Room.LIVING: T0 - timedelta(seconds=200)})
    acts, reasons = run(st, hvac="off")
    assert acts == [] and Room.LIVING not in st.owned and Room.LIVING in st.manual_hold
    assert reasons[0].code == "ac_manual_off"
    acts, reasons = run(st, hvac="off", now=T0 + timedelta(hours=2))
    assert acts == [] and reasons[0].code == "ac_manual_hold"
