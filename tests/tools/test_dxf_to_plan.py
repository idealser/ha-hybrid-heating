"""The DXF converter on a small synthetic drawing (a real flat's drawing stays out of the repository)."""

import copy
import json

import ezdxf
import pytest

from custom_components.hybrid_heating.floor_plan import validate_plan
from tools.dxf_to_plan import PlanMappingError, build_plan, main, read_dxf

# Two bedrooms one above the other: the upper one has a bay on the right, the lower one a window on the left
SMALL_OVERLAY = {
    "rooms": {
        "bedroom": {
            "polygons": [[[0, 400], [1000, 400], [1000, 800], [0, 800]]],
            "label": [500, 600],
            "dxf_labels": ["Спальня"],
            "windows": ["bay"],
        },
        "child": {
            "polygons": [[[0, 0], [600, 0], [600, 400], [0, 400]]],
            "label": [300, 200],
            "dxf_labels": ["Спальня"],
            "windows": ["glass"],
        },
        "living": {"polygons": [[[600, 0], [800, 0], [800, 400], [600, 400]]], "label": [700, 200]},
        "bath": {"polygons": [[[800, 0], [1000, 0], [1000, 400], [800, 400]]], "label": [900, 200]},
    },
    "neutral": [],
    "radiators": [{"room": "child", "rect": [40, 150, 80, 350], "sections": 8}],
    "acs": {"bedroom": {"x": 300, "y": 700, "w": 200, "h": 50, "cx": 400, "from": 700, "to": 500}},
    "floor_heating": [{"room": "bath", "rect": [820, 20, 980, 380]}],
}

BAY = [[(1000, 500), (1020 + d, 520), (1020 + d, 700), (1000, 720)] for d in (0, 20, 40)]


def make_dxf(tmp_path, labels=((200, 200), (200, 600))):
    doc = ezdxf.new()
    msp = doc.modelspace()
    msp.add_lwpolyline([(0, 0), (1000, 0), (1000, 800), (0, 800)], close=True, dxfattribs={"layer": "WALLS"})
    for a, b in [((0, 100), (30, 100)), ((30, 100), (30, 400)), ((30, 400), (0, 400)), ((0, 400), (0, 100))]:
        msp.add_line(a, b, dxfattribs={"layer": "WINDOWS"})
    for line in reversed(BAY):  # outermost first: the converter must not rely on the drawing order
        msp.add_lwpolyline(line, dxfattribs={"layer": "WINDOWS"})
    for x, y in labels:
        msp.add_text("Спальня", dxfattribs={"layer": "ROOMS"}).set_placement((x, y))
    msp.add_text("ignored", dxfattribs={"layer": "FURNITURE"}).set_placement((500, 200))
    path = tmp_path / "flat.dxf"
    doc.saveas(path)
    return path


def swap_rooms(overlay, a, b):
    out = copy.deepcopy(overlay)
    out["rooms"][a], out["rooms"][b] = out["rooms"][b], out["rooms"][a]
    return out


def test_flip_and_viewbox(tmp_path):
    plan = build_plan(read_dxf(make_dxf(tmp_path)), SMALL_OVERLAY)
    assert plan["version"] == 1
    assert plan["viewBox"] == [-150, -150, 1300, 1100] and plan["walls"][0][0] == [0, 800]
    assert plan["rooms"]["bedroom"] == {
        "polygons": [[[0, 400], [1000, 400], [1000, 0], [0, 0]]],
        "label": [500, 200],
    }


def test_glass_from_window_lines(tmp_path):
    assert build_plan(read_dxf(make_dxf(tmp_path)), SMALL_OVERLAY)["glass"] == [
        {"x": 0, "y": 400, "w": 30, "h": 300}
    ]


def test_bay_is_middle_polyline(tmp_path):
    plan = build_plan(read_dxf(make_dxf(tmp_path)), SMALL_OVERLAY)
    assert plan["bays"] == [[[1000, 300], [1040, 280], [1040, 100], [1000, 80]]]


def test_devices_are_flipped(tmp_path):
    plan = build_plan(read_dxf(make_dxf(tmp_path)), SMALL_OVERLAY)
    assert plan["radiators"] == [{"room": "child", "x": 40, "y": 450, "w": 40, "h": 200, "sections": 8}]
    assert plan["acs"] == {
        "bedroom": {"x": 300, "y": 50, "w": 200, "h": 50, "cx": 400, "from": 100, "to": 300}
    }
    assert plan["floor_heating"] == [{"room": "bath", "x": 820, "y": 420, "w": 160, "h": 360}]


def test_swapped_bedrooms_are_rejected(tmp_path):
    with pytest.raises(PlanMappingError, match="Спальня"):
        build_plan(read_dxf(make_dxf(tmp_path)), swap_rooms(SMALL_OVERLAY, "bedroom", "child"))


def test_a_label_outside_every_area_is_rejected(tmp_path):
    with pytest.raises(PlanMappingError, match="Спальня"):
        build_plan(read_dxf(make_dxf(tmp_path, labels=((200, 200), (1500, 600)))), SMALL_OVERLAY)


def test_a_missing_window_is_rejected(tmp_path):
    overlay = copy.deepcopy(SMALL_OVERLAY)
    overlay["rooms"]["child"]["windows"] = ["bay"]
    with pytest.raises(PlanMappingError, match=r"child.*bay"):
        build_plan(read_dxf(make_dxf(tmp_path)), overlay)


def test_output_is_a_valid_card_plan(tmp_path):
    plan = build_plan(read_dxf(make_dxf(tmp_path)), SMALL_OVERLAY)
    assert validate_plan(plan) == plan


def test_cli_writes_the_plan(tmp_path):
    overlay = tmp_path / "overlay.json"
    overlay.write_text(json.dumps(SMALL_OVERLAY, ensure_ascii=False), encoding="utf-8")
    out = tmp_path / "plan.json"
    dxf = make_dxf(tmp_path)
    main(["--dxf", str(dxf), "--overlay", str(overlay), "--out", str(out)])
    assert json.loads(out.read_text(encoding="utf-8")) == build_plan(read_dxf(dxf), SMALL_OVERLAY)


def with_hall_floor(area="hall", rect=(1020, 20, 1180, 380)):
    """A hall beside the bathroom whose floor heating is on the bathroom's circuit."""
    overlay = copy.deepcopy(SMALL_OVERLAY)
    overlay["neutral"] = [
        {"polygon": [[1000, 0], [1200, 0], [1200, 400], [1000, 400]], "key": "hall", "label": [1100, 200]}
    ]
    overlay["floor_heating"].append({"room": "bath", "area": area, "rect": list(rect)})
    return overlay


def test_a_circuit_may_heat_the_floor_of_an_area_without_a_sensor(tmp_path):
    plan = build_plan(read_dxf(make_dxf(tmp_path)), with_hall_floor())
    assert plan["floor_heating"][1] == {"room": "bath", "x": 1020, "y": 420, "w": 160, "h": 360}
    validate_plan(plan)  # the card and the integration take it as a floor of the bathroom's circuit


def test_the_area_of_a_floor_is_checked(tmp_path):
    with pytest.raises(PlanMappingError, match=r"floor heating .* not in storage"):
        build_plan(read_dxf(make_dxf(tmp_path)), with_hall_floor(area="storage"))
    with pytest.raises(PlanMappingError, match=r"floor heating .* not in hall"):
        build_plan(read_dxf(make_dxf(tmp_path)), with_hall_floor(rect=(820, 20, 980, 380)))
