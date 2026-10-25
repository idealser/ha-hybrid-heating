from dataclasses import replace
from datetime import datetime

import pytest

from custom_components.hybrid_heating.core.learning import curve_suggestion, feedback_suggestion
from custom_components.hybrid_heating.core.model import HeatLossEstimate
from custom_components.hybrid_heating.core.types import Room, Settings
from custom_components.hybrid_heating.suggestion_texts import heat_loss_view, suggestion_view
from tests.conftest import TZ
from tests.core.test_learning import COLD3, D1, D2, D3, NOW, NOWF, ms, two


def curve_up():
    sg = curve_suggestion(COLD3, Settings(), [], NOW)
    assert sg is not None
    return sg


def test_a_curve_suggestion_says_what_it_saw():
    v = suggestion_view(curve_up(), "new", "en")
    assert v == {
        "id": "curve:5:up@2026-11-12T09:00+01:00",
        "kind": "curve",
        "state": "new",
        "created": "2026-11-12T09:00:00+01:00",
        "title": "Raise the +5° point from 44.5° to 46°",
        "detail": "On the last three mornings at +4.1…+6.8° the room the boiler follows stayed 0.6° below "
        "its target on average, with the flow on the curve. A higher point warms it up in time.",
    }
    ru = suggestion_view(curve_up(), "applied", "ru")
    assert (ru["state"], ru["title"]) == ("applied", "Поднять точку +5° с 44,5° до 46°")
    assert ru["detail"].startswith("Три последних утра при +4,1…+6,8° комната, за которой следит котёл,")


def test_a_lower_curve_point():
    warm = [ms(D1, -1.5, 0.6), ms(D2, 0.5, 0.5), ms(D3, 2.0, 0.8)]
    sg = curve_suggestion(warm, Settings(), [], NOW)
    assert sg is not None
    v = suggestion_view(sg, "new", "en")
    assert v["title"] == "Lower the 0° point from 49.5° to 48°"
    assert "−1.5…+2° the room the boiler follows stayed 0.6° above its target" in v["detail"]


@pytest.mark.parametrize(
    ("room", "kind", "en_title", "ru_title"),
    [
        (Room.CHILD, "cold", "Child's room: raise its target by 0.3°", "Детская: поднять цель на 0,3°"),
        (Room.LIVING, "hot", "Living room: lower its target by 0.3°", "Гостиная: снизить цель на 0,3°"),
        (Room.BATH, "cold", "Bathroom: raise the whole curve by 1°", "Ванная: поднять всю кривую на 1°"),
        (Room.BATH, "hot", "Bathroom: lower the whole curve by 1°", "Ванная: опустить всю кривую на 1°"),
    ],
)
def test_room_suggestion_titles(room, kind, en_title, ru_title):
    sg = feedback_suggestion(two(room, kind), room, kind, Settings(), [], NOWF)
    assert sg is not None
    assert suggestion_view(sg, "new", "en")["title"] == en_title
    assert suggestion_view(sg, "new", "ru")["title"] == ru_title


def test_room_suggestion_details():
    child = feedback_suggestion(two(Room.CHILD, "cold"), Room.CHILD, "cold", Settings(), [], NOWF)
    assert child is not None
    assert suggestion_view(child, "new", "en")["detail"] == (
        "You marked it cold 2 times in 7 days (last at 22.1°, outside +6.2°). "
        "Its target becomes the preset −0.7° (now −1°)."
    )
    assert suggestion_view(child, "new", "ru")["detail"] == (
        "Вы отметили «холодно» 2 раза за 7 дней (последний раз 22,1°, на улице +6,2°). "
        "Цель станет: пресет −0,7° (сейчас −1°)."
    )
    bath = feedback_suggestion(two(Room.BATH, "cold"), Room.BATH, "cold", Settings(), [], NOWF)
    assert bath is not None
    assert suggestion_view(bath, "new", "en")["detail"] == (
        "You marked it cold 2 times in 7 days (last at 22.1°, outside +6.2°). "
        "The module steers no heater by the bathroom's sensor, so a warmer flow is the way: "
        "the whole curve moves from 0° to +1°."
    )
    no_readings = replace(child, evidence={"marks": 3})
    assert suggestion_view(no_readings, "new", "en")["detail"].startswith(
        "You marked it cold 3 times in 7 days. "
    )


