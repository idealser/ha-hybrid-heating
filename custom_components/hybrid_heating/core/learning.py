"""Learning from the house: the morning check of the curve and the Cold/Hot marks.

Nothing here changes a setting. A suggestion carries the setting, its value when the suggestion was made
and the new value; the user applies it as a settings patch, or dismisses it.
"""

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from types import MappingProxyType
from typing import Any, Literal

from .controller import ControllerState
from .curve import CURVE_OUTDOOR_POINTS
from .model import CapacityEstimate, DayTally, HeatLossEstimate, HourTally
from .timeutil import before
from .types import AC_ROOMS, DRIVER_ROOMS, Decision, Layer, LayerMode, Preset, Room, Settings, Snapshot

EPS = 1e-9  # a room exactly 0.5° off counts as off


@dataclass(frozen=True)
class LearningSettings:
    morning_start: time = time(8, 0)  # the night ends at 07:00: an hour to warm up
    morning_end: time = time(9, 0)
    morning_min_ticks: int = 45
    on_curve_share: float = 0.9
    band_step: float = 5.0
    miss: float = 0.5
    streak: int = 3
    curve_step: float = 1.5
    dismiss_for: timedelta = timedelta(days=30)
    feedback_window: timedelta = timedelta(days=7)
    feedback_min_marks: int = 2
    feedback_min_gap: timedelta = timedelta(hours=1)  # several taps in a row are one complaint
    offset_step: float = 0.3
    offset_limit: float = 3.0
    bath_shift_step: float = 1.0
    shift_limit: float = 10.0
    keep_marks: timedelta = timedelta(days=30)
    keep_mornings: timedelta = timedelta(days=14)
    keep_resolutions: timedelta = timedelta(days=45)  # longer than a dismissal lasts
    keep_tallies: timedelta = timedelta(days=35)  # longer than the heat-loss window
    keep_hours: timedelta = timedelta(days=15)  # longer than the heat-capacity window
    # The room correction as a signal (smooth mode): what it adds on average, by band, over a week
    correction_threshold: float = 1.5
    correction_window: timedelta = timedelta(days=7)
    correction_min_days: int = 3
    correction_min_minutes: int = 60  # in a band on one day, for the day to count
    settle_after_target_change: timedelta = timedelta(hours=2)  # a morning warm-up is not the curve's


LEARNING = LearningSettings()

type SuggestionKind = Literal["curve", "feedback"]
type ResolutionAction = Literal["applied", "dismissed"]
type MarkKind = Literal["cold", "hot"]


def _empty() -> Mapping[str, int | float | str]:
    return MappingProxyType({})


@dataclass(frozen=True)
class Suggestion:
    id: str
    key: str  # what it is about, e.g. "curve:5:up": one suggestion per key at a time
    kind: SuggestionKind
    setting: str  # "curve.points.<t>", "curve.shift" or "room_offsets.<room>"
    old: float
    new: float
    band: int | None  # the outdoor band (a curve point's temperature), for "similar weather"
    room: Room | None
    created_at: datetime
    evidence: Mapping[str, int | float | str] = field(default_factory=_empty)


def make_suggestion(
    key: str,
    kind: SuggestionKind,
    setting: str,
    old: float,
    new: float,
    *,
    band: int | None,
    room: Room | None,
    now: datetime,
    evidence: Mapping[str, int | float | str],
) -> Suggestion:
    sid = f"{key}@{now.isoformat(timespec='minutes')}"
    return Suggestion(sid, key, kind, setting, old, new, band, room, now, MappingProxyType(dict(evidence)))


@dataclass(frozen=True)
class Resolution:
    suggestion: Suggestion
    action: ResolutionAction
    at: datetime


def band_of(t_out: float, step: float = LEARNING.band_step) -> int:
    """The curve point whose 5° band holds t_out: [p - 2.5, p + 2.5)."""
    band = step * math.floor(t_out / step + 0.5)
    return int(min(max(band, CURVE_OUTDOOR_POINTS[-1]), CURVE_OUTDOOR_POINTS[0]))


def is_suppressed(
    resolutions: Sequence[Resolution],
    key: str,
    band: int | None,
    now: datetime,
    ls: LearningSettings = LEARNING,
) -> bool:
    """Dismissed in the same band less than 30 days ago."""
    return any(
        r.action == "dismissed"
        and r.suggestion.key == key
        and r.suggestion.band == band
        and before(now, r.at + ls.dismiss_for)
        for r in resolutions
    )


