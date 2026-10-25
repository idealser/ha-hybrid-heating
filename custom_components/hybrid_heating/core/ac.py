"""Per-room heat-pump (AC) control: each AC follows its own room sensor."""

from dataclasses import dataclass, field
from datetime import datetime

from .timeutil import elapsed_s
from .types import AcSettings, Action, ActionKind, Layer, NightMode, Preset, Reason, Room, ZonePolicy


@dataclass
class AcState:
    owned: set[Room] = field(default_factory=set)  # ACs this module switched on
    last_step_at: dict[Room, datetime] = field(default_factory=dict)
    fail_since: dict[Room, datetime | None] = field(default_factory=dict)
    degraded: set[Room] = field(default_factory=set)
    quiet: dict[Room, bool] = field(default_factory=dict)
    manual_hold: set[Room] = field(default_factory=set)  # switched off by the user; not restarted
    hand: set[Room] = field(default_factory=set)  # run by the user (remote, app): theirs until switched off


def ac_allowed(
    hybrid: bool,
    policy: ZonePolicy,
    room: Room,
    t_out: float,
    preset: Preset,
    night_mode: NightMode | None,
    *,
    min_outdoor: float = -15.0,
) -> bool:
    """night_mode is passed only during the night window."""
    return (
        hybrid
        and room in policy.ac_rooms
        and t_out >= min_outdoor
        and preset is not Preset.AWAY
        and night_mode is not NightMode.OFF
    )


def _reason(code: str, room: Room, **data: float | str | bool) -> Reason:
    return Reason(Layer.AC, code, {"room": room.value, **data})


def decide_ac(
    s: AcSettings,
    st: AcState,
    room: Room,
    *,
    allowed: bool,
    target: float,
    room_temp: float | None,
    hvac: str | None,
    setpoint: float | None,
    available: bool,
    quiet_wanted: bool,
    now: datetime,
) -> tuple[list[Action], list[Reason]]:
    acts: list[Action] = []
    reasons: list[Reason] = []

    if not available:
        st.degraded.add(room)
        return acts, [_reason("ac_unavailable", room)]

    is_on = hvac not in (None, "off")

    if not allowed:
        st.fail_since[room] = None
        if room in st.owned:
            st.owned.discard(room)
            if is_on:
                acts.append(Action(ActionKind.AC_HVAC, "off", room))
                reasons.append(_reason("ac_stopped", room))
        elif is_on:
            st.hand.add(room)
            reasons.append(_reason("ac_manual_left_alone", room))
        return acts, reasons

    if hvac == "off" and room in st.manual_hold:
        return acts, [_reason("ac_manual_hold", room)]

    if hvac == "off" and room in st.hand:
        # Someone ran it by hand and has now switched it off: that is a switch-off too.
        st.hand.discard(room)
        st.manual_hold.add(room)
        return acts, [_reason("ac_manual_off", room)]

    if hvac == "off" and room in st.owned:
        last = st.last_step_at.get(room)
        if last is not None and elapsed_s(now, last) < s.command_grace_s:
            return acts, reasons  # our start may not have landed yet
        # We had it running and it is off: the user switched it off. Respect that until a reset.
        st.owned.discard(room)
        st.manual_hold.add(room)
        return acts, [_reason("ac_manual_off", room)]

    if hvac == "off":
        start_at = _clamp_setpoint(s, round(target) + 1)
        acts += [Action(ActionKind.AC_HVAC, "heat", room), Action(ActionKind.AC_SETPOINT, start_at, room)]
        st.owned.add(room)
        st.last_step_at[room] = now
        reasons.append(_reason("ac_started", room, setpoint=start_at))
        _quiet(st, room, quiet_wanted, acts, reasons)
        return acts, reasons

    if hvac != "heat" or room not in st.owned:
        # The user runs this AC by hand (another mode, or heat they switched on): leave it alone.
        st.owned.discard(room)
        if hvac is not None:
            st.hand.add(room)
            reasons.append(_reason("ac_manual_left_alone", room))
        return acts, reasons

    _quiet(st, room, quiet_wanted, acts, reasons)
    if room_temp is None:
        return acts, reasons

    error = room_temp - target
    current = _clamp_setpoint(s, round(setpoint) if setpoint is not None else round(target) + 1)
    last = st.last_step_at.get(room)
    if last is None or elapsed_s(now, last) >= s.step_interval_s:
        if error < -s.deadband and current < s.setpoint_max:
            acts.append(Action(ActionKind.AC_SETPOINT, current + 1, room))
            st.last_step_at[room] = now
            reasons.append(_reason("ac_step_up", room, setpoint=current + 1, error=round(error, 2)))
        elif error > s.deadband and current > s.setpoint_min:
            acts.append(Action(ActionKind.AC_SETPOINT, current - 1, room))
            st.last_step_at[room] = now
            reasons.append(_reason("ac_step_down", room, setpoint=current - 1, error=round(error, 2)))

    if error < -s.fail_error:
        since = st.fail_since.get(room) or now
        st.fail_since[room] = since
        if elapsed_s(now, since) >= s.fail_after_s:
            st.degraded.add(room)
            reasons.append(_reason("ac_not_coping", room, error=round(error, 2)))
    else:
        st.fail_since[room] = None
        st.degraded.discard(room)
    return acts, reasons


def _clamp_setpoint(s: AcSettings, value: int) -> int:
    return max(s.setpoint_min, min(s.setpoint_max, value))


def _quiet(st: AcState, room: Room, wanted: bool, acts: list[Action], reasons: list[Reason]) -> None:
    if st.quiet.get(room, False) != wanted:
        st.quiet[room] = wanted
        acts.append(Action(ActionKind.AC_QUIET, wanted, room))
        reasons.append(_reason("ac_quiet_on" if wanted else "ac_quiet_off", room))
