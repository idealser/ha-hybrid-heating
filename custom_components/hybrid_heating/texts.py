"""Human-readable reasons and the status line, in English and Russian. No Home Assistant imports here."""

import math
from collections.abc import Mapping
from typing import Any

from .core.types import Decision, Layer, Preset, Reason

LANGS = ("en", "ru")
STATUS_MAX = 255


def _t(en: str, ru: str) -> Mapping[str, str]:
    return {"en": en, "ru": ru}


TEXTS: Mapping[str, Mapping[str, str]] = {
    # Boiler
    # {gap}: how far the room the boiler follows is from its own target. The "driver" itself is a reading
    # less its room offset, which is not a temperature any room shows.
    # {position}: "0.3° below target 23.0°", "0.3° above target 23.0°" or "at target 23.0°". The PI loop keeps
    # the boiler on up to the overheat margin above the target, so either side is normal here.
    "smooth_on": _t(
        "Boiler on: {position}, flow {flow}° (correction {correction}°)",
        "Котёл включён: {position}, подача {flow}° (поправка {correction}°)",
    ),
    "smooth_overheat_wait": _t(
        "Boiler on, {gap}° above target {target}°: waiting before a pause; flow {flow}°",
        "Котёл включён, на {gap}° выше цели {target}°: ждём перед паузой; подача {flow}°",
    ),
    "smooth_paused": _t(
        "Boiler paused: {gap}° above target {target}°",
        "Котёл на паузе: на {gap}° выше цели {target}°",
    ),
    "smooth_resumed": _t(
        "Boiler resumed: {position}, flow {flow}°", "Котёл снова греет: {position}, подача {flow}°"
    ),
    "classic_on_avg": _t(
        "Boiler on: rooms on average below target {target}°, flow {flow}°",
        "Котёл включён: в среднем по комнатам ниже цели {target}°, подача {flow}°",
    ),
    "classic_on_coldest": _t(
        "Boiler on: the coldest room is below target {target}°, flow {flow}°",
        "Котёл включён: самая холодная комната ниже цели {target}°, подача {flow}°",
    ),
    "classic_off": _t("Boiler off: rooms at target {target}°", "Котёл выключен: комнаты на цели {target}°"),
    "season_idle": _t("Boiler off: outside the heating season", "Котёл выключен: не отопительный сезон"),
    "zone_boiler_off": _t("Boiler off in the {zone} zone", "Котёл выключен в зоне «{zone}»"),
    # Learning
    "heat_loss_estimated": _t(
        "Heat loss estimated: {w_per_k} W/K from {days_used} days",
        "Теплопотери оценены: {w_per_k} Вт/К по {days_used} дням",
    ),
    "heat_loss_insufficient": _t(
        "Heat loss: {days_used} of {min_days} usable days so far (whole days in season without the ACs); "
        "estimates keep the default",
        "Теплопотери: пока {days_used} из {min_days} подходящих дней (целые дни сезона без кондиционеров); "
        "оценки по умолчанию",
    ),
    "heat_loss_implausible": _t(
        "Heat loss estimate {w_per_k} W/K looks wrong; estimates keep the default",
        "Оценка теплопотерь {w_per_k} Вт/К выглядит неверной; оценки по умолчанию",
    ),
    "capacity_estimated": _t(
        "Heat capacity estimated: {kwh_per_k} kWh/K from {hours_used} hours",
        "Теплоёмкость оценена: {kwh_per_k} кВт·ч/К по {hours_used} ч",
    ),
    "capacity_insufficient": _t(
        "Heat capacity: {hours_used} of {min_hours} usable hours so far (nothing heating, the flat cooling); "
        "the forecast keeps its value",
        "Теплоёмкость: пока {hours_used} из {min_hours} подходящих часов "
        "(ничего не греет, квартира остывает); прогноз с прежним значением",
    ),
    "capacity_implausible": _t(
        "Heat capacity estimate {kwh_per_k} kWh/K looks wrong; the forecast keeps its value",
        "Оценка теплоёмкости {kwh_per_k} кВт·ч/К выглядит неверной; прогноз с прежним значением",
    ),
    "suggestion_created": _t(
        "New suggestion: {setting} from {old}° to {new}°", "Новая подсказка: {setting} с {old}° на {new}°"
    ),
    "suggestion_applied": _t(
        "Suggestion applied: {setting} from {old}° to {new}°",
        "Подсказка применена: {setting} с {old}° на {new}°",
    ),
    "suggestion_dismissed": _t("Suggestion dismissed: {setting}", "Подсказка отклонена: {setting}"),
    "suggestion_stale": _t(
        "Suggestion withdrawn: {setting} was changed meanwhile",
        "Подсказка снята: настройку «{setting}» уже изменили",
    ),
    "feedback_marked": _t("{room} marked too {mark}", "{room}: отметка «{mark}»"),
    # Air conditioners
    "ac_started": _t(
        "{room}: AC started, setpoint {setpoint}°", "{room}: кондиционер включён, уставка {setpoint}°"
    ),
    "ac_step_up": _t(
        "{room}: AC setpoint up to {setpoint}°, room {error}° off target",
        "{room}: уставка кондиционера повышена до {setpoint}°, отклонение комнаты {error}°",
    ),
    "ac_step_down": _t(
        "{room}: AC setpoint down to {setpoint}°, room {error}° off target",
        "{room}: уставка кондиционера понижена до {setpoint}°, отклонение комнаты {error}°",
    ),
    "ac_stopped": _t(
        "{room}: AC stopped, not used now", "{room}: кондиционер выключен, сейчас не используется"
    ),
    "ac_not_coping": _t(
        "{room}: AC is not keeping up, room {error}° off target",
        "{room}: кондиционер не справляется, отклонение комнаты {error}°",
    ),
    "ac_unavailable": _t("{room}: AC unavailable", "{room}: кондиционер недоступен"),
    "ac_manual_left_alone": _t(
        "{room}: AC is run by hand, left alone", "{room}: кондиционером управляют вручную, не трогаем"
    ),
    "ac_manual_off": _t(
        "{room}: AC switched off by hand, stays off until the preset changes",
        "{room}: кондиционер выключили вручную, не включаем до смены режима",
    ),
    "ac_manual_hold": _t(
        "{room}: AC stays off after a manual switch-off",
        "{room}: кондиционер остаётся выключенным после ручного выключения",
    ),
    "ac_quiet_on": _t("{room}: AC quiet mode on", "{room}: тихий режим кондиционера включён"),
    "ac_quiet_off": _t("{room}: AC quiet mode off", "{room}: тихий режим кондиционера выключен"),
    # Load
    "pause_boiler": _t("Load above limit: boiler paused", "Нагрузка выше лимита: котёл на паузе"),
    "shed_water_heater": _t(
        "Load above limit: water heater switched off", "Нагрузка выше лимита: бойлер выключен"
    ),
    "shed_rod": _t("Load above limit: one heating rod less", "Нагрузка выше лимита: на один ТЭН меньше"),
    "restore_rod": _t("Load back to normal: one heating rod more", "Нагрузка в норме: на один ТЭН больше"),
    "restore_water_heater": _t(
        "Load back to normal: water heater switched on", "Нагрузка в норме: бойлер включён"
    ),
    "load_unknown": _t(
        "Load unknown: the power meter is unavailable", "Нагрузка неизвестна: счётчик недоступен"
    ),
    "rods_budget_exhausted": _t(
        "Load above limit: no boiler writes left today to lower the rods",
        "Нагрузка выше лимита: на сегодня не осталось записей в котёл, ТЭНы не снижены",
    ),
    # Season and data
    "season_started": _t(
        "Heating season started: mean {mean}°", "Отопительный сезон начался: среднее {mean}°"
    ),
    "season_ended": _t(
        "Heating season ended: mean {mean}°", "Отопительный сезон закончился: среднее {mean}°"
    ),
    "outdoor_unavailable": _t(
        "Outdoor temperature unavailable: using the last value or a fixed flow",
        "Уличная температура недоступна: берём последнее значение или фиксированную подачу",
    ),
    "rooms_unavailable": _t(
        "Room temperatures unavailable: the boiler runs at a fixed flow",
        "Температуры комнат недоступны: котёл греет с фиксированной подачей",
    ),
    # System
    "thermostat_taken": _t(
        "Thermostat turned off: Hybrid Heating drives the boiler",
        "Термостат выключен: котлом управляет Hybrid Heating",
    ),
    "thermostat_restored": _t(
        "Thermostat given back with its previous settings",
        "Термостату возвращено управление с прежними настройками",
    ),
    "thermostat_user_override": _t(
        "Thermostat switched on by hand: the boiler is handed back to it",
        "Термостат включили вручную: котёл возвращён ему",
    ),
    "thermostat_reasserted": _t(
        "Thermostat was on after a restart: switched off again, Hybrid Heating drives the boiler",
        "Термостат после перезапуска был включён: снова выключен, котлом управляет Hybrid Heating",
    ),
    "automation_disabled": _t(
        "Overpower automation turned off while the Load layer is active",
        "Автоматизация от перегрузки выключена, пока слой нагрузки активен",
    ),
    "automation_restored": _t(
        "Overpower automation turned back on", "Автоматизация от перегрузки снова включена"
    ),
    "automation_user_override": _t(
        "Overpower automation switched on by hand: left on",
        "Автоматизацию от перегрузки включили вручную: оставляем включённой",
    ),
    "automation_still_enabled": _t(
        "Overpower automation is still on: both protections are active",
        "Автоматизация от перегрузки всё ещё включена: работают обе защиты",
    ),
    "boiler_settings_restored": _t(
        "Boiler flow setpoint and rods restored", "Уставка подачи и ТЭНы котла восстановлены"
    ),
    "water_heater_restored": _t("Water heater switched back on", "Бойлер снова включён"),
    "acs_released": _t("Air conditioners released: {rooms}", "Кондиционеры отпущены: {rooms}"),
    "tick_failed": _t("Control cycle failed: {error}", "Сбой такта управления: {error}"),
    "failsafe_released": _t(
        "Too many failed cycles: Hybrid Heating switched off and gave control back",
        "Слишком много сбоев подряд: Hybrid Heating выключен и вернул управление",
    ),
    "settings_changed": _t("Settings changed: {keys}", "Настройки изменены: {keys}"),
    "module_enabled": _t("Hybrid Heating enabled", "Hybrid Heating включён"),
    "module_disabled": _t(
        "Hybrid Heating disabled: control given back", "Hybrid Heating выключен: управление возвращено"
    ),
    "restored_after_restart": _t(
        "State restored after a restart (saved {saved_at})",
        "Состояние восстановлено после перезапуска (сохранено {saved_at})",
    ),
    "setup_failed_released": _t(
        "Start-up failed: control given back until the next attempt",
        "Запуск не удался: управление возвращено до следующей попытки",
    ),
    "store_section_reset": _t(
        "Could not read the saved {section}: reset to defaults",
        "Не удалось прочитать сохранённое ({section}): сброшено",
    ),
}