def evidence_cutoff(resolutions: Sequence[Resolution], key: str) -> datetime | None:
    """The last decision on this key: what was seen before it has been answered already."""
    times = [r.at for r in resolutions if r.suggestion.key == key]
    return max(times) if times else None


def _latest(*times: datetime | None) -> datetime | None:
    known = [t for t in times if t is not None]
    return max(known) if known else None


def lever_changes(old: Settings, new: Settings) -> list[str]:
    """The settings suggestions change that differ between old and new, as suggestion settings."""
    out = [
        f"curve.points.{int(t)}"
        for (t, a), (_, b) in zip(old.curve.points, new.curve.points, strict=True)
        if a != b
    ]
    if old.curve.shift != new.curve.shift:
        out.append("curve.shift")
    rooms = sorted(set(old.room_offsets) | set(new.room_offsets))
    out += [
        f"room_offsets.{r}" for r in rooms if old.room_offsets.get(r, 0.0) != new.room_offsets.get(r, 0.0)
    ]
    return out


# The setting a suggestion changes


class StaleSuggestion(Exception):
    """The setting is no longer what the suggestion started from: the user changed it meanwhile."""


def current_value(settings: Settings, setting: str) -> float:
    head, _, tail = setting.rpartition(".")
    if head == "curve.points":
        return dict(settings.curve.points)[float(tail)]
    if setting == "curve.shift":
        return settings.curve.shift
    if head == "room_offsets":
        return settings.room_offsets.get(Room(tail), 0.0)
    raise ValueError(f"not a setting suggestions change: {setting}")


def suggestion_patch(settings: Settings, sg: Suggestion) -> dict[str, Any]:
    """The settings patch that applies `sg`; StaleSuggestion if its setting moved since."""
    if abs(current_value(settings, sg.setting) - sg.old) > 1e-6:
        raise StaleSuggestion(sg.setting)
    head, _, tail = sg.setting.rpartition(".")
    if head == "curve.points":
        point, points = float(tail), settings.curve.points
        i = next(i for i, (t, _) in enumerate(points) if t == point)
        warmer = points[i - 1][1] if i > 0 else -math.inf
        colder = points[i + 1][1] if i + 1 < len(points) else math.inf
        if not warmer <= sg.new <= colder:
            raise StaleSuggestion(sg.setting)  # a neighbour moved since: the curve would no longer rise
        return {"curve": {"points": [[t, sg.new if t == point else f] for t, f in points]}}
    if sg.setting == "curve.shift":
        return {"curve": {"shift": sg.new}}
    return {"room_offsets": {tail: sg.new}}


# The morning check of the curve


@dataclass(frozen=True)
class TickSample:
    at: datetime
    t_out: float | None
    driver: float  # the room the boiler follows, against its own target
    target: float
    on_curve: bool
    correction: float = 0.0  # what the room correction added to the curve's flow


def _on_curve(settings: Settings, snap: Snapshot, d: Decision, st: ControllerState) -> bool:
    """The boiler ran the module's curve: in Control, in season, nothing missing, nothing shed or paused."""
    paused = st.load.emergency_until is not None and before(snap.now, st.load.emergency_until)
    # A room the boiler would follow without a reading: it then follows the others, a different measure.
    missing = any(snap.rooms.get(r) is None for r in DRIVER_ROOMS) or any(
        r.code == "outdoor_unavailable" for r in d.reasons
    )
    return (
        settings.layers.get(Layer.BOILER) is LayerMode.ACTIVE
        and d.season_active
        and snap.boiler_available
        and snap.t_out is not None
        and not missing
        and st.load.rods_shed == 0
        and not paused
    )


def tick_sample(settings: Settings, snap: Snapshot, d: Decision, st: ControllerState) -> TickSample | None:
    reason = next((r for r in d.reasons if r.layer is Layer.BOILER and "driver" in r.data), None)
    if reason is None:
        return None
    driver, target = reason.data["driver"], reason.data["target"]
    correction = reason.data.get("correction", 0.0)
    assert isinstance(driver, (int, float)) and isinstance(target, (int, float))
    assert isinstance(correction, (int, float))
    on_curve = _on_curve(settings, snap, d, st)
    return TickSample(snap.now, snap.t_out, float(driver), float(target), on_curve, float(correction))


