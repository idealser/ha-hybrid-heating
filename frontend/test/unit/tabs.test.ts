import { expect, test } from 'vitest';
import { SECTION_KEYS } from '../../src/logic/config';
import { mergeSettings } from '../../src/logic/draft';
import { diffSettings } from '../../src/logic/draft';
import { dirtyTabs, firstSentence, statusLine, TABS, visibleTabs } from '../../src/logic/tabs';
import type { HhStatus } from '../../src/types';
import { SETTINGS, STATUS_NOW } from '../fixtures';

test('every section is on exactly one tab, in the planned order', () => {
  const placed = TABS.flatMap(tab => tab.rows.flatMap(r => r.cols.flat()));
  expect([...placed].sort()).toEqual([...SECTION_KEYS].sort());
  expect(TABS.map(t => t.key)).toEqual(['now', 'curve', 'rooms', 'system']);
  expect(TABS[0]!.rows.flatMap(r => r.cols.flat())).toEqual(['plan', 'why', 'forecast']);
});

test('a tab whose sections are all hidden disappears', () => {
  expect(visibleTabs([])).toEqual(['now', 'curve', 'rooms', 'system']);
  expect(visibleTabs(['rooms', 'load'])).toEqual(['now', 'curve', 'system']);
  expect(visibleTabs(['plan', 'why', 'forecast'])).toEqual(['curve', 'rooms', 'system']);
});

test('unsaved edits mark the tab they were made on', () => {
  const edit = (changes: Parameters<typeof mergeSettings>[1]) => dirtyTabs(diffSettings(SETTINGS, mergeSettings(SETTINGS, changes)));
  expect(edit({})).toEqual(new Set());
  expect(edit({ curve: { shift: 2 } })).toEqual(new Set(['curve']));
  expect(edit({ zones: { bounds: [9, -3, -15] }, boiler: { mode: 'classic' } })).toEqual(new Set(['curve']));
  expect(edit({ targets: { eco: 21 }, boiler: { classic_coldest_tolerance: 1 } })).toEqual(new Set(['rooms']));
  expect(edit({ load: { limit_kw: 7 }, ac: { night: { living: 'off' } } })).toEqual(new Set(['rooms']));
  expect(edit({ layers: { boiler: 'active' }, season: { mode: 'on' } })).toEqual(new Set(['system']));
});

test('the status line under the title says who is in control', () => {
  expect(statusLine(STATUS_NOW, SETTINGS, 'en')).toEqual({ text: 'Observing — nothing is changed', tone: 'warn' });
  expect(statusLine(STATUS_NOW, SETTINGS, 'ru').text).toBe('Наблюдение — ничего не меняется');
  const mixed = mergeSettings(SETTINGS, { layers: { boiler: 'active', ac: 'observe', load: 'active' } });
  expect(statusLine(STATUS_NOW, mixed, 'en')).toEqual({ text: 'In control: boiler, load · observing: ACs', tone: 'ok' });
  const all = mergeSettings(SETTINGS, { layers: { boiler: 'active', ac: 'active', load: 'active' } });
  expect(statusLine(STATUS_NOW, all, 'ru').text).toBe('Управляет: котёл, кондиционеры, нагрузка');
  const off = mergeSettings(SETTINGS, { layers: { boiler: 'off', ac: 'off', load: 'off' } });
  expect(statusLine(STATUS_NOW, off, 'en')).toEqual({ text: 'All layers are off', tone: 'idle' });
  expect(statusLine({ ...STATUS_NOW, season_active: false }, all, 'en')).toEqual({
    text: 'Not the heating season: the module only shows data.',
    tone: 'idle',
  });
  expect(statusLine({ ...STATUS_NOW, enabled: false } as HhStatus, all, 'en')).toEqual({
    text: 'The module is off: the heating runs without it.',
    tone: 'warn',
  });
  expect(statusLine(null, SETTINGS, 'en').text).toBe('Observing — nothing is changed');
});

test('long explanations shrink to their first sentence', () => {
  expect(firstSentence('One. Two three. Four.')).toEqual({ first: 'One.', rest: true });
  expect(firstSentence('Only one sentence here.')).toEqual({ first: 'Only one sentence here.', rest: false });
  expect(firstSentence('Ветер 5 м/с. Дальше')).toEqual({ first: 'Ветер 5 м/с.', rest: true });
  expect(firstSentence('Режим «Отъезд» включён. Дальше')).toEqual({ first: 'Режим «Отъезд» включён.', rest: true });
  expect(firstSentence('Outside +13.8°: zone “Warm”. Target 23.0° (comfort).')).toEqual({
    first: 'Outside +13.8°: zone “Warm”.',
    rest: true,
  });
});
