"""hybrid_heating/get_forecast: the weather entity's hourly forecast, as the card reads it."""

from datetime import UTC, datetime, timedelta

from homeassistant.core import ServiceCall, SupportsResponse

from tests.integration.conftest import setup_integration
from tests.integration.test_card_contract import fixture, ws

START = datetime(2026, 11, 1, 13, 0, tzinfo=UTC)  # an hour before T0 (15:00 in Berlin)


def fake_weather(hass, hours: int = 60, entity: str = "weather.home") -> list[ServiceCall]:
    seen: list[ServiceCall] = []

    async def get_forecasts(call: ServiceCall):
        seen.append(call)
        items = [
            {
                "datetime": (START + timedelta(hours=i)).isoformat(),
                "temperature": 9.0 - i / 10,
                "condition": "cloudy",
            }
            for i in range(hours)
        ]
        return {entity: {"forecast": items}}

    hass.services.async_register(
        "weather", "get_forecasts", get_forecasts, supports_response=SupportsResponse.ONLY
    )
    return seen


async def test_forecast_from_the_weather_entity(hass, fake_home, hass_ws_client):
    seen = fake_weather(hass)
    await setup_integration(hass)
    r = await ws(hass_ws_client, hass, type="hybrid_heating/get_forecast")
    assert r["success"], r
    res = r["result"]
    assert res["source"] == "weather.home" and res["updated"] == "2026-11-01T14:00:00+00:00"
    assert len(res["hours"]) == 48
    assert res["hours"][0] == {"ts": "2026-11-01T14:00:00+00:00", "t_out": 8.9}
    assert seen[0].data == {"type": "hourly", "entity_id": "weather.home"}


async def test_forecast_has_the_card_fixture_shape(hass, fake_home, hass_ws_client):
    fake_weather(hass)
    await setup_integration(hass)
    res = (await ws(hass_ws_client, hass, type="hybrid_heating/get_forecast"))["result"]
    fx = fixture("forecast.json")
    assert set(res) == set(fx) and set(res["hours"][0]) == set(fx["hours"][0])


async def test_no_weather_service_is_an_error_not_a_crash(hass, fake_home, hass_ws_client):
    await setup_integration(hass)
    r = await ws(hass_ws_client, hass, type="hybrid_heating/get_forecast")
    assert not r["success"] and r["error"]["code"] == "forecast_unavailable"


async def test_a_reply_without_this_entity_is_an_error(hass, fake_home, hass_ws_client):
    fake_weather(hass, entity="weather.other")
    await setup_integration(hass)
    r = await ws(hass_ws_client, hass, type="hybrid_heating/get_forecast")
    assert not r["success"] and r["error"]["code"] == "forecast_unavailable"
