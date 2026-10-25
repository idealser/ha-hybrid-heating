"""Human-readable reasons and the status line, in English and Russian. No Home Assistant imports here."""

from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any

from .core.types import Decision, Layer, Preset, Reason

LANGS = ("en", "ru")
STATUS_MAX = 255

BOILER_CODES = (
    "smooth_on",
    "smooth_overheat_wait",
    "smooth_paused",
    "smooth_resumed",
    "classic_on_avg",
    "classic_on_coldest",
    "classic_off",
    "season_idle",
    "zone_boiler_off",
)
AC_CODES = (
    "ac_started",
    "ac_step_up",
    "ac_step_down",
    "ac_stopped",
    "ac_not_coping",
    "ac_unavailable",
    "ac_manual_left_alone",
    "ac_manual_off",
    "ac_manual_hold",
    "ac_quiet_on",
    "ac_quiet_off",
)
LOAD_CODES = (
    "pause_boiler",
    "shed_water_heater",
    "shed_rod",
    "restore_rod",
    "restore_water_heater",
    "load_unknown",
    "rods_budget_exhausted",
)
SEASON_CODES = ("season_started", "season_ended", "outdoor_unavailable", "rooms_unavailable")
CORE_CODES = BOILER_CODES + AC_CODES + LOAD_CODES + SEASON_CODES

SYSTEM_CODES = (
    "thermostat_taken",
    "thermostat_restored",
    "thermostat_user_override",
    "automation_disabled",
    "automation_restored",
    "automation_user_override",
    "automation_still_enabled",
    "boiler_settings_restored",
    "water_heater_restored",
    "acs_released",
    "tick_failed",
    "failsafe_released",
    "settings_changed",
    "module_enabled",
    "module_disabled",
    "restored_after_restart",
    "store_section_reset",
)


def _t(en: str, ru: str) -> Mapping[str, str]:
    return {"en": en, "ru": ru}


TEXTS: Mapping[str, Mapping[str, str]] = {
    # Boiler
    "smooth_on": _t(
        "Boiler on: room {driver}° vs target {target}°, flow {flow}° (correction {correction}°)",
        "Котёл включён: комната {driver}° при цели {target}°, подача {flow}° (поправка {correction}°)",
    ),
    "smooth_overheat_wait": _t(
        "Boiler on, room above target: {driver}° vs {target}°, waiting before a pause; flow {flow}°",
        "Котёл включён, комната выше цели: {driver}° при {target}°, ждём перед паузой; подача {flow}°",
    ),
    "smooth_paused": _t(
        "Boiler paused: room {driver}° above target {target}°",
        "Котёл на паузе: комната {driver}° выше цели {target}°",
    ),
    "smooth_resumed": _t(
        "Boiler resumed: room {driver}° below target {target}°, flow {flow}°",
        "Котёл снова греет: комната {driver}° ниже цели {target}°, подача {flow}°",
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
    "store_section_reset": _t(
        "Saved {section} could not be read and was reset",
        "Сохранённый раздел {section} не прочитан и сброшен",
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
OBSERVE_SUFFIX: Mapping[str, str] = {"en": " (observe only)", "ru": " (только наблюдение)"}
SIGNED_KEYS = frozenset({"correction", "error"})
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


def zone_name(zone: int, lang: str) -> str:
    return ZONE_NAMES[lang][ZONE_KEYS[zone]] if 0 <= zone < len(ZONE_KEYS) else str(zone)


def _value(key: str, value: Any, lang: str) -> str:
    if key == "room" and isinstance(value, str):
        return ROOM_NAMES[lang].get(value, value)
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
    decision: Decision | None, lang: str, *, enabled: bool, starting: bool, boiler_observe: bool
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
    if main is not None:
        parts.append(render_reason(main, lang, observe_suffix=False))
    return _truncate(" · ".join(parts))
