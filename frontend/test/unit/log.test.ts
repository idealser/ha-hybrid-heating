import { expect, test } from 'vitest';
import { logLines, logPip, logTime } from '../../src/logic/log';
import type { HhLogEntry } from '../../src/types';
import { LOG } from '../fixtures';

const withReason = (e: HhLogEntry, layer: string, code: string): HhLogEntry => ({
  ...e,
  reasons: [{ layer, code, data: {}, text: code }],
});

test('pips match the mockup log', () => {
  expect(LOG.en.entries.map(logPip)).toEqual(['ac', 'idle', 'heat', 'ok', 'cold', 'ok']);
});

test('unknown codes fall back to the layer of the first reason', () => {
  const e = LOG.en.entries[0]!;
  expect(logPip(withReason(e, 'boiler', 'brand_new'))).toBe('heat');
  expect(logPip(withReason(e, 'load', 'brand_new'))).toBe('ok');
  expect(logPip(withReason(e, 'system', 'x'))).toBe('idle');
  expect(logPip(withReason(e, 'system', 'pause_boiler'))).toBe('cold');
  expect(logPip({ ...e, reasons: [] })).toBe('idle');
});

test('log time: today HH:MM, earlier days as a date', () => {
  const now = '2026-10-25T14:00:00Z';
  const tz = 'Europe/Berlin';
  expect(logTime('2026-10-25T13:02:00Z', now, tz, 'ru').short).toBe('14:02');
  expect(logTime('2026-10-24T13:02:00Z', now, tz, 'ru').short).toBe('24.10');
  expect(logTime('2026-10-24T13:02:00Z', now, tz, 'en').short).toBe('10/24');
  expect(logTime('2026-10-24T13:02:00Z', now, tz, 'ru').full).toBe('24.10, 15:02');
});

test('an entry reads as its first reason, the rest as detail', () => {
  const e: HhLogEntry = {
    ...LOG.en.entries[0]!,
    reasons: [
      { layer: 'boiler', code: 'smooth_on', data: {}, text: 'Boiler on' },
      { layer: 'load', code: 'shed_rod', data: {}, text: 'One rod off' },
    ],
  };
  expect(logLines(e)).toEqual({ title: 'Boiler on', detail: 'One rod off' });
  expect(logLines({ ...e, reasons: [] })).toEqual({ title: '', detail: '' });
});
