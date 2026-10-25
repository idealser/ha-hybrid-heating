import json
from pathlib import Path

from custom_components.hybrid_heating.core.types import BoilerMode, Preset
from custom_components.hybrid_heating.texts import PRESET_NAMES, ZONE_KEYS, ZONE_NAMES

DIR = Path("custom_components/hybrid_heating/translations")


def flat_keys(d: dict, prefix: str = "") -> set[str]:
    out: set[str] = set()
    for k, v in d.items():
        out |= flat_keys(v, f"{prefix}{k}.") if isinstance(v, dict) else {prefix + k}
    return out


def load(lang: str) -> dict:
    return json.loads((DIR / f"{lang}.json").read_text(encoding="utf-8"))


def test_en_ru_have_same_keys_and_ru_names():
    en, ru = load("en"), load("ru")
    assert flat_keys(en) == flat_keys(ru)
    assert ru["entity"]["switch"]["enabled"]["name"] == "Включено"
    assert set(en["entity"]["sensor"]["zone"]["state"]) == set(ZONE_KEYS)


def test_entity_names():
    names = {
        lang: {
            key: entity["name"]
            for platform in load(lang)["entity"].values()
            for key, entity in platform.items()
        }
        for lang in ("en", "ru")
    }
    assert names["en"] == {
        "enabled": "Enabled",
        "hybrid_mode": "Hybrid mode",
        "preset": "Preset",
        "boiler_mode": "Boiler mode",
        "flow_target": "Flow target",
        "zone": "Zone",
        "status": "Status",
        "heat_loss": "Heat loss",
        "boiler_call": "Boiler call",
        "load_shedding": "Load shedding",
    }
    assert names["ru"] == {
        "enabled": "Включено",
        "hybrid_mode": "Гибридный режим",
        "preset": "Пресет",
        "boiler_mode": "Режим котла",
        "flow_target": "Целевая подача",
        "zone": "Зона",
        "status": "Статус",
        "heat_loss": "Теплопотери",
        "boiler_call": "Запрос тепла",
        "load_shedding": "Сброс нагрузки",
    }


def test_state_names_match_texts():
    for lang in ("en", "ru"):
        entity = load(lang)["entity"]
        assert entity["sensor"]["zone"]["state"] == dict(ZONE_NAMES[lang])
        assert entity["select"]["preset"]["state"] == {p.value: PRESET_NAMES[lang][p] for p in Preset}
        assert set(entity["select"]["boiler_mode"]["state"]) == {m.value for m in BoilerMode}
    assert load("en")["entity"]["select"]["boiler_mode"]["state"] == {
        "smooth": "Smooth",
        "classic": "Classic",
    }
    assert load("ru")["entity"]["select"]["boiler_mode"]["state"] == {
        "smooth": "Плавный",
        "classic": "Классический",
    }


def test_errors_and_aborts_are_translated():
    for lang in ("en", "ru"):
        config = load(lang)["config"]
        assert config["error"]["entity_not_found"] and config["abort"]["single_instance_allowed"]
        assert load(lang)["options"]["error"] == config["error"]


def test_options_pages_mirror_the_setup_pages():
    # Home Assistant does not resolve [%key:...%] references for custom integrations, so the options
    # pages are a copy of the setup pages; only the first page's description differs.
    for lang in ("en", "ru"):
        setup, options = load(lang)["config"]["step"], load(lang)["options"]["step"]
        assert {**options["init"], "description": None} == {**setup["user"], "description": None}
        assert options["rooms"] == setup["rooms"] and options["coexistence"] == setup["coexistence"]
