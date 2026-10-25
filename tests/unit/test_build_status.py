import json
from pathlib import Path

import pytest

from custom_components.hybrid_heating.core.controller import ControllerState, tick
from custom_components.hybrid_heating.core.types import LayerMode, Room, Settings
from custom_components.hybrid_heating.status import build_status
from tests.conftest import ALL_ACTIVE, T0, snap, with_layers

FIXTURES = Path("frontend/test/fixtures")


def shape(x):
    """Keys and JSON types; int and float are one 'number'; lists by their first element."""
    if isinstance(x, dict):
        return {k: shape(v) for k, v in x.items() if k != "data"}
    if isinstance(x, list):
        return [shape(x[0])] if x else []
    if isinstance(x, bool):
        return "bool"
    if isinstance(x, (int, float)):
        return "number"
    if x is None:
        return "null"
    return type(x).__name__


def nullable_shape(a, b):
    """Compare shapes where a null on either side matches any type."""
    if a == "null" or b == "null":
        return True
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(nullable_shape(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return not a or not b or nullable_shape(a[0], b[0])
    return a == b


def now_status(settings=ALL_ACTIVE, language="ru"):
    st = ControllerState.initial(T0)
    s = snap()
    d = tick(settings, s, st)
    return build_status(
        settings=settings,
        snap=s,
        decision=d,
        state=st,
        revision=3,
        log_seq=10,
        suggestions_seq=0,
        enabled=True,
        now=T0,
        language=language,
        text=lambda r, lang: f"{lang}:{r.code}",
    )


def test_now_scenario():
    s = now_status()
    assert (
        s["zone"] == 0 and s["target"] == 23.0 and s["effective_preset"] == "comfort" and s["season_active"]
    )
    # room offsets count: the child's room (22.6, offset −1) normalises to 23.6, so the bedroom is coldest
    assert s["driver"] == {"mode": "coldest", "room": "bedroom", "temp": pytest.approx(22.8)}
    assert s["curve_flow"] == pytest.approx(35.32, abs=0.01)
    assert s["background_shift"] == 0.0  # the boiler follows the coldest room: full curve
    assert s["flow_target"] == pytest.approx(s["curve_flow"] + s["correction"], abs=0.01)
    assert s["acs"]["living"]["owned"] is True and s["load"]["kw"] == 1.3
    assert s["revision"] == 3 and s["seq"] == {"log": 10, "suggestions": 0}
    assert s["decided"] is True
    assert s["reasons"] and all(r["text"].startswith("ru:") for r in s["reasons"])
    assert s["boiler"]["writes_left"] == 47  # one flow write in this tick
    json.dumps(s)


def test_frost_main_zone_takes_the_background_shift_when_acs_heat():
    st = ControllerState.initial(T0)
    hvac = {Room.LIVING: "heat", Room.BEDROOM: "heat"}
    s = snap(t_out=-8.0, ac_hvac=hvac)
    st.ac.owned = {Room.LIVING, Room.BEDROOM}
    d = tick(ALL_ACTIVE, s, st)
    r = build_status(
        settings=ALL_ACTIVE,
        snap=s,
        decision=d,
        state=st,
        revision=1,
        log_seq=0,
        suggestions_seq=0,
        enabled=True,
        now=T0,
        language="en",
        text=lambda r, lang: r.code,
    )
    assert r["zone"] == 2 and r["driver"]["mode"] == "average" and r["driver"]["room"] is None
    assert r["background_shift"] == 3.0


def test_observed_layers_report_the_shadow_state():
    st = ControllerState.initial(T0)
    st.shadow_load.water_heater_shed = True
    st.shadow_ac.owned = {Room.BEDROOM}
    r = build_status(
        settings=Settings(),
        snap=snap(),
        decision=None,
        state=st,
        revision=1,
        log_seq=0,
        suggestions_seq=0,
        enabled=True,
        now=T0,
        language="en",
        text=lambda r, lang: r.code,
    )
    assert r["load"]["water_heater_shed"] is True and r["load"]["shedding"] is True
    assert r["acs"]["bedroom"]["owned"] is True and r["acs"]["living"]["owned"] is False
    live = with_layers(load=LayerMode.ACTIVE, ac=LayerMode.ACTIVE)
    r = build_status(
        settings=live,
        snap=snap(),
        decision=None,
        state=st,
        revision=1,
        log_seq=0,
        suggestions_seq=0,
        enabled=True,
        now=T0,
        language="en",
        text=lambda r, lang: r.code,
    )
    assert r["load"]["water_heater_shed"] is False and r["acs"]["bedroom"]["owned"] is False


def test_before_the_first_tick():
    r = build_status(
        settings=Settings(),
        snap=None,
        decision=None,
        state=ControllerState.initial(T0),
        revision=1,
        log_seq=0,
        suggestions_seq=0,
        enabled=True,
        now=T0,
        language="en",
        text=lambda r, lang: r.code,
    )
    assert r["t_out"] is None and r["flow_target"] is None and r["curve_flow"] is None and r["reasons"] == []
    assert r["decided"] is False  # the card says "starting" instead of explaining a decision
    assert r["rooms"] == {"living": None, "bedroom": None, "child": None, "bath": None}
    assert set(r) == set(json.loads((FIXTURES / "status-now.json").read_text(encoding="utf-8")))


def test_shape_matches_the_card_fixture():
    fixture = json.loads((FIXTURES / "status-now.json").read_text(encoding="utf-8"))
    assert nullable_shape(shape(now_status()), shape(fixture))


def test_the_card_fixture_is_what_the_integration_sends_now():
    """The card's "now" fixture is the real status, not a hand-made one."""
    fixture = json.loads((FIXTURES / "status-now.json").read_text(encoding="utf-8"))
    s = now_status(settings=Settings())
    for key in ("zone", "target", "effective_preset", "season_active", "background_shift", "rooms"):
        assert fixture[key] == pytest.approx(s[key], abs=0.01), key
    assert {**fixture["driver"], "temp": pytest.approx(s["driver"]["temp"], abs=0.01)} == s["driver"]
    for key in ("curve_flow", "flow_target", "correction"):
        assert fixture[key] == pytest.approx(s[key], abs=0.05), key


def test_status_says_what_the_module_wants_from_the_boiler():
    """In observe mode the heat call belongs to the old thermostat; the card explains the module's."""
    s = now_status(settings=Settings())
    assert s["boiler"]["wanted"] is True and s["boiler"]["call_on"] is False  # observing: the device is off
    r = build_status(
        settings=Settings(),
        snap=None,
        decision=None,
        state=ControllerState.initial(T0),
        revision=1,
        log_seq=0,
        suggestions_seq=0,
        enabled=True,
        now=T0,
        language="en",
        text=lambda r, lang: r.code,
    )
    assert r["boiler"]["wanted"] is None


def test_background_shift_follows_the_controllers_rule():
    """No shift for an AC the module counts as not coping, nor for one that is unavailable."""
    hvac = {Room.LIVING: "heat", Room.BEDROOM: "heat"}
    s = snap(t_out=-8.0, ac_hvac=hvac)
    st = ControllerState.initial(T0)
    st.ac.degraded = {Room.LIVING, Room.BEDROOM}
    d = tick(ALL_ACTIVE, s, st)
    r = build_status(
        settings=ALL_ACTIVE,
        snap=s,
        decision=d,
        state=st,
        revision=1,
        log_seq=0,
        suggestions_seq=0,
        enabled=True,
        now=T0,
        language="en",
        text=lambda r, lang: r.code,
    )
    assert r["background_shift"] == 0.0


def test_status_says_while_the_load_holds_the_boiler_off():
    from datetime import timedelta

    live = with_layers(load=LayerMode.ACTIVE)
    st = ControllerState.initial(T0)
    st.load.emergency_until = T0 + timedelta(seconds=15)  # paused 5 s ago, for 20 s

    def status(settings, now):
        return build_status(
            settings=settings,
            snap=snap(),
            decision=None,
            state=st,
            revision=1,
            log_seq=0,
            suggestions_seq=0,
            enabled=True,
            now=now,
            language="en",
            text=lambda r, lang: r.code,
        )

    assert status(live, T0)["load"]["pausing"] is True  # on every tick of the pause, not only the first
    assert status(live, T0 + timedelta(seconds=20))["load"]["pausing"] is False
    assert status(Settings(), T0)["load"]["pausing"] is False  # observed: the shadow state is not paused
