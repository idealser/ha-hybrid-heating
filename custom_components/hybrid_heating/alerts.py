"""Persistent notifications for what the user has to know about: unreachable devices, failsafe, leftovers."""

from __future__ import annotations

from collections.abc import Iterable

from homeassistant.components import persistent_notification
from homeassistant.core import HomeAssistant

from .const import DOMAIN, TITLE
from .texts import lang_for

_TEXTS = {
    "unreachable": {
        "en": "{entities} did not respond ({detail}). Hybrid Heating keeps trying; please check the device.",
        "ru": "{entities} не ответил ({detail}). Hybrid Heating продолжает попытки; проверьте устройство.",
    },
    "failsafe": {
        "en": "Hybrid Heating failed several cycles in a row, switched itself off and gave control back. "
        "Download the diagnostics and switch it on again when the cause is fixed.",
        "ru": "Hybrid Heating несколько раз подряд не смог выполнить такт, выключился и вернул управление. "
        "Скачайте диагностику и включите его снова, когда причина устранена.",
    },
    "giveback": {
        "en": "Hybrid Heating was removed while it could not give everything back. "
        "Please restore by hand: {items}",
        "ru": "Hybrid Heating удалён, но не смог всё вернуть. Восстановите вручную: {items}",
    },
}


def _id(key: str) -> str:
    return f"{DOMAIN}_{key}"


def _text(hass: HomeAssistant, key: str, **values: str) -> str:
    return _TEXTS[key][lang_for(hass.config.language)].format(**values)


def notify_unreachable(hass: HomeAssistant, key: str, entities: Iterable[str], detail: str | None) -> None:
    message = _text(hass, "unreachable", entities=", ".join(entities), detail=detail or "?")
    persistent_notification.async_create(
        hass, message, title=TITLE, notification_id=_id(f"unreachable_{key}")
    )


def dismiss_unreachable(hass: HomeAssistant, key: str) -> None:
    persistent_notification.async_dismiss(hass, _id(f"unreachable_{key}"))


def notify_failsafe(hass: HomeAssistant) -> None:
    persistent_notification.async_create(
        hass, _text(hass, "failsafe"), title=TITLE, notification_id=_id("failsafe")
    )


def notify_pending_giveback(hass: HomeAssistant, items: Iterable[str]) -> None:
    message = _text(hass, "giveback", items="; ".join(items))
    persistent_notification.async_create(hass, message, title=TITLE, notification_id=_id("giveback"))
