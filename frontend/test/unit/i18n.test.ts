import { expect, test } from 'vitest';
import { en } from '../../src/i18n/en';
import { type I18nKey, pickLang, plural, t } from '../../src/i18n/index';
import { ru } from '../../src/i18n/ru';

const placeholders = (s: string) => [...s.matchAll(/{(\w+)}/g)].map(m => m[1]).sort();

test('pickLang', () => {
  expect(pickLang('ru')).toBe('ru');
  expect(pickLang('ru-RU')).toBe('ru');
  expect(pickLang('en-GB')).toBe('en');
  expect(pickLang('uk')).toBe('en');
  expect(pickLang(undefined)).toBe('en');
});

test('ru: no empty strings, same placeholders as en', () => {
  for (const k of Object.keys(en) as I18nKey[]) {
    expect(ru[k], k).not.toBe('');
    expect(placeholders(ru[k]), k).toEqual(placeholders(en[k]));
  }
});

test('plural rods', () => {
  expect(plural('ru', 'rods', 1)).toBe('1 ТЭН');
  expect(plural('ru', 'rods', 2)).toBe('2 ТЭНа');
  expect(plural('ru', 'rods', 5)).toBe('5 ТЭНов');
  expect(plural('en', 'rods', 1)).toBe('1 rod');
  expect(plural('en', 'rods', 3)).toBe('3 rods');
  expect(plural('ru', 'hours', 21)).toBe('21 час');
});

test('interpolation', () => {
  expect(t('ru', 'zone.title', { name: 'Тепло' })).toBe('Зона «Тепло»');
  expect(t('en', 'zone.title', { name: 'Warm' })).toBe('Zone “Warm”');
});
