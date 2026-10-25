import copy
import json
from pathlib import Path

import probatio as vol
import pytest

from custom_components.hybrid_heating.floor_plan import MAX_POINTS, validate_plan

SCHEMATIC = Path("frontend/src/plan/schematic.json")


def schematic():
    return json.loads(SCHEMATIC.read_text(encoding="utf-8"))


def inside(pt, polygon):
    x, y = pt
    hit = False
    for (x1, y1), (x2, y2) in zip(polygon, polygon[1:] + polygon[:1], strict=True):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def test_the_built_in_schematic_is_a_valid_plan():
    plan = schematic()
    assert validate_plan(plan) == plan
    for room in plan["rooms"].values():
        assert any(inside(room["label"], p) for p in room["polygons"])
    for item in plan["radiators"] + plan["floor_heating"]:
        centre = (item["x"] + item["w"] / 2, item["y"] + item["h"] / 2)
        assert any(inside(centre, p) for p in plan["rooms"][item["room"]]["polygons"])
    for room, ac in plan["acs"].items():
        assert any(inside((ac["cx"], ac["y"] + ac["h"] / 2), p) for p in plan["rooms"][room]["polygons"])


@pytest.mark.parametrize(
    "change",
    [
        lambda p: p.update(version=2),
        lambda p: p["rooms"].pop("bath"),
        lambda p: p["rooms"]["living"]["polygons"][0].__setitem__(0, [True, 0]),
        lambda p: p["rooms"]["living"].__setitem__("label", [1, 2, 3]),
        lambda p: p["radiators"].append({"room": "hall", "x": 0, "y": 0, "w": 1, "h": 1, "sections": None}),
        lambda p: p["acs"].__setitem__("child", dict(next(iter(p["acs"].values())))),
        lambda p: p["walls"].append([[0, 0], [1, float("nan")], [2, 2]]),
        lambda p: p.update(extra=1),
    ],
)
def test_bad_plans_are_rejected(change):
    plan = schematic()
    change(plan)
    with pytest.raises(vol.Invalid):
        validate_plan(plan)


def test_a_huge_plan_is_rejected():
    plan = copy.deepcopy(schematic())
    plan["walls"].append([[i, i % 7] for i in range(MAX_POINTS)])
    with pytest.raises(vol.Invalid, match="points"):
        validate_plan(plan)
