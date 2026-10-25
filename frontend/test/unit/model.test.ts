import { expect, test } from 'vitest';
import {
  acCapacityKw,
  acCop,
  DEFAULT_MODEL,
  forecastHourLine,
  forecastRun,
  forecastScale,
  forecastSummary,
  forecastTotals,
  heatDemandKw,
  probe,
  probeDaily,
  seasonByHour,
  withModelDefaults,
} from '../../src/logic/model';
import { fF, fmt, fT } from '../../src/logic/format';
import type { HhForecastHour, HhSettings } from '../../src/types';
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
  expect(p.flow).toBeCloseTo(35.32, 2); // the warm zone backs up the ACs: the full curve, as the core
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
  const r = forecastTotals(S, M, FORECAST.hours, TZ, { seasonActive: true, windowMean: 10, indoor: 23 });
  expect(r.heatedHours).toBe(48);
  expect(r.cost).toBeCloseTo(r.kwh * 0.3, 9);
  expect(r.boilerOnlyCost).toBeGreaterThan(r.cost); // the ACs make the same heat for less electricity
  expect(r.kwh).toBeGreaterThan(40);
  expect(r.kwh).toBeLessThan(80);
});

test('forecast scale and summary', () => {
  expect(forecastScale([-4.6, 13.8])).toEqual({ tmin: -8, tmax: 17, ticks: [-5, 0, 5, 10, 15] });
  expect(forecastSummary(S, FORECAST.hours, TZ, 'ru')).toBe(
    'вс 25, около 23:00 станет +7,8°: зона «Прохладно», оба кондиционера · котёл основной · 2 ТЭНа. ' +
      'Холоднее всего вт 27 в 03:00, −4,6°: зона «Мороз».',
  );
  expect(forecastSummary(S, [], TZ, 'en')).toBe('');
});

test('what-if flow: no background shift where the boiler only backs up the ACs', () => {
  const warm = probe(SETTINGS, withModelDefaults(), 13.8);
  expect(warm.acActive).toBe(true);
  expect(warm.background).toBe(false);
  expect(warm.flow).toBeCloseTo(35.32, 2);
  const frost = probe(SETTINGS, withModelDefaults(), -8);
  expect(frost.background).toBe(true);
});


// The forecast hour by hour: the season, the flat cooling or warming, and the heat it needs.

const hoursFrom = (startUtc: string, temps: number[]): HhForecastHour[] =>
  temps.map((t_out, i) => ({ ts: new Date(Date.parse(startUtc) + i * 3_600_000).toISOString(), t_out }));
const DAY = '2026-11-02T07:00:00Z'; // Monday 08:00 in Berlin: no night window for 14 hours
const AT_TARGET = { seasonActive: true, windowMean: 10, indoor: 23 };
const away = (target = 17): HhSettings => ({ ...S, preset: 'away', targets: { ...S.targets, away: target } });
const season = (mode: 'on' | 'off'): HhSettings => ({ ...S, season: { ...S.season, mode } });

test('a flat held at its target costs what holding it costs', () => {
  const hours = hoursFrom(DAY, Array(12).fill(5));
  const rows = forecastRun(S, M, hours, TZ, AT_TARGET);
  const steady = probe(S, M, 5, { target: 23, night: false });
  expect(rows.every(r => r.heats && Math.abs(r.indoor - 23) < 1e-9)).toBe(true);
  expect(rows[0]!.electricKwh).toBeCloseTo(steady.electricKw, 9);
  expect(forecastTotals(S, M, hours, TZ, AT_TARGET).kwh).toBeCloseTo(12 * steady.electricKw, 9);
});

test('a warm flat cools down before the heating comes on', () => {
  const start = { seasonActive: true, windowMean: 10, indoor: 21 };
  const hours = hoursFrom(DAY, Array(40).fill(10));
  const rows = forecastRun(away(), M, hours, TZ, start);
  const first = rows.findIndex(r => r.heatKwh > 0);
  // free cooling towards 10° + 300 W / 150 W/K = 12° with 5.2 kWh/K: from 21° to 17° in about 20 hours
  expect(first).toBeGreaterThanOrEqual(18);
  expect(first).toBeLessThanOrEqual(22);
  expect(rows[first - 1]!.indoor).toBeGreaterThan(17);
  expect(rows.at(-1)!.indoor).toBeCloseTo(17, 9);
  const steady = probe(away(), M, 10, { target: 17, night: false }).electricKw * 40;
  expect(forecastTotals(away(), M, hours, TZ, start).kwh).toBeLessThan(steady * 0.6);
});

