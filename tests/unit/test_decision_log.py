from custom_components.hybrid_heating.commands import ActionOutcome, Command, CommandResult
from custom_components.hybrid_heating.core.types import (
    Action,
    ActionKind,
    Decision,
    Layer,
    Preset,
    Reason,
    Room,
)
from custom_components.hybrid_heating.decision_log import DecisionLog
from tests.conftest import T0, sec

LOAD_CODES = {"shed_water_heater", "pause_boiler", "shed_rod"}


def dec(*codes: str) -> Decision:
    reasons = tuple(Reason(Layer.LOAD if c in LOAD_CODES else Layer.BOILER, c) for c in codes)
    return Decision((), reasons, 36.1, 0, 23.0, Preset.COMFORT, True)


def test_records_only_on_new_codes_or_actions():
    log, a = DecisionLog(), Action(ActionKind.WATER_HEATER, False)
    assert log.record_tick(T0, dec("smooth_on"), []) is True
    assert log.record_tick(T0 + sec(60), dec("smooth_on"), []) is False
    assert log.record_tick(T0 + sec(120), dec("smooth_on", "shed_water_heater"), []) is True
    assert log.record_tick(T0 + sec(180), dec("smooth_on"), []) is False
    assert log.record_tick(T0 + sec(240), dec("smooth_on"), [ActionOutcome(a, "ok", None)]) is True
    assert log.latest(1)[0]["actions"] == [
        {"kind": "water_heater", "value": False, "room": None, "status": "ok", "detail": None}
    ]
    assert len(log.to_data()) == 3


def test_tick_entry_shape():
    log = DecisionLog()
    d = Decision(
        (),
        (Reason(Layer.AC, "ac_started", {"room": "living", "setpoint": 24}),),
        36.1,
        1,
        23.0,
        Preset.NIGHT,
        True,
    )
    outcome = ActionOutcome(Action(ActionKind.AC_SETPOINT, 24, Room.LIVING), "skipped", "unavailable")
    log.record_tick(T0, d, [outcome])
    assert log.latest(1)[0] == {
        "ts": T0.isoformat(),
        "kind": "tick",
        "zone": 1,
        "target": 23.0,
        "preset": "night",
        "flow_target": 36.1,
        "season_active": True,
        "reasons": [{"layer": "ac", "code": "ac_started", "data": {"room": "living", "setpoint": 24}}],
        "actions": [
            {
                "kind": "ac_setpoint",
                "value": 24,
                "room": "living",
                "status": "skipped",
                "detail": "unavailable",
            }
        ],
    }


def test_system_entry_has_no_tick_fields():
    log = DecisionLog()
    cmd = Command("automation", "turn_off", {"entity_id": "automation.overpower_throttle"})
    log.record_system(T0, [Reason("system", "automation_disabled")], [CommandResult(cmd, "ok")])
    e = log.latest(1)[0]
    assert e["kind"] == "system" and e["zone"] is None and e["preset"] is None and e["flow_target"] is None
    assert e["reasons"] == [{"layer": "system", "code": "automation_disabled", "data": {}}]
    assert e["actions"] == [
        {
            "kind": "automation.turn_off",
            "value": "automation.overpower_throttle",
            "room": None,
            "status": "ok",
            "detail": None,
        }
    ]


def test_capacity_500_newest_first_and_before():
    log = DecisionLog()
    for i in range(510):
        log.record_system(T0 + sec(i), [Reason("system", "settings_changed")])
    assert len(log.to_data()) == 500 and log.latest(1)[0]["ts"] == (T0 + sec(509)).isoformat()
    assert log.latest(2, before=T0 + sec(100))[0]["ts"] == (T0 + sec(99)).isoformat()
    assert [e["ts"] for e in log.latest(3)] == [(T0 + sec(i)).isoformat() for i in (509, 508, 507)]


def test_round_trip():
    log = DecisionLog()
    log.record_system(T0, [Reason("system", "module_enabled")])
    log.record_tick(T0 + sec(60), dec("smooth_on"), [])
    assert DecisionLog.from_data(log.to_data()).latest(5) == log.latest(5)


def test_from_data_skips_garbage():
    good = DecisionLog()
    good.record_system(T0, [Reason("system", "module_enabled")])
    data = [*good.to_data(), "junk", {"ts": "not a time"}, {"no": "ts"}]
    assert len(DecisionLog.from_data(data).to_data()) == 1
    assert DecisionLog.from_data("junk").to_data() == []
    assert DecisionLog.from_data(None).to_data() == []


def test_identical_outcomes_are_logged_once():
    log = DecisionLog()
    skipped = [ActionOutcome(Action(ActionKind.BOILER_CALL, True), "skipped", "unavailable")]
    assert log.record_tick(T0, dec("smooth_on"), skipped) is True
    for i in range(1, 10):
        assert log.record_tick(T0 + sec(60 * i), dec("smooth_on"), skipped) is False
    ok = [ActionOutcome(Action(ActionKind.BOILER_CALL, True), "ok", None)]
    assert log.record_tick(T0 + sec(600), dec("smooth_on"), ok) is True
    assert len(log.to_data()) == 2


def test_identical_failed_system_entries_are_logged_once():
    log = DecisionLog()
    cmd = Command("climate", "set_temperature", {"entity_id": "climate.thermostat"})
    failed = [CommandResult(cmd, "failed", "timeout")]
    for i in range(5):
        log.record_system(T0 + sec(i), [Reason("system", "thermostat_restored")], failed)
    assert len(log.to_data()) == 1
    log.record_system(T0 + sec(9), [Reason("system", "settings_changed")])
    log.record_system(T0 + sec(10), [Reason("system", "settings_changed")])
    assert len(log.to_data()) == 3  # entries without failures are always kept


def test_a_new_reason_heads_the_entry():
    log = DecisionLog()
    boiler = Reason(Layer.BOILER, "smooth_on", {"driver": 22.6, "target": 23.0})
    ac = Reason(Layer.AC, "ac_manual_off", {"room": "living"})
    log.record_tick(T0, Decision((), (boiler,), 36.1, 0, 23.0, Preset.COMFORT, True), [])
    assert log.record_tick(T0 + sec(60), Decision((), (boiler, ac), 36.1, 0, 23.0, Preset.COMFORT, True), [])
    assert [r["code"] for r in log.latest(1)[0]["reasons"]] == ["ac_manual_off", "smooth_on"]