@dataclass(frozen=True)
class MorningSample:
    day: date
    t_out: float
    error: float  # mean of (room the boiler follows - its target)
    on_curve: bool
    ticks: int


def morning_sample(
    day: date, ticks: Sequence[TickSample], ls: LearningSettings = LEARNING
) -> MorningSample | None:
    """One morning, or None if it does not count (too few ticks, the target changed)."""
    known = [s for s in ticks if s.t_out is not None]
    if len(known) < ls.morning_min_ticks:
        return None
    targets = [s.target for s in ticks]
    if max(targets) - min(targets) > 0.05:
        return None
    n = len(known)
    return MorningSample(
        day=day,
        t_out=round(sum(s.t_out for s in known if s.t_out is not None) / n, 2),
        error=round(sum(s.driver - s.target for s in known) / n, 2),
        on_curve=sum(s.on_curve for s in ticks) >= ls.on_curve_share * len(ticks),
        ticks=len(ticks),
    )


def _morning_end(day: date, now: datetime, ls: LearningSettings) -> datetime:
    return datetime.combine(day, ls.morning_end, tzinfo=now.tzinfo)


def _curve_step(settings: Settings, band: int, up: bool, ls: LearningSettings) -> tuple[float, float] | None:
    """(old, new) for moving the band's point a step; None at a flow limit or where the curve would fall."""
    points = settings.curve.points
    i = next(i for i, (t, _) in enumerate(points) if t == band)
    old = points[i][1]
    new = round(old + ls.curve_step if up else old - ls.curve_step, 1)
    if up and (old >= settings.curve.flow_max or (i + 1 < len(points) and new > points[i + 1][1])):
        return None  # at the limit already, or it would rise above the colder point
    if not up and (old <= settings.curve.flow_min or (i > 0 and new < points[i - 1][1])):
        return None
    return old, new


def curve_suggestion(
    mornings: Sequence[MorningSample],
    settings: Settings,
    resolutions: Sequence[Resolution],
    now: datetime,
    ls: LearningSettings = LEARNING,
    changed: Mapping[str, datetime] = MappingProxyType({}),
) -> Suggestion | None:
    """Three mornings in a row in one band, all short of the target (or all over it): move that point.

    Mornings before the last decision on this suggestion, or before the point or the shift last changed,
    were measured on another curve and do not count.
    """
    days = [now.date() - timedelta(days=i) for i in reversed(range(ls.streak))]
    by_day = {m.day: m for m in mornings}
    if any(d not in by_day for d in days):
        return None
    run = [by_day[d] for d in days]
    band = band_of(run[0].t_out, ls.band_step)
    if not all(m.on_curve and band_of(m.t_out, ls.band_step) == band for m in run):
        return None
    if all(m.error <= -ls.miss + EPS for m in run):
        up = True
    elif all(m.error >= ls.miss - EPS for m in run):
        up = False
    else:
        return None
    key = f"curve:{band}:{'up' if up else 'down'}"
    cutoff = _latest(
        evidence_cutoff(resolutions, key), changed.get(f"curve.points.{band}"), changed.get("curve.shift")
    )
    if cutoff is not None and any(not before(cutoff, _morning_end(m.day, now, ls)) for m in run):
        return None
    if is_suppressed(resolutions, key, band, now, ls):
        return None
    step = _curve_step(settings, band, up, ls)
    if step is None:
        return None
    old, new = step
    evidence = {
        "mornings": len(run),
        "mean_error": round(sum(m.error for m in run) / len(run), 2),
        "t_min": min(m.t_out for m in run),
        "t_max": max(m.t_out for m in run),
    }
    return make_suggestion(
        key, "curve", f"curve.points.{band}", old, new, band=band, room=None, now=now, evidence=evidence
    )


# Cold/Hot marks


@dataclass(frozen=True)
class Mark:
    at: datetime
    room: Room
    kind: MarkKind
    room_temp: float | None
    target: float  # the room's own target then
    t_out: float | None
    preset: Preset
    zone: int
    flow_target: float | None
    ac_hvac: str | None  # rooms with an AC only
    ac_setpoint: float | None