test('a cold flat warms up first, as fast as the heaters allow', () => {
  const rows = forecastRun(S, M, hoursFrom(DAY, Array(6).fill(10)), TZ, { seasonActive: true, windowMean: 10, indoor: 21 });
  expect(rows[0]!.heatKwh).toBeGreaterThan(probe(S, M, 10, { target: 23, night: false }).demandKw);
  expect(rows[0]!.indoor).toBeGreaterThan(21);
  expect(rows[0]!.indoor).toBeLessThan(23); // 2° for 5.2 kWh/K is more than the heaters give in an hour
  expect(rows[2]!.indoor).toBeCloseTo(23, 9);
});

test('out of the heating season nothing is heated', () => {
  const hours = hoursFrom(DAY, Array(6).fill(5));
  const rows = forecastRun(season('off'), M, hours, TZ, AT_TARGET);
  expect(rows.every(r => !r.heats && r.heatKwh === 0 && r.electricKwh === 0)).toBe(true);
  expect(forecastTotals(season('off'), M, hours, TZ, AT_TARGET)).toEqual({
    kwh: 0,
    cost: 0,
    boilerOnlyCost: 0,
    heatedHours: 0,
  });
});

test('the season over the forecast follows the core rule on a rolling mean', () => {
  const warmSpell = hoursFrom(DAY, [...Array(12).fill(10), ...Array(30).fill(25)]);
  expect(seasonByHour(season('on'), warmSpell, { seasonActive: false, windowMean: 25 }).every(Boolean)).toBe(true);
  expect(seasonByHour(season('off'), warmSpell, AT_TARGET).some(Boolean)).toBe(false);
  const auto = seasonByHour(S, warmSpell, { seasonActive: true, windowMean: 10 });
  expect(auto.indexOf(false)).toBe(18); // the 12 h mean passes 17° + 1° of hysteresis 7 hours into the warm spell
  expect(auto.slice(18).some(Boolean)).toBe(false);
  // no mean yet: the season stays as it is until 12 forecast hours make one
  const unknown = seasonByHour(S, hoursFrom(DAY, Array(14).fill(10)), { seasonActive: false, windowMean: null });
  expect(unknown.indexOf(true)).toBe(11);
});

test('the line for a tapped hour says what runs then', () => {
  const night = hoursFrom('2026-11-03T02:00:00Z', [-4.6]); // Tuesday 03:00 in Berlin: Comfort is Night then
  const row = forecastRun(S, M, night, TZ, { seasonActive: true, windowMean: 0, indoor: 22.5 })[0]!;
  expect(forecastHourLine(S, night[0]!, row, TZ, 'en')).toBe(
    `Tue 3, 03:00, −4.6°: zone “Frost”: both ACs · boiler main · 3 rods · flow ${fF(row.p.flow, 'en')} · ` +
      `about ${fmt(row.electricKwh, 1, 'en')} kW.`,
  );
  expect(forecastHourLine(S, night[0]!, row, TZ, 'ru')).toBe(
    `вт 3, 03:00, −4,6°: зона «Мороз»: оба кондиционера · котёл основной · 3 ТЭНа · подача ${fF(row.p.flow, 'ru')} · ` +
      `около ${fmt(row.electricKwh, 1, 'ru')} кВт.`,
  );
  const warm = hoursFrom(DAY, [10]);
  const coast = forecastRun(away(), M, warm, TZ, { seasonActive: true, windowMean: 10, indoor: 21 })[0]!;
  expect(forecastHourLine(away(), warm[0]!, coast, TZ, 'en')).toBe(
    `Mon 2, 08:00, ${fT(10, 'en')}: zone “Warm”: the flat cools to ${fmt(coast.indoor, 1, 'en')}°, no heating needed yet.`,
  );
  const off = forecastRun(season('off'), M, warm, TZ, AT_TARGET)[0]!;
  expect(forecastHourLine(season('off'), warm[0]!, off, TZ, 'en')).toBe(
    `Mon 2, 08:00, ${fT(10, 'en')}: out of the heating season, no heating.`,
  );
});
