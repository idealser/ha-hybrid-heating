"""Load shedding: >8 kW held for 5 s (user's choice, adjustable) pauses the boiler for 20 s."""

from custom_components.hybrid_heating.core.load import LoadState, effective_rods, load_step
from custom_components.hybrid_heating.core.types import Action, ActionKind, Layer, LoadSettings, Reason
from tests.conftest import T0, codes, sec

S = LoadSettings()


def test_defaults():
    assert (S.limit_kw, S.shed_after_s, S.pause_s, S.step_interval_s) == (8.0, 5, 20, 60)


def test_overload_held_5s_pauses_boiler_and_sheds():
    st = LoadState()
    assert load_step(S, st, T0, 8.3, True, 3, True)[0] == []
    assert load_step(S, st, T0 + sec(4.9), 8.3, True, 3, True)[0] == []
    acts, r = load_step(S, st, T0 + sec(5), 8.3, True, 3, True)
    assert acts == [Action(ActionKind.WATER_HEATER, False), Action(ActionKind.BOILER_RODS, 2)]
    assert codes(r) == ["pause_boiler", "shed_water_heater", "shed_rod"]
    assert st.emergency_until == T0 + sec(25) and st.water_heater_shed


def test_spike_shorter_than_5s_does_nothing():
    st = LoadState()
    load_step(S, st, T0, 8.3, True, 3, True)
    assert load_step(S, st, T0 + sec(4), 7.0, True, 3, True) == ([], [])
    assert load_step(S, st, T0 + sec(8), 8.3, True, 3, True)[0] == []


def test_repeated_overload_pauses_again_but_steps_rods_once_per_interval():
    st = LoadState()
    load_step(S, st, T0, 8.3, False, 3, True)
    load_step(S, st, T0 + sec(5), 8.3, False, 3, True)  # pause, rods 3 -> 2
    acts, r = load_step(S, st, T0 + sec(30), 8.3, False, 3, True)
    assert acts == [] and codes(r) == ["pause_boiler"] and st.emergency_until == T0 + sec(50)
    acts, _ = load_step(S, st, T0 + sec(65), 8.3, False, 3, True)
    assert acts == [Action(ActionKind.BOILER_RODS, 1)]
    load_step(S, st, T0 + sec(125), 8.3, False, 3, True)
    assert effective_rods(3, st) == 1


def test_no_new_pause_while_one_is_running():
    st = LoadState()
    load_step(S, st, T0, 8.3, False, 3, True)
    load_step(S, st, T0 + sec(5), 8.3, False, 3, True)
    assert "pause_boiler" not in codes(load_step(S, st, T0 + sec(15), 8.3, False, 3, True)[1])


def test_user_switched_off_water_heater_is_not_restored():
    st = LoadState()
    load_step(S, st, T0, 8.3, False, 3, True)
    acts, _ = load_step(S, st, T0 + sec(5), 8.3, False, 3, True)
    assert acts == [Action(ActionKind.BOILER_RODS, 2)] and not st.water_heater_shed
    load_step(S, st, T0 + sec(10), 5.0, False, 3, True)
    acts, _ = load_step(S, st, T0 + sec(610), 5.0, False, 3, True)
    assert acts == [Action(ActionKind.BOILER_RODS, 3)]
    assert load_step(S, st, T0 + sec(1220), 5.0, False, 3, True)[0] == []


def test_restore_order():
    st = LoadState(water_heater_shed=True, rods_shed=1)
    load_step(S, st, T0, 5.0, False, 3, True)
    assert load_step(S, st, T0 + sec(599), 5.0, False, 3, True)[0] == []
    assert load_step(S, st, T0 + sec(600), 5.0, False, 3, True)[0] == [Action(ActionKind.BOILER_RODS, 3)]
    assert load_step(S, st, T0 + sec(1200), 5.0, False, 3, True)[0] == [Action(ActionKind.WATER_HEATER, True)]


def test_between_thresholds_holds():
    st = LoadState(rods_shed=1)
    load_step(S, st, T0, 7.0, False, 3, True)
    assert load_step(S, st, T0 + sec(700), 7.0, False, 3, True)[0] == []


def test_budget_exhausted_still_pauses_but_keeps_rods():
    st = LoadState(water_heater_shed=True)
    load_step(S, st, T0, 8.5, False, 3, False)
    acts, r = load_step(S, st, T0 + sec(5), 8.5, False, 3, False)
    assert acts == [] and codes(r) == ["pause_boiler", "rods_budget_exhausted"]
    assert st.rods_shed == 0 and st.emergency_until == T0 + sec(25)


def test_unknown_load_holds():
    st = LoadState(rods_shed=1)
    assert load_step(S, st, T0, None, True, 3, True) == ([], [Reason(Layer.LOAD, "load_unknown")])