def make_mark(
    room: Room, kind: MarkKind, settings: Settings, snap: Snapshot, d: Decision, at: datetime | None = None
) -> Mark:
    """What the room was like: the last tick's readings and decision; `at` is when the mark was made."""
    ac = room in AC_ROOMS
    return Mark(
        at=at or snap.now,
        room=room,
        kind=kind,
        room_temp=snap.rooms.get(room),
        target=round(d.target + settings.room_offsets.get(room, 0.0), 2),
        t_out=snap.t_out,
        preset=d.preset,
        zone=d.zone,
        flow_target=d.flow_target,
        ac_hvac=snap.ac_hvac.get(room) if ac else None,
        ac_setpoint=snap.ac_setpoint.get(room) if ac else None,
    )


def _lever(room: Room, kind: MarkKind, settings: Settings, ls: LearningSettings) -> tuple[str, float, float]:
    """(setting, old, new) for a room that is too cold or too hot.

    The bathroom has no heater the module steers by its sensor, so its lever is the whole curve. Every
    other room has its own target: the AC holds it, and the boiler follows rooms against their targets.
    """
    sign = 1.0 if kind == "cold" else -1.0
    if room is Room.BATH:
        old, step, limit, setting = settings.curve.shift, ls.bath_shift_step, ls.shift_limit, "curve.shift"
    else:
        old, step, limit = settings.room_offsets.get(room, 0.0), ls.offset_step, ls.offset_limit
        setting = f"room_offsets.{room}"
    return setting, old, round(min(limit, max(-limit, old + sign * step)), 1)


def feedback_suggestion(
    marks: Sequence[Mark],
    room: Room,
    kind: MarkKind,
    settings: Settings,
    resolutions: Sequence[Resolution],
    now: datetime,
    ls: LearningSettings = LEARNING,
    changed: Mapping[str, datetime] = MappingProxyType({}),
) -> Suggestion | None:
    """Two or more marks of the same kind for a room within 7 days, an hour apart: change its lever.

    Marks before the last decision on this suggestion, or before its setting last changed, are answered.
    """
    key = f"fb:{room}:{kind}"
    setting, old, new = _lever(room, kind, settings, ls)
    cutoff = _latest(evidence_cutoff(resolutions, key), changed.get(setting))
    recent = sorted(
        (
            m
            for m in marks
            if m.room is room
            and m.kind == kind
            and before(now - ls.feedback_window, m.at)
            and (cutoff is None or before(cutoff, m.at))
        ),
        key=lambda m: m.at,
    )
    counted: list[Mark] = []
    for m in recent:
        if not counted or not before(m.at, counted[-1].at + ls.feedback_min_gap):
            counted.append(m)
    if len(counted) < ls.feedback_min_marks:
        return None
    last = counted[-1]
    band = band_of(last.t_out, ls.band_step) if last.t_out is not None else None
    if new == old or is_suppressed(resolutions, key, band, now, ls):
        return None
    evidence: dict[str, int | float | str] = {"marks": len(counted)}
    if last.room_temp is not None:
        evidence["room_temp"] = last.room_temp
    if last.t_out is not None:
        evidence["t_out"] = last.t_out
    return make_suggestion(
        key, "feedback", setting, old, new, band=band, room=room, now=now, evidence=evidence
    )


# What the module keeps


@dataclass
class LearningData:
    marks: list[Mark] = field(default_factory=list)
    mornings: list[MorningSample] = field(default_factory=list)
    pending: list[Suggestion] = field(default_factory=list)
    resolutions: list[Resolution] = field(default_factory=list)
    tallies: dict[date, DayTally] = field(default_factory=dict)
    heat_loss: HeatLossEstimate | None = None  # the latest estimate, whatever its status
    heat_loss_ok: HeatLossEstimate | None = None  # the latest good one: what estimates use
    hours: dict[datetime, HourTally] = field(default_factory=dict)
    capacity: CapacityEstimate | None = None  # the latest estimate, whatever its status
    capacity_ok: CapacityEstimate | None = None  # the latest good one: what estimates use
    corrections: list[CorrectionDay] = field(default_factory=list)
    changed: dict[str, datetime] = field(default_factory=dict)  # when a suggestion setting last changed


