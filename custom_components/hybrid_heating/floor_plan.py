"""The floor plan the dashboard card draws.

The card ships a generic schematic. A plan of the user's own flat (tools/dxf_to_plan.py makes one from a
DXF drawing) is uploaded into Home Assistant by an admin and kept with the module's data, so it never has
to be part of the card. Millimetres, y pointing down, as in SVG.
"""

import math
from typing import Any

import probatio as vol

from .core.types import AC_ROOMS, Room

PLAN_VERSION = 1
MAX_POINTS = 20_000  # a flat drawn in detail has a few hundred; this only bounds what is stored
SMALL_LABELS = ("hall", "wardrobe", "storage")


def _number(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        raise vol.Invalid(f"expected a number, got {value!r}")
    return value


_PT = vol.All([_number], vol.Length(min=2, max=2))
_POLYGON = vol.All([_PT], vol.Length(min=3))
_POLYLINE = vol.All([_PT], vol.Length(min=2))
_BOX = {vol.Required(k): _number for k in ("x", "y", "w", "h")}
_ROOM = vol.In([r.value for r in Room])


def _not_too_big(plan: dict[str, Any]) -> dict[str, Any]:
    lines = [*plan["walls"], *plan["bays"], *plan["neutral"]]
    lines += [p for room in plan["rooms"].values() for p in room["polygons"]]
    if sum(len(line) for line in lines) > MAX_POINTS:
        raise vol.Invalid(f"the plan has more than {MAX_POINTS} points")
    return plan


PLAN_SCHEMA = vol.Schema(
    vol.All(
        {
            vol.Required("version"): PLAN_VERSION,
            vol.Required("viewBox"): vol.All([_number], vol.Length(min=4, max=4)),
            vol.Required("walls"): [_POLYGON],
            vol.Required("glass"): [_BOX],
            vol.Required("bays"): [_POLYLINE],
            vol.Required("neutral"): [_POLYGON],
            vol.Required("rooms"): {
                vol.Required(r.value): {
                    vol.Required("polygons"): vol.All([_POLYGON], vol.Length(min=1)),
                    vol.Required("label"): _PT,
                }
                for r in Room
            },
            vol.Required("small_labels"): [
                {vol.Required("key"): vol.In(SMALL_LABELS), vol.Required("at"): _PT}
            ],
            vol.Required("radiators"): [
                {
                    vol.Required("room"): _ROOM,
                    **_BOX,
                    vol.Required("sections"): vol.Any(None, vol.All(int, vol.Range(min=1))),
                }
            ],
            vol.Required("acs"): {
                vol.Optional(r.value): {**_BOX, **{vol.Required(k): _number for k in ("cx", "from", "to")}}
                for r in AC_ROOMS
            },
            vol.Required("floor_heating"): [{vol.Required("room"): _ROOM, **_BOX}],
        },
        _not_too_big,
    )
)


def validate_plan(plan: Any) -> dict[str, Any]:
    """The plan as given, or vol.Invalid saying what is wrong with it."""
    result: dict[str, Any] = PLAN_SCHEMA(plan)
    return result
