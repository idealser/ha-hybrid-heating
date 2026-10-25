"""Turn a flat's DXF drawing into the floor plan the dashboard card draws.

The drawing gives the geometry: closed polylines on the wall layers, window frames drawn as lines, bay
windows drawn as three parallel open polylines, and room names as text. A drawing does not say which
area is which room, so an overlay JSON in the drawing's coordinates (millimetres, y up) does:

    {"rooms": {"living": {"polygons": [[[x, y], ...]], "label": [x, y],
                          "dxf_labels": ["Kitchen"], "windows": ["glass", "bay"]}, ...},
     "neutral": [{"polygon": [[x, y], ...], "key": "hall", "label": [x, y], "dxf_label": "Hall"}],
     "radiators": [{"room": "living", "rect": [x1, y1, x2, y2], "sections": 12}],
     "acs": {"living": {"x": .., "y": .., "w": .., "h": .., "cx": .., "from": .., "to": ..}},
     "floor_heating": [{"room": "bath", "rect": [x1, y1, x2, y2]}]}

The overlay is checked against the drawing (room names, windows, and where the devices are), so a
swapped room is caught before it reaches the card. Both files describe a real home: keep them out of
public repositories. Upload the result from the card's editor, or with the hybrid_heating/set_plan
websocket command.

Usage: uv run python tools/dxf_to_plan.py --dxf flat.dxf --overlay overlay.json --out plan.json
"""

import argparse
import json
import math
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ezdxf.entities.line import Line
from ezdxf.entities.lwpolyline import LWPolyline
from ezdxf.entities.text import Text
from ezdxf.filemanagement import readfile

type Pt = tuple[float, float]

WALL_LAYERS = ("WALLS", "WALLS_GKL")
WINDOW_LAYER = "WINDOWS"
ROOM_LAYER = "ROOMS"
WINDOW_NEAR = 350.0  # mm: a room "has" a window or bay that close to it
TOUCH = 1.0  # mm: lines this close belong to the same window frame


class PlanMappingError(ValueError):
    """The overlay does not fit the drawing."""


@dataclass(frozen=True)
class Rect:
    x1: float
    y1: float
    x2: float
    y2: float

    @classmethod
    def around(cls, points: Sequence[Pt]) -> Rect:
        xs, ys = [p[0] for p in points], [p[1] for p in points]
        return cls(min(xs), min(ys), max(xs), max(ys))

    def gap(self, other: Rect) -> float:
        dx = max(other.x1 - self.x2, self.x1 - other.x2, 0.0)
        dy = max(other.y1 - self.y2, self.y1 - other.y2, 0.0)
        return math.hypot(dx, dy)

    def union(self, other: Rect) -> Rect:
        return Rect(
            min(self.x1, other.x1), min(self.y1, other.y1), max(self.x2, other.x2), max(self.y2, other.y2)
        )

    @property
    def area(self) -> float:
        return (self.x2 - self.x1) * (self.y2 - self.y1)

    @property
    def centre(self) -> Pt:
        return ((self.x1 + self.x2) / 2, (self.y1 + self.y2) / 2)


@dataclass(frozen=True)
class DxfGeometry:
    walls: list[list[Pt]]  # in drawing order
    glass: list[Rect]  # one frame per window, left to right
    bays: list[list[Pt]]  # the middle line of each bay, left to right
    labels: list[tuple[str, float, float]]


def _groups[T](items: list[T], box: Any) -> list[list[T]]:
    """Items whose boxes touch, transitively."""
    groups: list[list[T]] = []
    for item in items:
        touching = [g for g in groups if any(box(item).gap(box(o)) <= TOUCH for o in g)]
        merged = [item] + [o for g in touching for o in g]
        groups = [g for g in groups if g not in touching] + [merged]
    return groups


def read_dxf(path: Path) -> DxfGeometry:
    msp = readfile(path).modelspace()
    walls: list[list[Pt]] = []
    frames: list[Rect] = []
    bay_lines: list[list[Pt]] = []
    labels: list[tuple[str, float, float]] = []
    for e in msp:
        layer = e.dxf.layer
        if isinstance(e, LWPolyline) and layer in WALL_LAYERS and e.closed:
            walls.append([(float(x), float(y)) for x, y in e.get_points("xy")])
        elif isinstance(e, Line) and layer == WINDOW_LAYER:
            frames.append(Rect.around([(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)]))
        elif isinstance(e, LWPolyline) and layer == WINDOW_LAYER and not e.closed:
            bay_lines.append([(float(x), float(y)) for x, y in e.get_points("xy")])
        elif isinstance(e, Text) and layer == ROOM_LAYER:
            aligned = e.dxf.halign or e.dxf.valign
            at = e.dxf.align_point if aligned and e.dxf.hasattr("align_point") else e.dxf.insert
            labels.append((e.dxf.text, float(at.x), float(at.y)))
    glass = sorted(
        (_union(g) for g in _groups(frames, lambda r: r)),
        key=lambda r: r.x1,
    )
    bays = sorted(
        (_middle(g) for g in _groups(bay_lines, Rect.around)),
        key=lambda line: Rect.around(line).x1,
    )
    return DxfGeometry(walls=walls, glass=glass, bays=bays, labels=labels)


def _union(rects: list[Rect]) -> Rect:
    out = rects[0]
    for r in rects[1:]:
        out = out.union(r)
    return out


