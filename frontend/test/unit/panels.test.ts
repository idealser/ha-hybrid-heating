import { expect, test } from 'vitest';
import { loadMeter, seasonStatus, shedNow, thermostatGap } from '../../src/logic/panels';
import type { HhStatus } from '../../src/types';
import { mergeSettings } from '../../src/logic/draft';
import { SETTINGS, STATUS_NOW } from '../fixtures';

const LIVE = mergeSettings(SETTINGS, { layers: { load: 'active' } });

test('load meter', () => {
  expect(loadMeter(1.3, 8)).toEqual({ fill: 13, hi: false, mark: 80 });
  expect(loadMeter(6.4, 8).hi).toBe(true);
  expect(loadMeter(12, 8).fill).toBe(100);
  expect(loadMeter(null, 8)).toEqual({ fill: 0, hi: false, mark: 80 });
});

test('season line', () => {
  expect(seasonStatus(STATUS_NOW, SETTINGS, 'ru')).toBe('Сезон идёт. Средняя за 12 ч: +10,0°.');
  expect(seasonStatus({ ...STATUS_NOW, season_active: false, t_out_window_mean: 18.2 }, SETTINGS, 'en')).toBe(
    'Off season. 12 h average: +18.2°.',
  );
  expect(seasonStatus({ ...STATUS_NOW, t_out_window_mean: null }, SETTINGS, 'en')).toBe('Season on. 12 h average: —.');
});

test('what load shedding has switched off', () => {
  expect(shedNow(STATUS_NOW, LIVE, 'ru')).toBeNull();
  const st = { ...STATUS_NOW, load: { ...STATUS_NOW.load, shedding: true, water_heater_shed: true, rods_shed: 1 } } as HhStatus;
  expect(shedNow(st, LIVE, 'ru')).toBe('Сейчас отключено: бойлер, ТЭНов снято: 1.');
  const rods = { ...st, load: { ...st.load, water_heater_shed: false, rods_shed: 2 } } as HhStatus;
  expect(shedNow(rods, LIVE, 'en')).toBe('Switched off now: rods off: 2.');
  // observing, nothing is switched off: say what the module would switch off
  expect(shedNow(st, SETTINGS, 'ru')).toBe('Отключил бы сейчас: бойлер, ТЭНов снято: 1.');
  const pause = { ...st, load: { ...st.load, water_heater_shed: false, rods_shed: 0 } } as HhStatus;
  expect(shedNow(pause, LIVE, 'en')).toBe('Switched off now: the boiler (paused).');
});

test('the old thermostat and the module disagree on the target', () => {
  expect(thermostatGap({ state: 'heat', attributes: { temperature: 20 } }, 23)).toEqual({ thermostat: 20, target: 23 });
  expect(thermostatGap({ state: 'heat', attributes: { temperature: 22.8 } }, 23)).toBeNull(); // close enough
  expect(thermostatGap({ state: 'off', attributes: {} }, 23)).toBeNull();
  expect(thermostatGap(undefined, 23)).toBeNull();
});