def test_heat_loss_items():
    at = datetime(2026, 11, 9, 4, 30, tzinfo=TZ)
    ok = heat_loss_view(
        HeatLossEstimate("ok", 148.0, 310.0, 0.93, 9, 28, at), "en", used=148.0, default=150.0
    )
    assert ok == {
        "id": "heat_loss@2026-11-09T04:30+01:00",
        "kind": "heat_loss",
        "state": "info",
        "created": "2026-11-09T04:30:00+01:00",
        "title": "Heat loss this week: 148 W/K",
        "detail": "From 9 whole heating days without the ACs. The forecast and the estimates use it instead "
        "of the default 150 W/K; it does not change how the module heats.",
    }
    short_estimate = HeatLossEstimate("insufficient_data", None, None, None, 3, 28, at)
    short = heat_loss_view(short_estimate, "ru", used=150.0, default=150.0)
    assert short["title"] == "Теплопотери: пока мало данных"
    assert short["detail"] == (
        "Нужно 5 целых дней отопления без кондиционеров за 4 недели, пока 3. Оценки берут 150 Вт/К."
    )
    odd = heat_loss_view(
        HeatLossEstimate("implausible", 20.0, -400.0, 0.5, 6, 28, at), "en", used=150.0, default=150.0
    )
    assert odd["title"] == "Heat loss estimate looks wrong: 20 W/K"
    assert odd["detail"].startswith("Estimates keep 150 W/K.")


def test_texts_are_given_in_english_for_unknown_languages():
    assert suggestion_view(curve_up(), "new", "de")["title"] == "Raise the +5° point from 44.5° to 46°"


@pytest.mark.parametrize(
    ("n", "ru"), [(2, "2 раза"), (4, "4 раза"), (5, "5 раз"), (12, "12 раз"), (22, "22 раза")]
)
def test_russian_counts(n, ru):
    sg = feedback_suggestion(two(Room.CHILD, "cold"), Room.CHILD, "cold", Settings(), [], NOWF)
    assert sg is not None
    assert (
        f"«холодно» {ru} за 7 дней"
        in suggestion_view(replace(sg, evidence={"marks": n}), "new", "ru")["detail"]
    )


def test_a_short_week_names_the_value_still_in_use():
    at = datetime(2026, 11, 9, 4, 30, tzinfo=TZ)
    short = HeatLossEstimate("insufficient_data", None, None, None, 3, 28, at)
    assert heat_loss_view(short, "en", used=148.0, default=150.0)["detail"].endswith("Estimates use 148 W/K.")


def test_a_correction_suggestion_says_what_the_correction_did():
    from custom_components.hybrid_heating.core.learning import CorrectionDay, correction_suggestions

    days = [
        CorrectionDay(D1, 5, 2.0 * 120, 120),
        CorrectionDay(D2, 5, 2.0 * 120, 120),
        CorrectionDay(D3, 5, 2.0 * 120, 120),
    ]
    (sg,) = correction_suggestions(days, Settings(), [], NOW)
    en = suggestion_view(sg, "new", "en")
    assert en["title"] == "Raise the +5° point from 44.5° to 46°"
    assert en["detail"] == (
        "For 6 h over 3 days in this weather the room correction added 2° to the curve on average to keep "
        "the rooms at their targets. Raising the point lets it react to sun and wind again."
    )
    ru = suggestion_view(sg, "new", "ru")["detail"]
    assert ru.startswith("За 3 дня (6 ч) в такую погоду поправка по комнатам в среднем добавляла к кривой 2°")  # noqa: RUF001
