from __future__ import annotations

import pytest

from custom_components.hybrid_heating.commands import (
    Command,
    CommandResult,
    commands_for,
    outcome_for,
)
from custom_components.hybrid_heating.core.types import Action, ActionKind, Room
from custom_components.hybrid_heating.entity_map import EntityMap
from tests.fakes import FAKE_ENTITIES, st

E = EntityMap.from_mapping(FAKE_ENTITIES)
BOILER = "climate.boiler"


def test_boiler_flow_rounding_and_clamp():
    v = {BOILER: st("heat", temperature=50, target_temp_step=1, min_temp=20, max_temp=80)}
    assert commands_for(Action(ActionKind.BOILER_FLOW, 35.51), E, v) == [
        Command("climate", "set_temperature", {"entity_id": BOILER, "temperature": 36.0})
    ]
    v[BOILER] = st("heat", temperature=50, target_temp_step=0.5, min_temp=20, max_temp=80)
    assert commands_for(Action(ActionKind.BOILER_FLOW, 35.51), E, v)[0].data["temperature"] == 35.5
    assert commands_for(Action(ActionKind.BOILER_FLOW, 85.0), E, v)[0].data["temperature"] == 80.0
    assert commands_for(Action(ActionKind.BOILER_FLOW, 12.0), E, v)[0].data["temperature"] == 20.0
    v[BOILER] = st("heat", temperature=50, target_temp_step=0.1)
    assert commands_for(Action(ActionKind.BOILER_FLOW, 35.54), E, v)[0].data["temperature"] == 35.5


def test_boiler_flow_without_attributes_rounds_to_whole_degrees():
    assert commands_for(Action(ActionKind.BOILER_FLOW, 44.6), E, {})[0].data["temperature"] == 45.0


def test_simple_mappings():
    assert commands_for(Action(ActionKind.BOILER_CALL, True), E, {}) == [
        Command("switch", "turn_on", {"entity_id": "switch.boiler_heat_call"})
    ]
    assert commands_for(Action(ActionKind.BOILER_CALL, False), E, {})[0].service == "turn_off"
    assert commands_for(Action(ActionKind.WATER_HEATER, False), E, {}) == [
        Command("switch", "turn_off", {"entity_id": "switch.water_heater"})
    ]
    assert commands_for(Action(ActionKind.BOILER_RODS, 3), E, {})[0] == Command(
        "number", "set_value", {"entity_id": "number.boiler_max_rods", "value": 3}
    )
    assert commands_for(Action(ActionKind.AC_HVAC, "heat", Room.LIVING), E, {})[0].data == {
        "entity_id": "climate.living_ac",
        "hvac_mode": "heat",
    }
    assert commands_for(Action(ActionKind.AC_SETPOINT, 24, Room.BEDROOM), E, {})[0].data == {
        "entity_id": "climate.bedroom_ac",
        "temperature": 24,
    }
    assert Command("switch", "turn_on", {"entity_id": "switch.x"}).entity_id == "switch.x"


def test_quiet_on_off():
    on = commands_for(Action(ActionKind.AC_QUIET, True, Room.BEDROOM), E, {})
    assert [(c.service, c.data.get("fan_mode"), c.entity_id) for c in on] == [
        ("set_fan_mode", "low", "climate.bedroom_ac"),
        ("turn_on", None, "switch.bedroom_ac_quiet"),
    ]
    off = commands_for(Action(ActionKind.AC_QUIET, False, Room.BEDROOM), E, {})
    assert [(c.service, c.data.get("fan_mode")) for c in off] == [
        ("turn_off", None),
        ("set_fan_mode", "auto"),
    ]
    no_quiet = EntityMap.from_mapping({k: v for k, v in FAKE_ENTITIES.items() if k != "quiet_bedroom"})
    assert [
        c.service for c in commands_for(Action(ActionKind.AC_QUIET, True, Room.BEDROOM), no_quiet, {})
    ] == ["set_fan_mode"]


@pytest.mark.parametrize("kind", [ActionKind.AC_HVAC, ActionKind.AC_SETPOINT, ActionKind.AC_QUIET])
def test_ac_action_without_room_rejected(kind):
    with pytest.raises(ValueError):
        commands_for(Action(kind, "heat"), E, {})


def test_outcome_worst_status():
    a, c = Action(ActionKind.AC_QUIET, True, Room.BEDROOM), Command("x", "y", {"entity_id": "x.y"})
    assert (
        outcome_for(a, [CommandResult(c, "ok"), CommandResult(c, "skipped", "unavailable")]).status
        == "skipped"
    )
    failed = outcome_for(
        a, [CommandResult(c, "failed", "timeout"), CommandResult(c, "skipped", "unavailable")]
    )
    assert (failed.status, failed.detail) == ("failed", "timeout")
    ok = outcome_for(a, [CommandResult(c, "ok")])
    assert (ok.action, ok.status, ok.detail) == (a, "ok", None)
    assert outcome_for(a, []).status == "skipped"
