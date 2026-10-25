import re
from dataclasses import replace
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as hs

from custom_components.hybrid_heating.core.controller import ControllerState, tick
from custom_components.hybrid_heating.core.types import (
    Decision,
    Layer,
    Preset,
    Reason,
    Room,
)
from custom_components.hybrid_heating.texts import (
    ALERTS,
    LANGS,
    PRESET_NAMES,
    TEXTS,
    ZONE_KEYS,
    ZONE_NAMES,
    lang_for,
    render_reason,
    render_status,
)
from tests.conftest import ALL_ACTIVE, T0, sec, snap

SMOOTH = Reason(Layer.BOILER, "smooth_on", {"driver": 22.6, "target": 23.0, "flow": 36.1, "correction": 0.8})


# Lines that emit a reason code: Reason(...), the takeover's _system(...), the AC layer's _reason(...),
# the boiler's decide functions (return <call>, "<code>"), and the coordinator's stop and release calls.
EMITTING = re.compile(
    r"Reason\(|_system\(|_reason\(|return (?:True|False), |async_stop\(|async_release_all\("
)
CODE = re.compile(r'"([a-z]+(?:_[a-z]+)+)"')


def emitted_codes() -> set[str]:
    codes: set[str] = set()
    for path in Path("custom_components/hybrid_heating").rglob("*.py"):
        for line in path.read_text(encoding="utf-8").splitlines():
            if EMITTING.search(line):
                codes |= set(CODE.findall(line))
    return codes


def test_every_emitted_code_has_en_and_ru_and_every_text_is_used():
    emitted = emitted_codes()
    assert {"smooth_on", "ac_quiet_off", "pause_boiler", "season_ended", "thermostat_taken"} <= emitted
    assert emitted == set(TEXTS)
    for code, texts in TEXTS.items():
        assert set(texts) == {"en", "ru"}, code
        for lang in LANGS:
            assert render_reason(Reason("system", code), lang)
    for key, texts in ALERTS.items():
        assert set(texts) == {"en", "ru"}, key


def test_names_per_language():
    assert ZONE_KEYS == ("warm", "cool", "frost", "severe_frost")
    assert [ZONE_NAMES["en"][k] for k in ZONE_KEYS] == ["Warm", "Cool", "Frost", "Severe frost"]
    assert [ZONE_NAMES["ru"][k] for k in ZONE_KEYS] == ["Тепло", "Прохладно", "Мороз", "Сильный мороз"]
    assert [PRESET_NAMES["en"][p] for p in Preset] == ["Comfort", "Eco", "Night", "Away"]
    assert [PRESET_NAMES["ru"][p] for p in Preset] == ["Комфорт", "Эко", "Ночь", "Отъезд"]


def test_smooth_on_exact():
    # the driver is a room reading less its room offset, so the text gives the gap, which is real
    assert render_reason(SMOOTH, "en") == "Boiler on: 0.4° below target 23.0°, flow 36.1° (correction +0.8°)"
    assert (
        render_reason(SMOOTH, "ru") == "Котёл включён: на 0,4° ниже цели 23,0°, подача 36,1° (поправка +0,8°)"
    )


def test_smooth_pause_texts_give_the_gap():
    paused = Reason(Layer.BOILER, "smooth_paused", {"driver": 23.7, "target": 23.0})
    assert render_reason(paused, "en") == "Boiler paused: 0.7° above target 23.0°"
    assert render_reason(paused, "ru") == "Котёл на паузе: на 0,7° выше цели 23,0°"
    resumed = Reason(Layer.BOILER, "smooth_resumed", {"driver": 22.9, "target": 23.0, "flow": 33.0})
    assert render_reason(resumed, "en") == "Boiler resumed: 0.1° below target 23.0°, flow 33.0°"
    wait = Reason(Layer.BOILER, "smooth_overheat_wait", {"driver": 23.6, "target": 23.0, "flow": 31.0})
    assert (
        render_reason(wait, "en") == "Boiler on, 0.6° above target 23.0°: waiting before a pause; flow 31.0°"
    )


