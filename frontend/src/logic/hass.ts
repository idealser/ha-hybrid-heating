// What the card reads from Home Assistant's frontend object, and when a new one matters.
import { PRESETS, type HhControls, type HomeAssistant, type Preset } from '../types';

export interface Live {
  hybrid: boolean | null;
  preset: Preset | null;
  enabled: boolean | null;
}

function onOff(hass: HomeAssistant, entityId: string): boolean | null {
  const state = hass.states[entityId]?.state;
  return state === 'on' ? true : state === 'off' ? false : null;
}

/** The module's own switches and preset select; null while an entity is unknown or unavailable. */
export function liveFromHass(hass: HomeAssistant, c: HhControls): Live {
  const preset = hass.states[c.preset]?.state;
  return {
    hybrid: onOff(hass, c.hybrid),
    preset: PRESETS.includes(preset as Preset) ? (preset as Preset) : null,
    enabled: onOff(hass, c.enabled),
  };
}

export function hassLanguage(hass: HomeAssistant): string | undefined {
  return hass.locale?.language ?? hass.language;
}

/**
 * Home Assistant hands every card a new object on any state change in the house; the card only
 * redraws for its own entities, the theme, the language or the user.
 */
export function relevantHassChanged(
  prev: HomeAssistant | undefined,
  next: HomeAssistant,
  c: HhControls | null,
): boolean {
  if (!prev) return true;
  if (
    prev.themes?.darkMode !== next.themes?.darkMode ||
    hassLanguage(prev) !== hassLanguage(next) ||
    prev.user?.is_admin !== next.user?.is_admin
  )
    return true;
  if (!c) return false;
  return [c.enabled, c.hybrid, c.preset, c.boiler_mode].some(id => prev.states[id] !== next.states[id]);
}
