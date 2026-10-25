import { expect, test } from 'vitest';
import { mergeSettings } from '../../src/logic/draft';
import { getAt, setShift, STEPPERS, stepSetting } from '../../src/logic/steppers';
import { SETTINGS } from '../fixtures';

const S = SETTINGS;

test('ranges from the mockup and the stage decisions', () => {
  expect(STEPPERS['targets.comfort']).toEqual({ min: 18, max: 26, step: 0.1 });
  expect(STEPPERS['load.restore_kw']).toEqual({ min: 3, max: 9.5, step: 0.5 });
  expect(STEPPERS['curve.ac_background_shift']).toEqual({ min: 0, max: 8, step: 1 });
  expect(STEPPERS['season.threshold']).toEqual({ min: 10, max: 22, step: 0.5 });
  expect(STEPPERS['targets.away']).toEqual({ min: 10, max: 20, step: 0.5 });
});

test('0.1 steps stay exact', () => {
  expect(stepSetting(S, 'targets.comfort', 1).targets.comfort).toBe(23.1);
  expect(getAt(S, 'targets.night')).toBe(22.5);
});

test('steps stop at the range', () => {
  let s = S;
  for (let i = 0; i < 100; i++) s = stepSetting(s, 'targets.comfort', 1);
  expect(s.targets.comfort).toBe(26);
});

test('lowering the limit pulls restore down', () => {
  let s = S;
  for (let i = 0; i < 10; i++) s = stepSetting(s, 'load.limit_kw', -1);
  expect(s.load.limit_kw).toBe(6);
  expect(s.load.restore_kw).toBe(5.5);
});

test('restore never reaches the limit', () => {
  let s = S;
  for (let i = 0; i < 10; i++) s = stepSetting(s, 'load.restore_kw', 1);
  expect(s.load.restore_kw).toBe(7.5);
});

test('flow min and max stay 5° apart', () => {
  const s = mergeSettings(S, { curve: { flow_min: 45, flow_max: 50 } });
  expect(stepSetting(s, 'curve.flow_min', 1).curve.flow_min).toBe(45);
  expect(stepSetting(s, 'curve.flow_max', -1).curve.flow_max).toBe(50);
});

test('shift is whole degrees within ±10', () => {
  expect(setShift(S, 3.4).curve.shift).toBe(3);
  expect(setShift(S, -14).curve.shift).toBe(-10);
  expect(S.curve.shift).toBe(0);
});
