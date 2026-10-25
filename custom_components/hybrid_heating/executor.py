"""Run commands as Home Assistant service calls, one by one, never raising."""

import asyncio
import logging
from collections.abc import Sequence

from homeassistant.const import STATE_UNAVAILABLE
from homeassistant.core import Context, HomeAssistant

from .commands import Command, CommandResult
from .const import COMMAND_TIMEOUT_S

_LOGGER = logging.getLogger(__name__)


async def async_run_commands(
    hass: HomeAssistant,
    commands: Sequence[Command],
    context: Context,
    timeout_s: float = COMMAND_TIMEOUT_S,
) -> list[CommandResult]:
    results: list[CommandResult] = []
    for cmd in commands:
        target = hass.states.get(cmd.entity_id)
        if target is None or target.state == STATE_UNAVAILABLE:
            results.append(CommandResult(cmd, "skipped", "unavailable"))
            continue
        try:
            async with asyncio.timeout(timeout_s):
                await hass.services.async_call(
                    cmd.domain, cmd.service, dict(cmd.data), blocking=True, context=context
                )
        except TimeoutError:
            _LOGGER.warning(
                "%s.%s for %s timed out after %s s", cmd.domain, cmd.service, cmd.entity_id, timeout_s
            )
            results.append(CommandResult(cmd, "failed", "timeout"))
        except Exception as err:  # noqa: BLE001 - one failed device must not stop the tick
            _LOGGER.warning("%s.%s for %s failed: %r", cmd.domain, cmd.service, cmd.entity_id, err)
            results.append(CommandResult(cmd, "failed", repr(err)))
        else:
            results.append(CommandResult(cmd, "ok"))
    return results
