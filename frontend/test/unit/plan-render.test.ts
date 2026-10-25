import { expect, test } from 'vitest';
import { acFlowPaths, deviceStates, glowRect, pointsAttr, roomTint } from '../../src/logic/plan-render';
import { SCHEMATIC } from '../../src/plan/builtin';
import type { HhStatus } from '../../src/types';
import { STATUS_NOW, STATUS_NULLS } from '../fixtures';

test('room tint follows the mockup formula', () => {
  expect(roomTint(0.3)).toEqual({ tone: 'heat', opacity: 0.15 });
  expect(roomTint(-0.4)).toEqual({ tone: 'cold', opacity: 0.24 });
  expect(roomTint(2)).toEqual({ tone: 'heat', opacity: 0.45 });
  expect(roomTint(-2)).toEqual({ tone: 'cold', opacity: 0.55 });
  expect(roomTint(0)).toEqual({ tone: 'heat', opacity: 0.1 });
  expect(roomTint(null)).toEqual({ tone: null, opacity: 0 });
});

test('airflow: three curves from the unit into the room', () => {
  const p = acFlowPaths({ x: 2050, y: 345, w: 900, h: 210, cx: 2500, from: 555, to: 1645 });
  expect(p).toHaveLength(3);
  expect(p[1]).toBe('M2500 615 C2280 991 2720 1372.5 2500 1645');
  expect(p[0]).toBe('M2200 615 C1980 991 2420 1372.5 2200 1645');
  // blowing up the plan: the curve starts 60 above the unit
  expect(acFlowPaths(SCHEMATIC.acs.bedroom!)[1]).toBe('M11150 3980 C10930 3600 11370 3215 11150 2940');
});

test('points and glow', () => {
  expect(pointsAttr([[0, 0], [10, 5.5]])).toBe('0,0 10,5.5');
  expect(glowRect({ x: 100, y: 200, w: 50, h: 1000 })).toEqual({ x: -60, y: 40, w: 370, h: 1320 });
});

test('the built-in schematic has the four rooms, both ACs and four radiators', () => {
  expect(Object.keys(SCHEMATIC.rooms).sort()).toEqual(['bath', 'bedroom', 'child', 'living']);
  expect(Object.keys(SCHEMATIC.acs).sort()).toEqual(['bedroom', 'living']);
  expect(SCHEMATIC.radiators).toHaveLength(4);
  expect(SCHEMATIC.rooms.bedroom.label[0]).toBeGreaterThan(SCHEMATIC.rooms.living.label[0]);
});

test('devices: ACs heat when available and in heat; radiators when the boiler is called in season', () => {
  expect(deviceStates(STATUS_NOW)).toEqual({ acOn: { living: true, bedroom: true }, heatOn: true });
  expect(deviceStates(STATUS_NULLS)).toEqual({ acOn: { living: true, bedroom: false }, heatOn: true });
  expect(deviceStates({ ...STATUS_NOW, season_active: false } as HhStatus).heatOn).toBe(false);
  expect(deviceStates(null)).toEqual({ acOn: { living: false, bedroom: false }, heatOn: false });
});
