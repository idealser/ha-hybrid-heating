import { expect, test } from 'vitest';
import {
  setBound,
  setZoneBoiler,
  setZoneRods,
  stripLabel,
  toggleZoneAc,
  zoneIndex,
  zoneLowerBound,
  zoneName,
  zoneRange,
  zoneSummary,
} from '../../src/logic/zones';
import type { Bounds } from '../../src/types';
import { SETTINGS } from '../fixtures';

const B: Bounds = [8, -3, -15];

test.each([
  [8, 0],
  [7.9, 1],
  [-3, 1],
  [-3.1, 2],
  [-15, 2],
  [-15.1, 3],
])('zone at %s is %s (same as core/context.py)', (t, z) => expect(zoneIndex(B, t)).toBe(z));

test('setBound keeps 1° gaps and ±19', () => {
  expect(setBound(B, 0, 25)).toEqual([19, -3, -15]);
  expect(setBound(B, 0, -5)).toEqual([-2, -3, -15]);
  expect(setBound(B, 1, 9)).toEqual([8, 7, -15]);
  expect(setBound(B, 2, -30)).toEqual([8, -3, -19]);
  expect(setBound(B, 2, 0)).toEqual([8, -3, -4]);
  expect(zoneLowerBound(B, 1)).toBe(-3);
  expect(zoneLowerBound(B, 3)).toBe(-20);
});

test('zone copy', () => {
  expect(zoneName(1, 'ru')).toBe('Прохладно');
  expect(zoneRange(0, B, 'ru')).toBe('выше +8°');
  expect(zoneRange(1, B, 'ru')).toBe('от −3° до +8°');
  expect(zoneRange(3, B, 'en')).toBe('below −15°');
  expect(zoneSummary(SETTINGS.zones.policies[0], 'ru')).toBe('оба кондиционера · котёл на подстраховке · 2 ТЭНа');
  expect(zoneSummary({ ac_rooms: ['living'], boiler: 'off', max_rods: 1 }, 'ru')).toBe('кондиционер в гостиной · котёл выкл');
  expect(zoneSummary(SETTINGS.zones.policies[3], 'en')).toBe('no ACs · boiler main · 3 rods');
});

test('zone edits keep the AC list sorted and do not mutate', () => {
  const z1 = toggleZoneAc(SETTINGS.zones, 0, 'bedroom');
  expect(z1.policies[0].ac_rooms).toEqual(['living']);
  expect(toggleZoneAc(z1, 0, 'bedroom').policies[0].ac_rooms).toEqual(['bedroom', 'living']);
  expect(SETTINGS.zones.policies[0].ac_rooms).toEqual(['bedroom', 'living']);
  expect(setZoneBoiler(SETTINGS.zones, 2, 'off').policies[2].boiler).toBe('off');
  expect(setZoneRods(SETTINGS.zones, 2, 1).policies[2].max_rods).toBe(1);
  expect(SETTINGS.zones.policies[2]).toEqual({ ac_rooms: ['bedroom', 'living'], boiler: 'main', max_rods: 3 });
});

test('strip labels by width', () => {
  expect(stripLabel('Сильный мороз', 120)).toBe('Сильный мороз');
  expect(stripLabel('Сильный мороз', 80)).toBe('СМ');
  expect(stripLabel('Warm', 40)).toBe('');
});