def upsert_pending(pending: Sequence[Suggestion], sg: Suggestion) -> list[Suggestion]:
    """One suggestion per key: the same change keeps the one shown already, a different one replaces it."""
    current = next((p for p in pending if p.key == sg.key), None)
    if current is not None and (current.setting, current.old, current.new) == (sg.setting, sg.old, sg.new):
        return list(pending)
    return [p for p in pending if p.key != sg.key] + [sg]


def is_fresh(settings: Settings, sg: Suggestion) -> bool:
    """The setting still has the value the suggestion started from."""
    try:
        return abs(current_value(settings, sg.setting) - sg.old) <= 1e-6
    except ValueError, KeyError:
        return False


def prune(
    data: LearningData, settings: Settings, now: datetime, ls: LearningSettings = LEARNING
) -> LearningData:
    """A copy without old records, and without suggestions whose setting the user has changed since."""
    today = now.date()
    return LearningData(
        marks=[m for m in data.marks if before(now - ls.keep_marks, m.at)],
        mornings=[m for m in data.mornings if m.day > today - ls.keep_mornings],
        pending=[p for p in data.pending if is_fresh(settings, p)],
        resolutions=[r for r in data.resolutions if before(now - ls.keep_resolutions, r.at)],
        tallies={d: t for d, t in data.tallies.items() if d > today - ls.keep_tallies},
        heat_loss=data.heat_loss,
        heat_loss_ok=data.heat_loss_ok,
        hours={h: t for h, t in data.hours.items() if before(now - ls.keep_hours, h)},
        capacity=data.capacity,
        capacity_ok=data.capacity_ok,
        corrections=[d for d in data.corrections if d.day > today - ls.keep_mornings],
        changed={k: t for k, t in data.changed.items() if before(now - ls.keep_resolutions, t)},
    )


# The room correction as a signal: in smooth mode the PI loop covers for a curve point that is off, so the
# rooms reach their targets and the morning check stays quiet; what the correction keeps adding tells.


@dataclass(frozen=True)
class CorrectionDay:
    day: date
    band: int
    total: float  # the sum of the per-minute corrections
    minutes: int


def record_correction(
    days: Sequence[CorrectionDay],
    at: datetime,
    t_out: float,
    correction: float,
    ls: LearningSettings = LEARNING,
) -> list[CorrectionDay]:
    """Add one minute's correction to its local day and outdoor band."""
    day, band = at.date(), band_of(t_out, ls.band_step)
    out = list(days)
    for i, d in enumerate(out):
        if d.day == day and d.band == band:
            out[i] = CorrectionDay(day, band, d.total + correction, d.minutes + 1)
            return out
    return [*out, CorrectionDay(day, band, correction, 1)]


def drop_corrections(days: Sequence[CorrectionDay], bands: set[int] | None) -> list[CorrectionDay]:
    """Forget these bands (all with None): the curve there changed, or the question was answered."""
    return [] if bands is None else [d for d in days if d.band not in bands]


def correction_suggestions(
    days: Sequence[CorrectionDay],
    settings: Settings,
    resolutions: Sequence[Resolution],
    now: datetime,
    ls: LearningSettings = LEARNING,
) -> list[Suggestion]:
    """A band where the correction added (or took off) 1.5° or more on average, on 3 days in the last week."""
    first = now.date() - ls.correction_window
    counted = [d for d in days if d.day > first and d.minutes >= ls.correction_min_minutes]
    out: list[Suggestion] = []
    for band in sorted({d.band for d in counted}):
        mine = [d for d in counted if d.band == band]
        if len({d.day for d in mine}) < ls.correction_min_days:
            continue
        minutes = sum(d.minutes for d in mine)
        mean = sum(d.total for d in mine) / minutes
        if abs(mean) < ls.correction_threshold - EPS:
            continue
        up = mean > 0
        key = f"curve:{band}:{'up' if up else 'down'}"  # the morning check's key: one suggestion per point
        if is_suppressed(resolutions, key, band, now, ls):
            continue
        step = _curve_step(settings, band, up, ls)
        if step is None:
            continue
        evidence = {
            "days": len({d.day for d in mine}),
            "hours": round(minutes / 60, 1),
            "mean_correction": round(mean, 2),
        }
        out.append(
            make_suggestion(
                key, "curve", f"curve.points.{band}", *step, band=band, room=None, now=now, evidence=evidence
            )
        )
    return out
