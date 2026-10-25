from __future__ import annotations

from custom_components.hybrid_heating.core.controller import ControllerState
from custom_components.hybrid_heating.core.load import LoadState
from custom_components.hybrid_heating.status import load_pending, load_pending_any
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
