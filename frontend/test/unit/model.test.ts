import { expect, test } from 'vitest';
import {
  acCapacityKw,
  acCop,
  DEFAULT_MODEL,
  forecastScale,
  forecastSummary,
  forecastTotals,
  heatDemandKw,
  probe,
  probeDaily,
  withModelDefaults,
} from '../../src/logic/model';
import { FORECAST, SETTINGS, TZ } from '../fixtures';

const S = SETTINGS;
const M = { ...DEFAULT_MODEL, tariff_per_kwh: 0.3 };

test('mirrors core/model.py', () => {
  expect(heatDemandKw(150, 300, 23.0, 13.8)).toBeCloseTo(1.08, 6);
  expect(heatDemandKw(150, 300, 23.0, 25)).toBe(0);
  expect(acCapacityKw(3.5, 7)).toBe(3.5);
  expect(acCapacityKw(3.5, -15)).toBeCloseTo((3.5 * 3.0) / 6.2, 6);
  expect(acCapacityKw(3.5, -15.1)).toBe(0);
  expect(acCop(7)).toBeCloseTo(3.6);
  expect(acCop(-15)).toBeCloseTo(1.7);
  expect(acCop(20)).toBeCloseTo(4.2);
});

test('defaults fill missing model keys', () => {
  expect(withModelDefaults({ h_w_per_k: 120 })).toEqual({ ...DEFAULT_MODEL, h_w_per_k: 120 });
  expect(withModelDefaults(undefined)).toEqual(DEFAULT_MODEL);
});

test('probe now, +13.8', () => {
  const p = probe(S, M, 13.8);
  expect(p.zone).toBe(0);
  expect(p.demandKw).toBeCloseTo(1.08, 3);
  expect(p.acKw.living).toBeCloseTo(0.4536, 4);
  expect(p.acKw.bedroom).toBeCloseTo(0.2484, 4);
  expect(p.boilerKw).toBeCloseTo(0.378, 3);
  expect(p.shortKw).toBe(0);
  expect(p.cop).toBeCloseTo(4.11, 2);
  expect(p.flow).toBeCloseTo(32.32, 2);
  const d = probeDaily(p, M);
  expect(d.kwh).toBeCloseTo(13.17, 2);
  expect(d.cost).toBeCloseTo(3.951, 2);
  expect(d.saving).toBeCloseTo(0.492, 3);
});

test('probe frost, −8', () => {
  const p = probe(S, M, -8);
  expect(p.zone).toBe(2);
  expect(p.acKw.living).toBeCloseTo(1.827, 3);
  expect(p.acKw.bedroom).toBeCloseTo(1.0005, 4);
  expect(p.boilerKw).toBeCloseTo(1.5225, 4);
  expect(p.flow).toBeCloseTo(53.4, 2);
});

test('probe −20: no ACs, short of heat', () => {
  const p = probe(S, M, -20);
  expect(p.acTotalKw).toBe(0);
  expect(p.boilerKw).toBe(6);
  expect(p.shortKw).toBeCloseTo(0.15, 3);
  expect(p.cop).toBeNull();
  expect(p.flow).toBe(65);
});

test('away, hybrid off and night-off switch ACs off', () => {
  expect(probe({ ...S, preset: 'away' }, M, 5).acTotalKw).toBe(0);
  expect(probe({ ...S, hybrid: false }, M, 5).acTotalKw).toBe(0);
  const s = { ...S, ac: { ...S.ac, night: { living: 'off', bedroom: 'quiet' } as const } };
  expect(probe(s, M, 5, { night: true }).acKw.living).toBe(0);
  expect(probe(s, M, 5, { night: true }).acKw.bedroom).toBeGreaterThan(0);
});

test('forecast totals for the fixture', () => {
  const r = forecastTotals(S, M, FORECAST.hours, TZ);
  expect(r.kwh).toBeCloseTo(65.43, 1);
  expect(r.cost).toBeCloseTo(19.63, 1);
  expect(r.boilerOnlyCost).toBeCloseTo(35.38, 1);
});

test('forecast scale and summary', () => {
  expect(forecastScale([-4.6, 13.8])).toEqual({ tmin: -8, tmax: 17, ticks: [-5, 0, 5, 10, 15] });
  expect(forecastSummary(S, FORECAST.hours, TZ, 'ru')).toBe(
    'вс 25, около 23:00 станет +7,8°: зона «Прохладно», оба кондиционера · котёл основной · 2 ТЭНа. ' +
      'Холоднее всего вт 27 в 03:00, −4,6°: зона «Мороз».',
  );
  expect(forecastSummary(S, [], TZ, 'en')).toBe('');
});