ZONE_KEYS = ("warm", "cool", "frost", "severe_frost")
ZONE_NAMES: Mapping[str, Mapping[str, str]] = {
    "en": {"warm": "Warm", "cool": "Cool", "frost": "Frost", "severe_frost": "Severe frost"},
    "ru": {"warm": "Тепло", "cool": "Прохладно", "frost": "Мороз", "severe_frost": "Сильный мороз"},
}
PRESET_NAMES: Mapping[str, Mapping[Preset, str]] = {
    "en": {Preset.COMFORT: "Comfort", Preset.ECO: "Eco", Preset.NIGHT: "Night", Preset.AWAY: "Away"},
    "ru": {Preset.COMFORT: "Комфорт", Preset.ECO: "Эко", Preset.NIGHT: "Ночь", Preset.AWAY: "Отъезд"},
}
ROOM_NAMES: Mapping[str, Mapping[str, str]] = {
    "en": {"living": "Living room", "bedroom": "Bedroom", "child": "Child's room", "bath": "Bathroom"},
    "ru": {"living": "Гостиная", "bedroom": "Спальня", "child": "Детская", "bath": "Ванная"},
}
ROOMS_LOW: Mapping[str, Mapping[str, str]] = {
    "en": {"living": "living room", "bedroom": "bedroom", "child": "child's room", "bath": "bathroom"},
    "ru": {"living": "гостиная", "bedroom": "спальня", "child": "детская", "bath": "ванная"},
}
OBSERVE_SUFFIX: Mapping[str, str] = {"en": " (observe only)", "ru": " (только наблюдение)"}
POSITION: Mapping[str, Mapping[str, str]] = {
    "en": {
        "below": "{gap}° below target {target}°",
        "above": "{gap}° above target {target}°",
        "at": "at target {target}°",
    },
    "ru": {
        "below": "на {gap}° ниже цели {target}°",
        "above": "на {gap}° выше цели {target}°",
        "at": "на цели {target}°",
    },
}
SETTING_GROUPS: Mapping[str, Mapping[str, str]] = {
    "en": {
        "hybrid": "hybrid mode",
        "preset": "preset",
        "targets": "targets",
        "curve": "curve",
        "zones": "zones",
        "boiler": "boiler",
        "ac": "ACs",
        "load": "load limit",
        "season": "season",
        "layers": "layer modes",
        "room_offsets": "room targets",
        "sensor_offsets": "sensor corrections",
        "outdoor_stale_after_s": "outdoor timeout",
    },
    "ru": {
        "hybrid": "гибридный режим",
        "preset": "пресет",
        "targets": "цели",
        "curve": "кривая",
        "zones": "зоны",
        "boiler": "котёл",
        "ac": "кондиционеры",
        "load": "лимит нагрузки",
        "season": "сезон",
        "layers": "режимы слоёв",
        "room_offsets": "цели комнат",
        "sensor_offsets": "поправки датчиков",
        "outdoor_stale_after_s": "тайм-аут уличного датчика",
    },
}
STORE_SECTIONS: Mapping[str, Mapping[str, str]] = {
    "en": {
        "enabled": "on/off switch",
        "settings": "settings",
        "controller": "controller state",
        "takeover": "takeover state",
        "window": "outdoor average",
        "failures": "failure count",
        "learning": "learning data",
    },
    "ru": {
        "enabled": "вкл/выкл",
        "settings": "настройки",
        "controller": "состояние регулятора",
        "takeover": "что модуль взял на себя",
        "window": "средняя уличная температура",
        "failures": "счётчик сбоев",
        "learning": "данные обучения",
    },
}
MARK_NAMES: Mapping[str, Mapping[str, str]] = {
    "en": {"cold": "cold", "hot": "hot"},
    "ru": {"cold": "холодно", "hot": "жарко"},
}
SIGNED_KEYS = frozenset({"correction", "error"})
ALERTS: Mapping[str, Mapping[str, str]] = {
    "unreachable": _t(
        "{entities} did not respond ({detail}). Hybrid Heating keeps trying; please check the device.",
        "{entities} не ответил ({detail}). Hybrid Heating продолжает попытки; проверьте устройство.",
    ),
    "failsafe": _t(
        "Hybrid Heating failed several cycles in a row, switched itself off and gave control back. "
        "Download the diagnostics and switch it on again when the cause is fixed.",
        "Hybrid Heating несколько раз подряд не смог выполнить такт, выключился и вернул управление. "
        "Скачайте диагностику и включите его снова, когда причина устранена.",
    ),
    "giveback": _t(
        "Hybrid Heating was removed while it could not give everything back. Please restore by hand: {items}",
        "Hybrid Heating удалён, но не смог всё вернуть. Восстановите вручную: {items}",
    ),
}
_STATUS: Mapping[str, Mapping[str, str]] = {
    "en": {"disabled": "Disabled", "starting": "Starting", "observe": "Observe"},
    "ru": {"disabled": "Выключено", "starting": "Запуск", "observe": "Наблюдение"},
}


