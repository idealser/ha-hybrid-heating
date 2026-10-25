import { expect, test } from 'vitest';
import { dayLabel, effectiveTarget, localTime, presetTarget } from '../../src/logic/context';
import { SETTINGS } from '../fixtures';

const TZ = 'Europe/Berlin';
const at = (iso: string) => localTime(iso, TZ).hhmm;
const T = SETTINGS.targets;

test('preset targets', () => {
  expect(presetTarget(T, 'eco')).toBe(21.5);
  expect(presetTarget(T, 'away')).toBe(16);
});

test('night window and the DST change (02:30 happens twice on 2026-10-25)', () => {
  expect(effectiveTarget(T, 'comfort', at('2026-10-25T21:00:00Z'))).toEqual(['night', 22.5]); // 22:00
  expect(effectiveTarget(T, 'comfort', at('2026-10-26T05:59:00Z'))).toEqual(['night', 22.5]); // 06:59
  expect(effectiveTarget(T, 'comfort', at('2026-10-26T06:00:00Z'))).toEqual(['comfort', 23]); // 07:00
  for (const iso of ['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z']) {
    expect(at(iso)).toBe('02:30');
    expect(effectiveTarget(T, 'comfort', at(iso))[0]).toBe('night');
  }
  expect(effectiveTarget(T, 'eco', at('2026-10-25T21:00:00Z'))).toEqual(['eco', 21.5]);
  expect(effectiveTarget(T, 'away', at('2026-10-25T10:00:00Z'))).toEqual(['away', 16]);
});

test('a window that does not cross midnight', () => {
  const day = { ...T, night_start: '13:00:00', night_end: '15:00:00' };
  expect(effectiveTarget(day, 'comfort', '14:59')[0]).toBe('night');
  expect(effectiveTarget(day, 'comfort', '15:00')[0]).toBe('comfort');
});

test('local time parts and day labels', () => {
  expect(localTime('2026-10-25T13:00:00Z', TZ)).toEqual({ hhmm: '14:00', hour: 14, dateKey: '2026-10-25' });
  expect(dayLabel('2026-10-25T13:00:00Z', TZ, 'ru')).toBe('вс 25');
  expect(dayLabel('2026-10-25T13:00:00Z', TZ, 'en')).toBe('Sun 25');
});
