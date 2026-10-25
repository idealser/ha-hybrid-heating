import { expect, test } from 'vitest';
import {
  bgCurvePath,
  boundFromPx,
  chartGeom,
  curvePath,
  pointHitRadius,
  pointLabelVisible,
  snapProbe,
} from '../../src/logic/chart-geometry';
import { CURVE_TEMPS, type PointIndex } from '../../src/types';
import { SETTINGS } from '../fixtures';

test('geometry matches the mockup at 640 px', () => {
  const g = chartGeom(640);
  expect([g.H, g.L, g.R, g.T, g.B, g.sy, g.sh]).toEqual([390, 40, 624, 30, 298, 328, 34]);
  expect(g.x(20)).toBe(40);
  expect(g.x(-20)).toBe(624);
  expect(g.y(75)).toBe(30);
  expect(g.y(25)).toBe(298);
  expect(g.tx(g.x(7.5))).toBeCloseTo(7.5);
  expect(g.fy(g.y(41))).toBeCloseTo(41);
  expect(chartGeom(400).H).toBe(340);
  expect(chartGeom(200).W).toBe(300);
  expect(chartGeom(0).W).toBe(640);
});

test('curve path has 161 points and starts at +20', () => {
  const g = chartGeom(640);
  const d = curvePath(SETTINGS, g);
  expect(d.split('L')).toHaveLength(161);
  expect(d.startsWith(`M40.0 ${g.y(30).toFixed(1)}`)).toBe(true); // 28° at +20 is held up by "at least 30°"
});

test('background curve runs only where an AC zone is and hybrid is on', () => {
  const g = chartGeom(640);
  expect(bgCurvePath(SETTINGS, g).startsWith(`M${g.x(7.75).toFixed(1)}`)).toBe(true); // below the warm zone
  expect(bgCurvePath({ ...SETTINGS, hybrid: false }, g)).toBe('');
});

test('snapProbe and boundFromPx', () => {
  expect(snapProbe(13.8)).toBe(14);
  expect(snapProbe(-25)).toBe(-20);
  expect(snapProbe(7.26)).toBe(7.5);
  const g = chartGeom(640);
  expect(boundFromPx(g.x(8.4), g)).toBe(8);
});

test('nine points fit at desktop and phone width', () => {
  const wide = chartGeom(640);
  const narrow = chartGeom(360);
  expect(pointHitRadius(wide)).toBe(16);
  expect(pointHitRadius(narrow)).toBeLessThan((narrow.R - narrow.L) / 8 / 2);
  expect(pointHitRadius(chartGeom(300))).toBeLessThan((chartGeom(300).R - chartGeom(300).L) / 8 / 2);
  expect(CURVE_TEMPS.map((_, i) => pointLabelVisible(i as PointIndex, wide, null)).every(Boolean)).toBe(true);
  expect(pointLabelVisible(1, narrow, null)).toBe(false);
  expect(pointLabelVisible(2, narrow, null)).toBe(true);
  expect(pointLabelVisible(1, narrow, 1)).toBe(true);
});
