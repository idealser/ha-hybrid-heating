"""The nightly heat-capacity estimate from the hours the module saw nothing heating."""

from datetime import UTC, datetime, timedelta

import pytest
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.hybrid_heating.core.learning import LearningData
from custom_components.hybrid_heating.core.model import CapacityEstimate, HeatLossEstimate, hour_of
from tests.conftest import T0, TZ
from tests.core.test_heat_capacity import cooling
from tests.integration.conftest import log_reasons, setup_integration
from tests.integration.test_card_contract import ws
from tests.integration.test_learning import saved_learning

SENSOR = "sensor.hybrid_heating_heat_capacity"


async def test_capacity_is_estimated_at_start_and_reaches_the_card(
    hass, fake_home, hass_storage, hass_ws_client
):
    saved_learning(hass_storage, LearningData(hours=cooling(20.0, 60, end=T0)))
    c = (await setup_integration(hass)).runtime_data
    e = c.learning.data.capacity
    assert e is not None and (e.status, e.hours_used, e.h_w_per_k, e.computed_at) == ("ok", 58, 150.0, T0)
    assert e.kwh_per_k == pytest.approx(20.0, abs=0.2) and c.learning.data.capacity_ok == e
    state = hass.states.get(SENSOR)
    assert float(state.state) == e.kwh_per_k and state.attributes["unit_of_measurement"] == "kWh/K"
    attrs = state.attributes
    assert (attrs["source"], attrs["status"], attrs["hours_used"], attrs["window_days"]) == (
        "estimate",
        "ok",
        58,
        14,
    )
    config = (await ws(hass_ws_client, hass, type="hybrid_heating/get_config"))["result"]
    assert config["model"] == {"capacity_kwh_per_k": e.kwh_per_k}  # the heat loss is not learned yet
    assert [r["data"]["hours_used"] for r in log_reasons(c, "capacity_estimated")] == [58]
    item = next(v for v in c.learning.views("en") if v["kind"] == "heat_capacity")
    assert item["state"] == "info" and item["title"] == f"Heat capacity: {e.kwh_per_k} kWh/K"


async def test_a_first_start_waits_for_the_night(hass, fake_home, freezer):
    c = (await setup_integration(hass)).runtime_data
    assert c.learning.data.capacity is None and log_reasons(c, "capacity_insufficient") == []
    assert float(hass.states.get(SENSOR).state) == 5.2  # the card's default
    assert hass.states.get(SENSOR).attributes["source"] == "model_default"
    tally = c.learning.data.hours[hour_of(T0)]
    assert (tally.ticks, tally.heat_ticks) == (1, 0)  # the minutes count into their hour from the start
    freezer.move_to(datetime(2026, 11, 2, 4, 30, tzinfo=TZ))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    e = c.learning.data.capacity
    assert e is not None and e.status == "insufficient_data" and c.learning.data.capacity_ok is None
    assert [r["data"] for r in log_reasons(c, "capacity_insufficient")] == [
        {"hours_used": 0, "min_hours": 24}
    ]
    assert hass.states.get(SENSOR).attributes["status"] == "insufficient_data"


async def test_the_learned_heat_loss_is_used(hass, fake_home, hass_storage, hass_ws_client):
    good = HeatLossEstimate("ok", 120.0, 300.0, 0.9, 9, 28, datetime(2026, 10, 30, 4, 30, tzinfo=TZ))
    hours = cooling(20.0, 60, end=T0)  # it cooled as a 150 W/K flat with 20 kWh/K does
    saved_learning(hass_storage, LearningData(hours=hours, heat_loss=good, heat_loss_ok=good))
    c = (await setup_integration(hass)).runtime_data
    e = c.learning.data.capacity
    assert e is not None and e.h_w_per_k == 120.0
    assert e.kwh_per_k is not None and e.kwh_per_k < 20.0  # less heat lost per degree: less stored
    config = (await ws(hass_ws_client, hass, type="hybrid_heating/get_config"))["result"]
    assert config["model"] == {"h_w_per_k": 120.0, "capacity_kwh_per_k": e.kwh_per_k}


async def test_a_fresh_estimate_waits_for_the_night_and_a_bad_one_keeps_the_last_good(
    hass, fake_home, hass_storage, freezer
):
    good = CapacityEstimate("ok", 23.3, 53, 2.28, 150.0, 14, T0 - timedelta(hours=3))
    old_hours = cooling(20.0, 60, end=T0 - timedelta(days=16))  # out of the window by the next night
    saved_learning(hass_storage, LearningData(hours=old_hours, capacity=good, capacity_ok=good))
    c = (await setup_integration(hass)).runtime_data
    assert c.learning.data.capacity == good and log_reasons(c, "capacity_estimated") == []
    freezer.move_to(datetime(2026, 11, 2, 4, 30, tzinfo=TZ))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    e = c.learning.data.capacity
    assert e is not None and e.status == "insufficient_data" and e.computed_at.astimezone(UTC).hour == 3
    assert c.learning.data.capacity_ok == good and float(hass.states.get(SENSOR).state) == 23.3
