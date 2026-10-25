from __future__ import annotations

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


def test_translations_have_the_same_keys():
    def keys(d: dict, prefix: str = "") -> set[str]:
        out: set[str] = set()
        for k, v in d.items():
            out |= keys(v, f"{prefix}{k}.") if isinstance(v, dict) else {prefix + k}
        return out

    en = json.loads((PKG / "translations/en.json").read_text(encoding="utf-8"))
    ru = json.loads((PKG / "translations/ru.json").read_text(encoding="utf-8"))
    assert keys(en) == keys(ru)
    assert en["config"]["error"]["entity_not_found"] and en["config"]["abort"]["single_instance_allowed"]


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
    "websocket",
    "diagnostics",
}


def test_glue_modules_are_ha_free():
    offenders = [
        p.name
        for p in PKG.glob("*.py")
        if p.stem not in HA_MODULES
        and re.search(r"^\s*(from|import)\s+homeassistant", p.read_text(encoding="utf-8"), re.M)
    ]
    assert offenders == []
