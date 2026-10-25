import { expect, test } from 'vitest';
import { normalizeConfig, SECTION_KEYS } from '../../src/logic/config';

test('normalizeConfig', () => {
  expect(normalizeConfig({ type: 'custom:hybrid-heating-card' })).toEqual({
    type: 'custom:hybrid-heating-card',
    hide_sections: [],
  });
  expect(normalizeConfig({ type: 'x', hide_sections: ['log', 'log'] }).hide_sections).toEqual(['log']);
  expect(() => normalizeConfig({ type: 'x', hide_sections: ['nope'] })).toThrow('Unknown section: nope');
  expect(() => normalizeConfig({ type: 'x', hide_sections: 'log' })).toThrow('hide_sections must be a list');
  expect(() => normalizeConfig(null)).toThrow('Invalid configuration');
});

test('tariff, currency and title are checked', () => {
  const c = normalizeConfig({ type: 'x', title: 'Flat', tariff_per_kwh: 0.3, currency: '¤' });
  expect(c).toEqual({ type: 'x', title: 'Flat', tariff_per_kwh: 0.3, currency: '¤', hide_sections: [] });
  expect(() => normalizeConfig({ type: 'x', tariff_per_kwh: -1 })).toThrow('tariff_per_kwh');
  expect(() => normalizeConfig({ type: 'x', tariff_per_kwh: '4' })).toThrow('tariff_per_kwh');
  expect(() => normalizeConfig({ type: 'x', currency: 5 })).toThrow('currency');
});

test('sections in layout order', () => {
  expect(SECTION_KEYS).toEqual([
    'plan',
    'why',
    'forecast',
    'curve',
    'probe',
    'zone',
    'rooms',
    'load',
    'season',
    'suggestions',
    'log',
  ]);
});
