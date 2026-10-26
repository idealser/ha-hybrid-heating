"""Suggestions as the card shows them: a title and a detail in English or Russian. No Home Assistant here."""

from collections.abc import Mapping
from typing import Any, Literal

from .core.learning import Suggestion
from .core.model import (
    CAPACITY_MIN_HOURS,
    CAPACITY_WINDOW_DAYS,
    HEAT_LOSS_MIN_DAYS,
    HEAT_LOSS_WINDOW_DAYS,
    CapacityEstimate,
    HeatLossEstimate,
)
from .texts import LANGS, ROOM_NAMES

type State = Literal["new", "applied", "dismissed"]


def _num(value: float, lang: str, *, signed: bool = False) -> str:
    """41 → "41", 39.5 → "39.5"; signed: "+6.2", "−1.5", "0". Russian uses a comma."""
    text = f"{abs(value):.1f}".rstrip("0").rstrip(".")
    if value < 0 and text != "0":
        text = "−" + text
    elif signed and value > 0 and text != "0":
        text = "+" + text
    return text.replace(".", ",") if lang == "ru" else text


def _t(en: str, ru: str) -> Mapping[str, str]:
    return {"en": en, "ru": ru}


CURVE = {
    "up": (
        _t("Raise the {point} point from {old}° to {new}°", "Поднять точку {point} с {old}° до {new}°"),
        _t(
            "On the last three mornings at {t_min}…{t_max}° the room the boiler follows stayed {err}° "
            "below its target on average, with the flow on the curve. A higher point warms it up in time.",
            "Три последних утра при {t_min}…{t_max}° комната, за которой следит котёл, в среднем не добирала "
            "до цели {err}°, хотя подача шла по кривой. Точка выше прогреет её вовремя.",
        ),
    ),
    "down": (
        _t("Lower the {point} point from {old}° to {new}°", "Опустить точку {point} с {old}° до {new}°"),
        _t(
            "On the last three mornings at {t_min}…{t_max}° the room the boiler follows stayed {err}° "
            "above its target on average, with the flow on the curve. "
            "A lower point saves energy without the chill.",
            "Три последних утра при {t_min}…{t_max}° комната, за которой следит котёл, в среднем была "
            "на {err}° теплее цели, хотя подача шла по кривой. Точка ниже сэкономит энергию и не выстудит.",
        ),
    ),
}
# The same titles, from what the room correction did over the week (smooth mode)
CURVE_CORRECTION = {
    "up": _t(
        "For {hours} h over {days} days in this weather the room correction added {corr}° to the curve on "
        "average to keep the rooms at their targets. Raising the point lets it react to sun and wind again.",
        "За {days} {days_word} ({hours} ч) в такую погоду поправка по комнатам "  # noqa: RUF001
        "в среднем добавляла к кривой {corr}°, чтобы держать цели. "
        "Если поднять точку, поправка снова сможет реагировать на солнце и ветер.",
    ),
    "down": _t(
        "For {hours} h over {days} days in this weather the room correction took {corr}° off the curve on "
        "average to keep the rooms at their targets. Lowering the point lets it react to sun and wind again.",
        "За {days} {days_word} ({hours} ч) в такую погоду поправка по комнатам "  # noqa: RUF001
        "в среднем убавляла от кривой {corr}°, чтобы держать цели. "
        "Если опустить точку, поправка снова сможет реагировать на солнце и ветер.",
    ),
}
ROOM_TITLES = {
    ("offset", "cold"): _t("{room}: raise its target by {by}°", "{room}: поднять цель на {by}°"),
    ("offset", "hot"): _t("{room}: lower its target by {by}°", "{room}: снизить цель на {by}°"),
    ("curve", "cold"): _t("{room}: raise the whole curve by {by}°", "{room}: поднять всю кривую на {by}°"),
    ("curve", "hot"): _t("{room}: lower the whole curve by {by}°", "{room}: опустить всю кривую на {by}°"),
}
MARKED = _t("You marked it {mark} {n} {times} in 7 days", "Вы отметили «{mark}» {n} {times} за 7 дней")
LAST = _t(" (last at {room_temp}°, outside {t_out}°)", " (последний раз {room_temp}°, на улице {t_out}°)")
LAST_ROOM = _t(" (last at {room_temp}°)", " (последний раз {room_temp}°)")
MARKS = {"en": {"cold": "cold", "hot": "hot"}, "ru": {"cold": "холодно", "hot": "жарко"}}
ROOM_EFFECT = {
    "offset": _t(
        "Its target becomes the preset {new}° (now {old}°).", "Цель станет: пресет {new}° (сейчас {old}°)."
    ),
    "curve": _t(
        "The module steers no heater by the bathroom's sensor, so a warmer flow is the way: "
        "the whole curve moves from {old}° to {new}°.",
        "Модуль не управляет прибором по датчику ванной, поэтому поможет подача теплее: "
        "вся кривая сдвинется с {old}° на {new}°.",
    ),
}
HEAT_LOSS = {
    "ok": (
        _t("Heat loss this week: {w} W/K", "Теплопотери за неделю: {w} Вт/К"),
        _t(
            "From {days} whole heating days without the ACs. The forecast and the estimates use it "
            "instead of the default {default} W/K; it does not change how the module heats.",
            "По {days} целым дням отопления без кондиционеров. Прогноз и оценки берут это значение вместо "
            "{default} Вт/К по умолчанию; на управление оно не влияет.",
        ),
    ),
    "insufficient_data": (
        _t("Heat loss: not enough data yet", "Теплопотери: пока мало данных"),
        _t(
            "It needs {min} whole heating days without the ACs in {weeks} weeks; {days} so far. "
            "Estimates use {used} W/K.",
            "Нужно {min} целых дней отопления без кондиционеров за {weeks} недели, пока {days}. "
            "Оценки берут {used} Вт/К.",
        ),
    ),
    "implausible": (
        _t("Heat loss estimate looks wrong: {w} W/K", "Оценка теплопотерь выглядит неверной: {w} Вт/К"),
        _t(
            "Estimates keep {used} W/K. This happens when the days were too alike or a sensor was off.",
            "Оценки по-прежнему берут {used} Вт/К. "
            "Так бывает, если дни были слишком похожи или сбоил датчик.",
        ),
    ),
}

