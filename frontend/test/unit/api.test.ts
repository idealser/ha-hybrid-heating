import { expect, test } from 'vitest';
import { HhApi, isUnknownCommand } from '../../src/api';
import { createMockHass } from '../mock-hass';

test('status passes the language', async () => {
  const h = createMockHass();
  const s = await new HhApi(() => h).getStatus('ru');
  expect(h.calls.at(-1)).toEqual({ type: 'hybrid_heating/get_status', language: 'ru' });
  expect(s.zone).toBe(0);
});

test('stage 5 missing → null, not an error', async () => {
  const api = new HhApi(() => createMockHass({ stage5: false }));
  expect(await api.getForecast()).toBeNull();
  expect(await api.getSuggestions('en')).toBeNull();
  expect(await api.feedback('child', 'cold', 'en')).toBeNull();
});

test('no stored floor plan → null', async () => {
  expect(await new HhApi(() => createMockHass()).getPlan()).toBeNull();
});

test('other errors keep their code', async () => {
  const h = createMockHass();
  h.failNext = { code: 'invalid_config', message: 'flow_min must be below flow_max' };
  await expect(new HhApi(() => h).setConfig({ curve: { flow_min: 70 } })).rejects.toMatchObject({
    code: 'invalid_config',
    message: 'flow_min must be below flow_max',
  });
});

test('unknown_command is recognised', () => {
  expect(isUnknownCommand({ code: 'unknown_command', message: 'x' })).toBe(true);
  expect(isUnknownCommand(new Error('x'))).toBe(false);
});

test('set_config sends only the changes and bumps the revision', async () => {
  const h = createMockHass();
  const r = await new HhApi(() => h).setConfig({ curve: { shift: 2 } });
  expect(h.calls.at(-1)).toEqual({ type: 'hybrid_heating/set_config', settings: { curve: { shift: 2 } } });
  expect(r.revision).toBe(2);
  expect(r.settings.curve.shift).toBe(2);
});

test('preset and hybrid go through entity services', async () => {
  const h = createMockHass();
  const api = new HhApi(() => h);
  await api.setPreset('select.hybrid_heating_preset', 'eco');
  expect(h.services.at(-1)).toEqual({
    domain: 'select',
    service: 'select_option',
    data: { entity_id: 'select.hybrid_heating_preset', option: 'eco' },
  });
  await api.setHybrid('switch.hybrid_heating_hybrid_mode', false);
  expect(h.services.at(-1)).toMatchObject({ domain: 'switch', service: 'turn_off' });
  expect(h.states['select.hybrid_heating_preset']!.state).toBe('eco');
  expect(h.states['switch.hybrid_heating_hybrid_mode']!.state).toBe('off');
});

test('log uses language and limit', async () => {
  const h = createMockHass();
  const e = await new HhApi(() => h).getLog('ru', 20);
  expect(h.calls.at(-1)).toEqual({ type: 'hybrid_heating/get_log', limit: 20, language: 'ru' });
  expect(e).toHaveLength(6);
  expect(e[0]!.reasons[0]!.text).toMatch(/Спальня/);
});

test('no backend: every command fails as unknown', async () => {
  const api = new HhApi(() => createMockHass({ backend: false }));
  await expect(api.getConfig()).rejects.toMatchObject({ code: 'unknown_command' });
});
