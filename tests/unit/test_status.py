from __future__ import annotations

from dataclasses import replace
from types import MappingProxyType

from custom_components.hybrid_heating.core.controller import ControllerState
from custom_components.hybrid_heating.core.load import LoadState
from custom_components.hybrid_heating.core.types import (
    BoilerMode,
    Decision,
    Layer,
    LayerMode,
    Preset,
    Reason,
    Settings,
)
from custom_components.hybrid_heating.status import (
    desired_call,
    layer_load_state,
    load_pending,
    load_pending_any,
    load_shedding_active,
    next_load_deadline,
)
from tests.conftest import T0, sec


def test_load_pending():
    assert load_pending(LoadState(), T0) is False and load_pending(LoadState(over_since=T0), T0) is True
    assert load_pending(LoadState(emergency_until=T0 + sec(10)), T0) is True
    assert load_pending(LoadState(emergency_until=T0 - sec(1)), T0) is False
    assert load_pending(LoadState(emergency_until=T0), T0) is False
    assert load_pending(LoadState(under_since=T0, rods_shed=1), T0) is False


def test_load_pending_any_covers_the_shadow():
    st = ControllerState.initial(T0)
    st.shadow_load.over_since = T0
    assert load_pending_any(st, T0) is True and load_pending_any(ControllerState.initial(T0), T0) is False


def test_desired_call_and_shedding():
    st = ControllerState.initial(T0)
    st.boiler.call = True
    d = Decision((), (), 35.0, 0, 23.0, Preset.COMFORT, True)
    assert desired_call(Settings(), None, st, T0) is None
    assert desired_call(Settings(), d, st, T0) is True
    classic = replace(Settings(), boiler=replace(Settings().boiler, mode=BoilerMode.CLASSIC))
    assert desired_call(classic, d, st, T0) is False  # classic_on is still False
    st.load.emergency_until = T0 + sec(10)
    assert desired_call(Settings(), d, st, T0) is False
    assert desired_call(Settings(), replace(d, season_active=False), ControllerState.initial(T0), T0) is False
    off = replace(d, reasons=(Reason(Layer.BOILER, "zone_boiler_off", {"zone": 3}),))
    assert desired_call(Settings(), off, ControllerState.initial(T0), T0) is False
    blind = replace(d, reasons=(Reason("system", "rooms_unavailable"),))
    assert desired_call(Settings(), blind, ControllerState.initial(T0), T0) is True
    assert (
        load_shedding_active(LoadState(rods_shed=1), T0) is True
        and load_shedding_active(LoadState(), T0) is False
    )
    assert load_shedding_active(LoadState(water_heater_shed=True), T0) is True
    assert load_shedding_active(LoadState(emergency_until=T0 + sec(5)), T0) is True
    st2 = ControllerState.initial(T0)
    st2.shadow_load.water_heater_shed = True
    assert layer_load_state(Settings(), st2) is st2.shadow_load
    all_active = replace(Settings(), layers=MappingProxyType(dict.fromkeys(Layer, LayerMode.ACTIVE)))
    assert layer_load_state(all_active, st2) is st2.load


def test_next_load_deadline():
    s = Settings().load  # shed after 5 s
    assert next_load_deadline(LoadState(), s, T0) is None
    assert next_load_deadline(LoadState(over_since=T0), s, T0 + sec(2)) == T0 + sec(5)
    assert (
        next_load_deadline(LoadState(over_since=T0), s, T0 + sec(6)) is None
    )  # already due: ticks handle it
    paused = LoadState(over_since=T0, emergency_until=T0 + sec(20))
    assert next_load_deadline(paused, s, T0 + sec(6)) == T0 + sec(20)
    assert next_load_deadline(LoadState(emergency_until=T0 - sec(1)), s, T0) is None
