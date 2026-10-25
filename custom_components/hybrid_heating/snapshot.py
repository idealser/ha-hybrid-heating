"""Turn the Home Assistant states of the chosen entities into the controller's Snapshot."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from types import MappingProxyType

from .core.types import Room, Snapshot
from .entity_map import EntityMap
from .view import StateView, as_float, as_switch, attr_float, is_available, power_kw

NO_OFFSETS: Mapping[Room, float] = MappingProxyType({})


def _corrected(value: float | None, offset: float) -> float | None:
    return None if value is None else value + offset


def build_snapshot(
    view: StateView,
    entities: EntityMap,
    now: datetime,
    window_mean: float | None,
    sensor_offsets: Mapping[Room, float] = NO_OFFSETS,
) -> Snapshot:
    acs = {room: view.get(eid) for room, eid in entities.acs.items()}
    boiler = view.get(entities.boiler_flow)
    rods = as_float(view.get(entities.boiler_rods))
    return Snapshot(
        now=now,
        t_out=as_float(view.get(entities.outdoor)),
        t_out_window_mean=window_mean,
        rooms=MappingProxyType(
            {
                room: _corrected(as_float(view.get(eid)), sensor_offsets.get(room, 0.0))
                for room, eid in entities.rooms.items()
            }
        ),
        ac_available=MappingProxyType({room: is_available(s) for room, s in acs.items()}),
        ac_hvac=MappingProxyType(
            {room: s.state if s is not None and is_available(s) else None for room, s in acs.items()}
        ),
        ac_setpoint=MappingProxyType({room: attr_float(s, "temperature") for room, s in acs.items()}),
        boiler_available=is_available(boiler),
        boiler_call_on=as_switch(view.get(entities.boiler_call)),
        boiler_setpoint=attr_float(boiler, "temperature"),
        boiler_rods_limit=int(rods) if rods is not None else None,
        load_kw=power_kw(view.get(entities.total_power)),
        water_heater_on=as_switch(view.get(entities.water_heater)),
    )
