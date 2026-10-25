import json
import re
from pathlib import Path

from custom_components.hybrid_heating.const import VERSION

PKG = Path("custom_components/hybrid_heating")


def test_manifest_hacs_and_version():
    m = json.loads((PKG / "manifest.json").read_text(encoding="utf-8"))
    keys = list(m)
    assert keys[:2] == ["domain", "name"] and keys[2:] == sorted(keys[2:])
    assert (m["domain"], m["name"], m["version"]) == ("hybrid_heating", "Hybrid Heating", VERSION)
    assert m["config_flow"] is True and m["single_config_entry"] is True and m["iot_class"] == "calculated"
    hacs = json.loads(Path("hacs.json").read_text(encoding="utf-8"))
    assert hacs == {"name": "Hybrid Heating", "homeassistant": "2026.10.0"}
    assert (PKG / "brand/icon.png").stat().st_size > 0


HA_MODULES = {
    "__init__",
    "config_flow",
    "coordinator",
    "executor",
    "storage",
    "entity",
    "switch",
    "select",
    "sensor",
    "binary_sensor",
    "climate",
    "websocket",
    "websocket_learning",
    "weather_forecast",
    "learning_manager",
    "diagnostics",
    "alerts",
    "card_resource",
}


def test_glue_modules_are_ha_free():
    offenders = [
        p.name
        for p in PKG.glob("*.py")
        if p.stem not in HA_MODULES
        and re.search(r"^\s*(from|import)\s+homeassistant", p.read_text(encoding="utf-8"), re.M)
    ]
    assert offenders == []


def test_card_and_integration_share_the_version():
    """The card is served with ?v=VERSION; a bundle change without a new version would be cached for weeks."""
    card = json.loads(Path("frontend/package.json").read_text(encoding="utf-8"))
    project = re.search(r'^version = "(.+)"$', Path("pyproject.toml").read_text(encoding="utf-8"), re.M)
    assert card["version"] == VERSION and project and project.group(1) == VERSION
    assert f"## {VERSION}" in Path("CHANGELOG.md").read_text(encoding="utf-8")
