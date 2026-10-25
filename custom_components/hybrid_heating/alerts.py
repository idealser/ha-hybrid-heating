"""Persistent notifications for what the user has to know about: unreachable devices, failsafe, leftovers."""

from collections.abc import Iterable

from homeassistant.components import persistent_notification
from homeassistant.core import HomeAssistant

from .const import DOMAIN, TITLE
from .texts import lang_for, render_alert


def _notify(hass: HomeAssistant, notification_id: str, key: str, **values: str) -> None:
    message = render_alert(key, lang_for(hass.config.language), **values)
    persistent_notification.async_create(
        hass, message, title=TITLE, notification_id=f"{DOMAIN}_{notification_id}"
    )


def notify_unreachable(hass: HomeAssistant, entity_id: str, detail: str | None) -> None:
    _notify(hass, f"unreachable_{entity_id}", "unreachable", entities=entity_id, detail=detail or "?")


def dismiss_unreachable(hass: HomeAssistant, entity_id: str) -> None:
    persistent_notification.async_dismiss(hass, f"{DOMAIN}_unreachable_{entity_id}")


def notify_failsafe(hass: HomeAssistant) -> None:
    _notify(hass, "failsafe", "failsafe")


def notify_pending_giveback(hass: HomeAssistant, items: Iterable[str]) -> None:
    _notify(hass, "giveback", "giveback", items="; ".join(items))
