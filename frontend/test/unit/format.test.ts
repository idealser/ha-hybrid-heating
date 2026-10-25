import { expect, test } from 'vitest';
import { fDev, fF, fKw, fmt, fT } from '../../src/logic/format';

test('fmt: decimal mark by language, true minus, no negative zero', () => {
  expect(fmt(23, 1, 'ru')).toBe('23,0');
  expect(fmt(23, 1, 'en')).toBe('23.0');
  expect(fmt(-3.26, 1, 'ru')).toBe('−3,3');
  expect(fmt(-0.04, 1, 'en')).toBe('0.0');
  expect(fmt(0.04, 0, 'en')).toBe('0');
});

test('outdoor and flow temperatures', () => {
  expect(fT(13.8, 'ru')).toBe('+13,8°');
  expect(fT(-15, 'en')).toBe('−15°');
  expect(fT(0, 'en')).toBe('0°');
  expect(fT(7.96, 'en')).toBe('+8°');
  expect(fF(39.5, 'ru')).toBe('39,5°');
  expect(fF(50, 'en')).toBe('50°');
  expect(fF(49.996, 'en')).toBe('50°');
  expect(fKw(1.3, 'ru')).toBe('1,3 кВт');
  expect(fKw(1.3, 'en')).toBe('1.3 kW');
  expect(fDev(-0.4, 'en')).toBe('−0.4');
  expect(fDev(0.3, 'ru')).toBe('+0,3');
  expect(fDev(0, 'ru')).toBe('+0,0');
});