def _middle(lines: list[list[Pt]]) -> list[Pt]:
    """A bay is drawn as inner, middle and outer lines; the card draws the middle one."""
    return sorted(lines, key=lambda line: Rect.around(line).area)[len(lines) // 2]


def _inside(pt: Pt, polygon: Sequence[Sequence[float]]) -> bool:
    x, y = pt
    hit = False
    for (x1, y1), (x2, y2) in zip(polygon, [*polygon[1:], polygon[0]], strict=True):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def _areas(overlay: dict[str, Any]) -> list[tuple[str, list[Any], list[str]]]:
    rooms = [(k, r["polygons"], r.get("dxf_labels", [])) for k, r in overlay["rooms"].items()]
    neutral = [
        (n.get("key") or f"neutral {i}", [n["polygon"]], [n["dxf_label"]] if n.get("dxf_label") else [])
        for i, n in enumerate(overlay.get("neutral", []))
    ]
    return rooms + neutral


def _named(overlay: dict[str, Any], room: str) -> str:
    labels = overlay["rooms"].get(room, {}).get("dxf_labels", [])
    return f"{room} ({', '.join(labels)})" if labels else room


def check_mapping(geo: DxfGeometry, overlay: dict[str, Any]) -> None:
    """Raise PlanMappingError where the overlay and the drawing disagree."""
    areas = _areas(overlay)
    found: dict[str, list[str]] = {key: [] for key, _, _ in areas}
    for text, x, y in geo.labels:
        hits = [key for key, polygons, _ in areas if any(_inside((x, y), p) for p in polygons)]
        if len(hits) != 1:
            where = ", ".join(hits) or "no area"
            raise PlanMappingError(f"«{text}» at ({x:.0f}, {y:.0f}) is in {where}; it must be in exactly one")
        found[hits[0]].append(text)
    for key, _, expected in areas:
        if sorted(found[key]) != sorted(expected):
            raise PlanMappingError(f"{key}: the drawing names it {found[key]}, the overlay says {expected}")

    kinds = {"glass": geo.glass, "bay": [Rect.around(b) for b in geo.bays]}
    for key, room in overlay["rooms"].items():
        boxes = [Rect.around(p) for p in room["polygons"]]
        for kind in room.get("windows", []):
            if not any(b.gap(w) <= WINDOW_NEAR for b in boxes for w in kinds[kind]):
                raise PlanMappingError(f"{_named(overlay, key)} has no {kind} within {WINDOW_NEAR:.0f} mm")

    def in_room(room: str, pt: Pt, what: str) -> None:
        if room not in overlay["rooms"] or not any(
            _inside(pt, p) for p in overlay["rooms"][room]["polygons"]
        ):
            raise PlanMappingError(
                f"the {what} at ({pt[0]:.0f}, {pt[1]:.0f}) is not in {_named(overlay, room)}"
            )

    for r in overlay.get("radiators", []):
        in_room(r["room"], Rect(*r["rect"]).centre, "radiator")
    for room, ac in overlay.get("acs", {}).items():
        in_room(room, (ac["cx"], ac["y"] + ac["h"] / 2), "air conditioner")
    for f in overlay.get("floor_heating", []):
        in_room(f["room"], Rect(*f["rect"]).centre, "floor heating")


def build_plan(geo: DxfGeometry, overlay: dict[str, Any], pad: float = 150) -> dict[str, Any]:
    """The card's floor plan: whole millimetres, y flipped to point down."""
    check_mapping(geo, overlay)
    bounds = _union([Rect.around(w) for w in geo.walls])
    fy = bounds.y2

    def pt(p: Sequence[float]) -> list[int]:
        return [round(p[0]), round(fy - p[1])]

    def line(points: Sequence[Sequence[float]]) -> list[list[int]]:
        return [pt(p) for p in points]

    def box(r: Rect) -> dict[str, int]:
        return {"x": round(r.x1), "y": round(fy - r.y2), "w": round(r.x2 - r.x1), "h": round(r.y2 - r.y1)}

    def ac(a: dict[str, float]) -> dict[str, int]:
        return {
            **box(Rect(a["x"], a["y"], a["x"] + a["w"], a["y"] + a["h"])),
            "cx": round(a["cx"]),
            "from": round(fy - a["from"]),
            "to": round(fy - a["to"]),
        }

    neutral = overlay.get("neutral", [])
    return {
        "version": 1,
        "viewBox": [
            round(bounds.x1 - pad),
            round(-pad),
            round(bounds.x2 - bounds.x1 + 2 * pad),
            round(bounds.y2 - bounds.y1 + 2 * pad),
        ],
        "walls": [line(w) for w in geo.walls],
        "glass": [box(g) for g in geo.glass],
        "bays": [line(b) for b in geo.bays],
        "neutral": [line(n["polygon"]) for n in neutral],
        "rooms": {
            k: {"polygons": [line(p) for p in r["polygons"]], "label": pt(r["label"])}
            for k, r in overlay["rooms"].items()
        },
        "small_labels": [
            {"key": n["key"], "at": pt(n["label"])} for n in neutral if n.get("key") and n.get("label")
        ],
        "radiators": [
            {"room": r["room"], **box(Rect(*r["rect"])), "sections": r.get("sections")}
            for r in overlay.get("radiators", [])
        ],
        "acs": {room: ac(a) for room, a in overlay.get("acs", {}).items()},
        "floor_heating": [
            {"room": f["room"], **box(Rect(*f["rect"]))} for f in overlay.get("floor_heating", [])
        ],
    }


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--dxf", type=Path, required=True)
    parser.add_argument("--overlay", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    overlay = json.loads(args.overlay.read_text(encoding="utf-8"))
    plan = build_plan(read_dxf(args.dxf), overlay)
    args.out.write_text(json.dumps(plan, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