def lang_for(language: str | None) -> str:
    return "ru" if language and language.lower().startswith("ru") else "en"


def _number(value: float, lang: str, signed: bool) -> str:
    if isinstance(value, float):
        if not math.isfinite(value):
            return "?"
        text = f"{value:+.1f}" if signed else f"{value:.1f}"
    else:
        text = f"{value:+d}" if signed else str(value)
    return text.replace(".", ",") if lang == "ru" else text


def zone_key(zone: int) -> str | None:
    return ZONE_KEYS[zone] if 0 <= zone < len(ZONE_KEYS) else None


def zone_name(zone: int, lang: str) -> str:
    key = zone_key(zone)
    return ZONE_NAMES[lang][key] if key is not None else str(zone)


def render_alert(key: str, lang: str, **values: str) -> str:
    return ALERTS[key][lang if lang in LANGS else "en"].format(**values)


def setting_name(setting: str, lang: str) -> str:
    """What a suggestion changes, in words: "the +5° curve point", "поправка цели (детская)"."""
    head, _, tail = setting.rpartition(".")
    if head == "curve.points":
        t = round(float(tail))
        point = f"{'+' if t > 0 else '−' if t < 0 else ''}{abs(t)}°"
        return f"the {point} curve point" if lang == "en" else f"точка кривой {point}"
    if setting == "curve.shift":
        return "the whole curve" if lang == "en" else "вся кривая"
    if head == "room_offsets":
        room = ROOMS_LOW[lang].get(tail, tail)
        return f"the {room} target offset" if lang == "en" else f"поправка цели ({room})"
    return setting


