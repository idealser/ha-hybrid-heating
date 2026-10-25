import { expect, test } from 'vitest';
import { bgCurveSegments, clampPointFlow, flowFor, nudgePoint, rawCurve, setPointFlow } from '../../src/logic/curve';
import { CURVE_TEMPS, type HhSettings } from '../../src/types';
import { SETTINGS } from '../fixtures';

const C = SETTINGS.curve;
const withZone1 = (s: HhSettings, rooms: ('living' | 'bedroom')[]): HhSettings => {
  const policies = structuredClone(s.zones.policies);
  policies[1].ac_rooms = rooms;
  return { ...s, zones: { ...s.zones, policies } };
};

test('nine points every 5° from +20 to −20', () => {
  expect(C.points.map(p => p[0])).toEqual([...CURVE_TEMPS]);
  expect(C.points.map(p => p[1])).toEqual([28, 34, 39.5, 44.5, 49.5, 54, 58, 62, 66]);
});

test('points and interpolation (same numbers as core/curve.py)', () => {
  expect(rawCurve(C, 0)).toBe(49.5);
  expect(rawCurve(C, -10)).toBe(58);
  expect(rawCurve(C, 13.8)).toBeCloseTo(35.32, 2);
  expect(rawCurve(C, -8)).toBeCloseTo(56.4, 2);
  expect(rawCurve(C, 25)).toBe(28);
  expect(rawCurve(C, -25)).toBe(66);
  expect(rawCurve({ ...C, shift: 2 }, 0)).toBe(51.5);
});

test('clamp, background shift, correction', () => {
  expect(flowFor(C, -20, { acActive: false, hybrid: true })).toBe(65);
  expect(flowFor(C, 20, { acActive: false, hybrid: true })).toBe(30);
  expect(flowFor(C, 0, { acActive: true, hybrid: true })).toBe(46.5);
  expect(flowFor(C, 0, { acActive: true, hybrid: false })).toBe(49.5);
  expect(flowFor(C, 0, { acActive: false, hybrid: true, correction: 2.5 })).toBe(52);
});

test('point drag rounds to 0.5 within 15..85 and does not mutate', () => {
  expect(clampPointFlow(41.26)).toBe(41.5);
  expect(clampPointFlow(90)).toBe(85);
  expect(clampPointFlow(10)).toBe(15);
  expect(nudgePoint(C, 2, 0.5).points[2]).toEqual([10, 40]);
  expect(C.points[2]).toEqual([10, 39.5]);
  expect(setPointFlow(C, 8, 70).points[8]).toEqual([-20, 70]);
  expect(setPointFlow(C, 8, 70).points).toHaveLength(9);
});

test('background curve: one run +7.75..−15 by default (Cool and Frost), only Frost when Cool has no ACs', () => {
  const seg = bgCurveSegments(SETTINGS);
  expect(seg).toHaveLength(1);
  expect(seg[0]![0]![0]).toBe(7.75); // Warm (+8 and above) has the boiler as backup: no shift there
  expect(seg[0]!.at(-1)![0]).toBe(-15);
  const frostOnly = bgCurveSegments(withZone1(SETTINGS, []));
  expect(frostOnly).toHaveLength(1);
  expect(frostOnly[0]![0]![0]).toBe(-3.25);
  expect(bgCurveSegments({ ...SETTINGS, hybrid: false })).toEqual([]);
  expect(bgCurveSegments({ ...SETTINGS, curve: { ...C, ac_background_shift: 0 } })).toEqual([]);
});

test('the background curve runs only where the boiler is the main heat, as in the core', () => {
  // defaults: warm zone (above +8) has the boiler as backup, cool and frost as main, severe frost has no ACs
  const runs = bgCurveSegments(SETTINGS);
  expect(runs).toHaveLength(1);
  expect(runs[0]![0]![0]).toBeLessThan(8);
  expect(runs[0]!.at(-1)![0]).toBe(-15);
});