CAPACITY = {
    "ok": (
        _t("Heat capacity: {c} kWh/K", "Теплоёмкость: {c} кВт·ч/К"),
        _t(
            "From {hours} hours with nothing heating, in which the flat cooled by {cooled}°. The forecast "
            "uses it instead of the default {default} kWh/K for how fast the flat cools and warms up; "
            "it does not change how the module heats.",
            "По {hours} ч без отопления, за которые квартира остыла на {cooled}°. Прогноз берёт это "
            "значение вместо {default} кВт·ч/К по умолчанию: от него зависит, как быстро квартира остывает "
            "и прогревается. На управление оно не влияет.",
        ),
    ),
    "insufficient_data": (
        _t("Heat capacity: not enough data yet", "Теплоёмкость: пока мало данных"),
        _t(
            "It needs {min} hours with nothing heating in {weeks} weeks, with the flat cooling by 1° or "
            "more; {hours} so far. The forecast uses {used} kWh/K.",
            "Нужно {min} ч без отопления за {weeks} недели, и чтобы квартира остыла хотя бы на 1°, "
            "пока {hours} ч. Прогноз берёт {used} кВт·ч/К.",
        ),
    ),
    "implausible": (
        _t(
            "Heat capacity estimate looks wrong: {c} kWh/K",
            "Оценка теплоёмкости выглядит неверной: {c} кВт·ч/К",
        ),
        _t(
            "The forecast keeps {used} kWh/K. This happens when a window stayed open or the sun warmed "
            "the flat a lot.",
            "Прогноз по-прежнему берёт {used} кВт·ч/К. "
            "Так бывает, если было открыто окно или квартиру сильно грело солнце.",
        ),
    ),
}


def _times(n: int, lang: str) -> str:
    if lang == "en":
        return "time" if n == 1 else "times"
    return "раза" if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14) else "раз"


def _lang(lang: str) -> str:
    return lang if lang in LANGS else "en"


def _days(n: int, lang: str) -> str:
    if lang == "en":
        return "day" if n == 1 else "days"
    if n % 10 == 1 and n % 100 != 11:
        return "день"
    return "дня" if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14) else "дней"


