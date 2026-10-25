"""The learning manager: day tallies, the morning check, its store and how it rides along with the ticks."""

from datetime import date, datetime
from unittest.mock import patch

from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import EVENT_HOMEASSISTANT_FINAL_WRITE
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.hybrid_heating.codec import to_data
from custom_components.hybrid_heating.const import STORAGE_VERSION
from custom_components.hybrid_heating.core.learning import LearningData, TickSample
from custom_components.hybrid_heating.core.types import LayerMode
from tests.conftest import TZ, with_layers
from tests.core.test_learning import COLD3
from tests.integration.conftest import STORE_KEY, log_codes, log_reasons, setup_integration, step
from tests.integration.test_card_contract import ws

LEARN_KEY = f"{STORE_KEY}.learning"


def saved_learning(hass_storage, data) -> None:
    raw = to_data(data) if isinstance(data, LearningData) else data
    hass_storage[LEARN_KEY] = {"version": STORAGE_VERSION, "minor_version": 1, "key": LEARN_KEY, "data": raw}


def ticks_counted(c) -> int:
    return sum(t.ticks for t in c.learning.data.tallies.values())


async def test_each_minute_counts_once(hass, fake_home, freezer):
    c = (await setup_integration(hass)).runtime_data
    assert ticks_counted(c) == 1
    await c.async_refresh()  # another tick in the same minute (an overload makes them 5 s apart)
    assert ticks_counted(c) == 1
    await step(freezer, hass, 60)
    assert ticks_counted(c) == 2 and list(c.learning.data.tallies) == [date(2026, 11, 1)]


async def test_the_morning_check_suggests_a_curve_point(hass, fake_home, hass_storage, freezer):
    freezer.move_to(datetime(2026, 11, 12, 8, 59, tzinfo=TZ))
    saved_learning(hass_storage, LearningData(mornings=COLD3[:2]))
    c = (await setup_integration(hass)).runtime_data
    c.learning.morning_buffer[:] = [
        TickSample(datetime(2026, 11, 12, 8, m, tzinfo=TZ), 6.8, 22.45, 23.0, True) for m in range(60)
    ]
    seq = c.learning.revision
    freezer.move_to(datetime(2026, 11, 12, 9, 0, tzinfo=TZ))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert [s.key for s in c.learning.data.pending] == ["curve:5:up"]
    assert c.learning.data.mornings[-1].day == date(2026, 11, 12) and c.learning.morning_buffer == []
    assert hass_storage[LEARN_KEY]["data"]["pending"][0]["new"] == 46.0
    assert c.learning.revision == seq + 1
    created = log_reasons(c, "suggestion_created")
    assert [r["data"] for r in created] == [{"setting": "curve.points.5", "old": 44.5, "new": 46.0}]


async def test_morning_ticks_are_on_the_curve_only_with_the_boiler_in_control(
    hass, fake_home, freezer, calls, stored
):
    freezer.move_to(datetime(2026, 11, 12, 8, 10, tzinfo=TZ))
    stored(settings=to_data(with_layers(boiler=LayerMode.ACTIVE)))
    c = (await setup_integration(hass)).runtime_data
    assert [(s.at, s.on_curve) for s in c.learning.morning_buffer] == [
        (datetime(2026, 11, 12, 8, 10, tzinfo=TZ), True)
    ]
    await c.async_patch_settings({"layers": {"boiler": "observe"}}, "ws")
    await step(freezer, hass, 60)
    assert [s.on_curve for s in c.learning.morning_buffer] == [True, False]


async def test_no_morning_ticks_outside_the_window(hass, fake_home):
    c = (await setup_integration(hass)).runtime_data  # 15:00
    assert c.learning.morning_buffer == []


async def test_a_broken_learning_store_starts_empty_and_says_so(hass, fake_home, hass_storage):
    saved_learning(hass_storage, {"marks": "garbage"})
    c = (await setup_integration(hass)).runtime_data
    assert c.learning.data.marks == []
    assert {"section": "learning"} in [r["data"] for r in log_reasons(c, "store_section_reset")]


async def test_learning_is_kept_across_a_restart(hass, fake_home, hass_storage):
    saved_learning(hass_storage, LearningData(mornings=COLD3))
    c = (await setup_integration(hass)).runtime_data
    assert c.learning.data.mornings == COLD3 and "store_section_reset" not in log_codes(c)


async def test_a_failing_learning_hook_does_not_stop_the_heating(hass, fake_home, caplog):
    with patch(
        "custom_components.hybrid_heating.learning_manager.update_tally", side_effect=RuntimeError("boom")
    ):
        entry = await setup_integration(hass)
    assert entry.state is ConfigEntryState.LOADED and entry.runtime_data.data.decision is not None
    assert "boom" in caplog.text


async def test_learning_is_saved_on_shutdown_and_removed_with_the_entry(hass, fake_home, hass_storage):
    entry = await setup_integration(hass)
    hass.bus.async_fire(EVENT_HOMEASSISTANT_FINAL_WRITE)
    await hass.async_block_till_done()
    assert hass_storage[LEARN_KEY]["data"]["tallies"] == {
        "2026-11-01": {"ticks": 1, "ac_heat_ticks": 0, "season_ticks": 1}
    }
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert LEARN_KEY not in hass_storage


async def test_status_tells_the_card_when_suggestions_changed(hass, fake_home, hass_ws_client):
    c = (await setup_integration(hass)).runtime_data
    c.learning.revision = 7
    status = (await ws(hass_ws_client, hass, type="hybrid_heating/get_status"))["result"]
    assert status["seq"]["suggestions"] == 7


async def test_without_the_recorder_estimates_use_the_model_default(hass, fake_home, hass_ws_client):
    c = (await setup_integration(hass)).runtime_data
    assert c.learning.data.heat_loss is None
    state = hass.states.get("sensor.hybrid_heating_heat_loss")
    assert state.state == "150.0" and state.attributes["source"] == "model_default"
    config = (await ws(hass_ws_client, hass, type="hybrid_heating/get_config"))["result"]
    assert config["model"] == {}


async def test_learning_is_saved_while_the_loop_runs(hass, fake_home, hass_storage, freezer):
    await setup_integration(hass)
    for _ in range(6):
        await step(freezer, hass, 60)
    assert hass_storage[LEARN_KEY]["data"]["tallies"]["2026-11-01"]["ticks"] >= 6
