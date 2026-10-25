"""The weekly heat-loss estimate from the recorder's daily statistics.

The harness's recorder fixture does not start under Python 3.14 (it autospecs recorder functions whose
annotations name classes imported only for type checking), so the statistics query is replaced at its
boundary, and test_the_query_matches_the_recorder_api checks the real function's parameters.
"""

import inspect
from annotationlib import Format
from datetime import date, datetime
from typing import Any
from unittest.mock import patch

import pytest
from homeassistant.components.recorder.statistics import statistics_during_period
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.hybrid_heating.core.learning import LearningData
from custom_components.hybrid_heating.core.model import DayTally, HeatLossEstimate
from tests.conftest import TZ
from tests.fakes import FAKE_MAP
from tests.integration.conftest import log_reasons, setup_integration
from tests.integration.test_card_contract import ws
from tests.integration.test_learning import saved_learning

DAYS = [date(2026, 10, d) for d in range(26, 32)]  # after the DST change, before T0 (Sunday 1 November)
QUERY = "homeassistant.components.recorder.statistics.statistics_during_period"
INSTANCE = "homeassistant.helpers.recorder.get_instance"
QUERY_PARAMS = ["hass", "start_time", "end_time", "statistic_ids", "period", "units", "types"]


def month_of_statistics() -> dict[str, list[dict[str, Any]]]:
    """Daily means as statistics_during_period returns them: boiler W = 150 W/K * dT - 300 W."""
    rows: dict[str, list[dict[str, Any]]] = {}

    def add(statistic_id: str, d: date, mean: float) -> None:
        start = datetime(d.year, d.month, d.day, tzinfo=TZ).timestamp()
        rows.setdefault(statistic_id, []).append({"start": start, "end": start + 86400, "mean": mean})

    for i, d in enumerate(DAYS):
        dt = 6 + 2 * i
        add(FAKE_MAP.boiler_power, d, 150.0 * dt - 300.0)
        add(FAKE_MAP.outdoor, d, 23.0 - dt)
        for sensor in FAKE_MAP.rooms.values():
            add(sensor, d, 23.0)
    return rows


class FakeRecorder:
    async def async_add_executor_job(self, func, *args):
        return func(*args)


@pytest.fixture
def recorder(hass):
    """A loaded recorder whose daily statistics are month_of_statistics(); yields the queries made."""
    hass.config.components.add("recorder")
    queries: list[dict[str, Any]] = []

    def query(*args):
        queries.append(dict(zip(QUERY_PARAMS, args, strict=True)))
        return month_of_statistics()

    with patch(QUERY, query), patch(INSTANCE, return_value=FakeRecorder()):
        yield queries


def tallies(ac_every_other: bool = False) -> dict[date, DayTally]:
    return {d: DayTally(1440, 600 if ac_every_other and i % 2 else 0, 1440) for i, d in enumerate(DAYS)}


def test_the_query_matches_the_recorder_api():
    params = inspect.signature(statistics_during_period, annotation_format=Format.FORWARDREF).parameters
    assert list(params) == QUERY_PARAMS


async def test_heat_loss_is_estimated_at_start_and_reaches_the_card(
    hass, fake_home, hass_storage, hass_ws_client, recorder
):
    saved_learning(hass_storage, LearningData(tallies=tallies()))
    c = (await setup_integration(hass)).runtime_data
    q = recorder[0]
    assert (q["start_time"], q["end_time"]) == (
        datetime(2026, 10, 4, 0, 0, tzinfo=TZ),
        datetime(2026, 11, 1, 0, 0, tzinfo=TZ),
    )
    assert q["statistic_ids"] == {FAKE_MAP.boiler_power, FAKE_MAP.outdoor, *FAKE_MAP.rooms.values()}
    assert (q["period"], q["units"], q["types"]) == ("day", {"power": "W", "temperature": "°C"}, {"mean"})
    hl = c.learning.data.heat_loss
    assert hl is not None and (hl.status, hl.days_used, hl.window_days) == ("ok", 6, 28)
    assert hl.w_per_k == pytest.approx(150.0, abs=0.1) and hl.gains_w == pytest.approx(300.0, abs=1.0)
    state = hass.states.get("sensor.hybrid_heating_heat_loss")
    assert float(state.state) == pytest.approx(150.0, abs=0.1)
    attrs = state.attributes
    assert (attrs["source"], attrs["status"], attrs["days_used"]) == ("estimate", "ok", 6)
    config = (await ws(hass_ws_client, hass, type="hybrid_heating/get_config"))["result"]
    assert config["model"]["h_w_per_k"] == pytest.approx(150.0, abs=0.1)
    assert [r["data"]["days_used"] for r in log_reasons(c, "heat_loss_estimated")] == [6]


async def test_days_with_the_acs_heating_are_left_out(hass, fake_home, hass_storage, recorder):
    saved_learning(hass_storage, LearningData(tallies=tallies(ac_every_other=True)))
    c = (await setup_integration(hass)).runtime_data
    hl = c.learning.data.heat_loss
    assert hl is not None and (hl.status, hl.days_used) == ("insufficient_data", 3)
    assert float(hass.states.get("sensor.hybrid_heating_heat_loss").state) == 150.0  # the model's default
    assert [r["data"] for r in log_reasons(c, "heat_loss_insufficient")] == [{"days_used": 3, "min_days": 5}]


async def test_a_fresh_estimate_waits_for_monday(hass, fake_home, hass_storage, freezer, recorder):
    old = HeatLossEstimate("ok", 140.0, 250.0, 0.9, 7, 28, datetime(2026, 10, 30, 4, 30, tzinfo=TZ))
    saved_learning(hass_storage, LearningData(tallies=tallies(), heat_loss=old))
    c = (await setup_integration(hass)).runtime_data  # Sunday 15:00
    assert c.learning.data.heat_loss == old and recorder == []
    freezer.move_to(datetime(2026, 11, 2, 4, 30, tzinfo=TZ))  # Monday
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    hl = c.learning.data.heat_loss
    assert hl is not None and hl.computed_at == datetime(2026, 11, 2, 4, 30, tzinfo=TZ)
    assert hl.w_per_k == pytest.approx(150.0, abs=0.1)


async def test_a_failing_query_keeps_the_last_estimate(hass, fake_home, hass_storage, caplog):
    hass.config.components.add("recorder")
    old = HeatLossEstimate("ok", 140.0, 250.0, 0.9, 7, 28, datetime(2026, 10, 1, 4, 30, tzinfo=TZ))
    saved_learning(hass_storage, LearningData(heat_loss=old))
    with patch(INSTANCE, side_effect=RuntimeError("database is locked")):
        c = (await setup_integration(hass)).runtime_data
    assert c.learning.data.heat_loss == old and "database is locked" in caplog.text