def _value(key: str, value: Any, lang: str) -> str:
    if key == "setting" and isinstance(value, str):
        return setting_name(value, lang)
    if key == "mark" and isinstance(value, str):
        return MARK_NAMES[lang].get(value, value)
    if key == "room" and isinstance(value, str):
        return ROOM_NAMES[lang].get(value, value)
    if key == "keys" and isinstance(value, str):
        return ", ".join(SETTING_GROUPS[lang].get(k, k) for k in value.split(",") if k)
    if key == "section" and isinstance(value, str):
        return STORE_SECTIONS[lang].get(value, value)
    if key == "saved_at" and isinstance(value, str) and len(value) >= 16:
        return f"{value[:10]} {value[11:16]}"  # the local time it was saved, as written
    if key == "rooms" and isinstance(value, str):
        return ", ".join(ROOM_NAMES[lang].get(r, r) for r in value.split(",") if r)
    if key == "zone" and isinstance(value, int) and not isinstance(value, bool):
        return zone_name(value, lang)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return _number(value, lang, key in SIGNED_KEYS)
    return str(value)


class _Fields(dict[str, str]):
    def __missing__(self, key: str) -> str:
        return "?"


def render_reason(reason: Reason, lang: str, *, observe_suffix: bool = True) -> str:
    lang = lang if lang in LANGS else "en"
    data = {k: v for k, v in reason.data.items() if k != "observe"}
    driver, target = data.get("driver"), data.get("target")
    if isinstance(driver, (int, float)) and isinstance(target, (int, float)):
        gap = round(abs(target - driver), 1)
        data["gap"] = gap
        side = "at" if gap < 0.05 else "below" if driver < target else "above"
        data["position"] = POSITION[lang][side].format(
            gap=_number(gap, lang, False), target=_number(target, lang, False)
        )
    template = TEXTS.get(reason.code, {}).get(lang)
    if template is None:
        details = ", ".join(f"{k}={_value(k, v, lang)}" for k, v in data.items())
        text = f"{reason.code} ({details})" if details else reason.code
    else:
        text = template.format_map(_Fields({k: _value(k, v, lang) for k, v in data.items()}))
    if observe_suffix and reason.data.get("observe"):
        text += OBSERVE_SUFFIX[lang]
    return text


def _truncate(text: str) -> str:
    return text if len(text) <= STATUS_MAX else text[: STATUS_MAX - 1] + "…"


def render_status(
    decision: Decision | None,
    lang: str,
    *,
    enabled: bool,
    starting: bool,
    boiler_observe: bool,
    load_pause: bool = False,
) -> str:
    """One line for the status sensor: zone, preset and target, then what the boiler is doing."""
    lang = lang if lang in LANGS else "en"
    words = _STATUS[lang]
    if not enabled:
        return words["disabled"]
    if starting or decision is None:
        return words["starting"]
    parts = [words["observe"]] if boiler_observe else []
    parts.append(zone_name(decision.zone, lang))
    parts.append(f"{PRESET_NAMES[lang][decision.preset]} {_number(decision.target, lang, False)}°")
    main = next((r for r in decision.reasons if r.layer in (Layer.BOILER, "season")), None)
    if load_pause:  # the boiler's own reason still says "on" while the load holds the call off
        main = Reason(Layer.LOAD, "pause_boiler")
    if main is not None:
        parts.append(render_reason(main, lang, observe_suffix=False))
    return _truncate(" · ".join(parts))