def test_negative_correction_and_rooms():
    r = Reason(Layer.BOILER, "smooth_on", {"driver": 23.4, "target": 23.0, "flow": 31.0, "correction": -1.25})
    assert render_reason(r, "en").endswith("(correction -1.2°)")
    a = Reason(Layer.AC, "ac_started", {"room": "bedroom", "setpoint": 24})
    assert render_reason(a, "en") == "Bedroom: AC started, setpoint 24°"
    assert render_reason(a, "ru") == "Спальня: кондиционер включён, уставка 24°"
    rel = Reason("system", "acs_released", {"rooms": "living,bedroom"})
    assert render_reason(rel, "en") == "Air conditioners released: Living room, Bedroom"
    z = Reason(Layer.BOILER, "zone_boiler_off", {"zone": 0})
    assert "Warm" in render_reason(z, "en") and "Тепло" in render_reason(z, "ru")


def test_observe_suffix_and_unknown_code():
    r = Reason(Layer.LOAD, "shed_water_heater", {"observe": True})
    assert render_reason(r, "en") == "Load above limit: water heater switched off (observe only)"
    assert render_reason(r, "ru") == "Нагрузка выше лимита: бойлер выключен (только наблюдение)"
    assert render_reason(r, "en", observe_suffix=False) == "Load above limit: water heater switched off"
    assert render_reason(Reason("system", "weird", {"x": 1}), "en") == "weird (x=1)"
    assert render_reason(Reason("system", "weird"), "en") == "weird"


def test_season_texts():
    r = Reason("season", "season_started", {"mean": 13.8})
    assert render_reason(r, "en") == "Heating season started: mean 13.8°"
    assert render_reason(r, "ru") == "Отопительный сезон начался: среднее 13,8°"
    nan = Reason("season", "season_started", {"mean": float("nan")})
    assert render_reason(nan, "en") == "Heating season started: mean ?°"
    assert render_reason(Reason("season", "season_started"), "en") == "Heating season started: mean ?°"


def test_status_line():
    d = Decision(
        actions=(),
        reasons=(Reason("system", "outdoor_unavailable"), SMOOTH),
        flow_target=36.1,
        zone=0,
        target=23.0,
        preset=Preset.COMFORT,
        season_active=True,
    )
    assert render_status(d, "en", enabled=True, starting=False, boiler_observe=True) == (
        "Observe · Warm · Comfort 23.0° · Boiler on: 0.4° below target 23.0°, flow 36.1° (correction +0.8°)"
    )
    assert render_status(d, "ru", enabled=True, starting=False, boiler_observe=False).startswith(
        "Тепло · Комфорт 23,0° · Котёл включён"
    )
    observed = replace(d, reasons=(Reason(Layer.BOILER, "smooth_on", {**SMOOTH.data, "observe": True}),))
    assert not render_status(observed, "en", enabled=True, starting=False, boiler_observe=True).endswith(
        "(observe only)"
    )
    assert render_status(None, "ru", enabled=False, starting=False, boiler_observe=True) == "Выключено"
    assert render_status(None, "en", enabled=False, starting=False, boiler_observe=True) == "Disabled"
    assert render_status(None, "en", enabled=True, starting=True, boiler_observe=True) == "Starting"
    assert render_status(None, "ru", enabled=True, starting=True, boiler_observe=True) == "Запуск"
    long = Decision(
        (), (Reason(Layer.BOILER, "weird", {"x": "y" * 400}),), None, 0, 23.0, Preset.COMFORT, True
    )
    line = render_status(long, "en", enabled=True, starting=False, boiler_observe=False)
    assert len(line) == 255 and line.endswith("…")


def test_lang_for():
    assert (lang_for("ru"), lang_for("ru-RU"), lang_for("en-GB"), lang_for(None)) == ("ru", "ru", "en", "en")


@settings(max_examples=60, deadline=None)
@given(
    hs.lists(
        hs.tuples(
            hs.one_of(hs.none(), hs.floats(-25, 25)),
            hs.one_of(hs.none(), hs.floats(15, 27)),
            hs.one_of(hs.none(), hs.floats(0, 12)),
            hs.booleans(),
        ),
        min_size=1,
        max_size=30,
    )
)
def test_codes_emitted_by_tick_have_texts(steps):
    s = ALL_ACTIVE
    state = ControllerState.initial(T0)
    for i, (t_out, room, load, flag) in enumerate(steps):
        d = tick(
            s,
            snap(
                now=T0 + sec(60 * i),
                t_out=t_out,
                rooms=dict.fromkeys(Room, room),
                load_kw=load,
                boiler_available=flag,
                water_heater_on=flag,
                ac_hvac={Room.LIVING: "heat" if flag else "off", Room.BEDROOM: "off"},
            ),
            state,
        )
        assert {r.code for r in d.reasons} <= set(TEXTS)
