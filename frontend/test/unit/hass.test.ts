import { expect, test } from 'vitest';
import { liveFromHass, relevantHassChanged } from '../../src/logic/hass';
import type { HomeAssistant } from '../../src/types';
import { CONFIG } from '../fixtures';
import { createMockHass } from '../mock-hass';

const C = CONFIG.controls;

test('live preset, hybrid and enabled come from the entities', () => {
  const h = createMockHass();
  expect(liveFromHass(h, C)).toEqual({ hybrid: true, preset: 'comfort', enabled: true });
  const off = { ...h, states: { ...h.states, [C.hybrid]: { state: 'off' }, [C.preset]: { state: 'unavailable' } } };
  expect(liveFromHass(off, C)).toEqual({ hybrid: false, preset: null, enabled: true });
  expect(liveFromHass({ ...h, states: {} }, C)).toEqual({ hybrid: null, preset: null, enabled: null });
});

test('relevantHassChanged ignores unrelated states', () => {
  const a = createMockHass();
  const b = { ...a, states: { ...a.states, 'sensor.x': { state: '1' } } };
  expect(relevantHassChanged(a, b, C)).toBe(false);
  const c = { ...a, states: { ...a.states, 'select.hybrid_heating_preset': { state: 'eco' } } };
  expect(relevantHassChanged(a, c, C)).toBe(true);
});

test('theme, language and user changes count; the first hass always does', () => {
  const a = createMockHass();
  const variants: Partial<HomeAssistant>[] = [
    { themes: { darkMode: true } },
    { locale: { language: 'ru' } },
    { user: { is_admin: false } },
  ];
  for (const v of variants) expect(relevantHassChanged(a, { ...a, ...v }, C)).toBe(true);
  expect(relevantHassChanged(undefined, a, C)).toBe(true);
  expect(relevantHassChanged(a, { ...a, states: { ...a.states, [C.preset]: { state: 'eco' } } }, null)).toBe(false);
});