def _curve_texts(sg: Suggestion, lang: str) -> tuple[str, str]:
    direction = "up" if sg.new > sg.old else "down"
    title, detail = CURVE[direction]
    ev = sg.evidence
    point = _num(float(sg.band or 0), lang, signed=True) + "°"
    heading = title[lang].format(point=point, old=_num(sg.old, lang), new=_num(sg.new, lang))
    if "mean_correction" in ev:  # from the room correction, not from mornings short of the target
        days = int(ev.get("days", 0))
        return heading, CURVE_CORRECTION[direction][lang].format(
            hours=_num(float(ev.get("hours", 0)), lang),
            days=days,
            days_word=_days(days, lang),
            corr=_num(abs(float(ev["mean_correction"])), lang),
        )
    return (
        heading,
        detail[lang].format(
            t_min=_num(float(ev.get("t_min", 0)), lang, signed=True),
            t_max=_num(float(ev.get("t_max", 0)), lang, signed=True),
            err=_num(round(abs(float(ev.get("mean_error", 0))), 1), lang),
        ),
    )


def _room_texts(sg: Suggestion, lang: str) -> tuple[str, str]:
    room = sg.room.value if sg.room is not None else "?"
    lever = "curve" if sg.setting == "curve.shift" else "offset"
    mark = "cold" if sg.new > sg.old else "hot"
    title = ROOM_TITLES[(lever, mark)][lang].format(
        room=ROOM_NAMES[lang].get(room, room), by=_num(round(abs(sg.new - sg.old), 1), lang)
    )
    ev = sg.evidence
    n = int(ev.get("marks", 0))
    detail = MARKED[lang].format(mark=MARKS[lang][mark], n=n, times=_times(n, lang))
    if "room_temp" in ev and "t_out" in ev:
        t_in, t_out = _num(float(ev["room_temp"]), lang), _num(float(ev["t_out"]), lang, signed=True)
        detail += LAST[lang].format(room_temp=t_in, t_out=t_out)
    elif "room_temp" in ev:
        detail += LAST_ROOM[lang].format(room_temp=_num(float(ev["room_temp"]), lang))
    effect = ROOM_EFFECT[lever][lang].format(
        old=_num(sg.old, lang, signed=True), new=_num(sg.new, lang, signed=True)
    )
    return title, f"{detail}. {effect}"


def suggestion_view(sg: Suggestion, state: State, lang: str) -> dict[str, Any]:
    lang = _lang(lang)
    title, detail = _curve_texts(sg, lang) if sg.kind == "curve" else _room_texts(sg, lang)
    return {
        "id": sg.id,
        "kind": sg.kind,
        "state": state,
        "created": sg.created_at.isoformat(),
        "title": title,
        "detail": detail,
    }


def heat_loss_view(e: HeatLossEstimate, lang: str, *, used: float, default: float) -> dict[str, Any]:
    """The latest estimate; `used` is what estimates use now (the last good one, or the default)."""
    lang = _lang(lang)
    title, detail = HEAT_LOSS[e.status]
    values = {
        "w": _num(e.w_per_k, lang) if e.w_per_k is not None else "?",
        "days": e.days_used,
        "default": _num(default, lang),
        "used": _num(used, lang),
        "min": HEAT_LOSS_MIN_DAYS,
        "weeks": HEAT_LOSS_WINDOW_DAYS // 7,
    }
    return {
        "id": f"heat_loss@{e.computed_at.isoformat(timespec='minutes')}",
        "kind": "heat_loss",
        "state": "info",
        "created": e.computed_at.isoformat(),
        "title": title[lang].format(**values),
        "detail": detail[lang].format(**values),
    }


def capacity_view(e: CapacityEstimate, lang: str, *, used: float, default: float) -> dict[str, Any]:
    """The latest estimate; `used` is what the forecast uses now (the last good one, or the default)."""
    lang = _lang(lang)
    title, detail = CAPACITY[e.status]
    values = {
        "c": _num(e.kwh_per_k, lang) if e.kwh_per_k is not None else "?",
        "hours": e.hours_used,
        "cooled": _num(e.cooled_k, lang),
        "default": _num(default, lang),
        "used": _num(used, lang),
        "min": CAPACITY_MIN_HOURS,
        "weeks": CAPACITY_WINDOW_DAYS // 7,
    }
    return {
        "id": f"heat_capacity@{e.computed_at.isoformat(timespec='minutes')}",
        "kind": "heat_capacity",
        "state": "info",
        "created": e.computed_at.isoformat(),
        "title": title[lang].format(**values),
        "detail": detail[lang].format(**values),
    }
