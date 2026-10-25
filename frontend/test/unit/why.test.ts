import { expect, test } from 'vitest';
import { mergeSettings } from '../../src/logic/draft';
import { acOffReason, buildWhy } from '../../src/logic/why';
import type { HhStatus } from '../../src/types';
import { SETTINGS, STATUS_FROST, STATUS_NOW, STATUS_NULLS } from '../fixtures';

const offAcs = (st: HhStatus): HhStatus['acs'] => ({
  living: { ...st.acs.living, hvac: 'off', owned: false },
  bedroom: { ...st.acs.bedroom, hvac: 'off', owned: false },
});

test('now scenario, ru, as in the mockup', () => {
  const w = buildWhy(STATUS_NOW, SETTINGS, 'ru');
  expect(w.sub).toBe('На улице +13,8°: зона «Тепло». Цель 23,0° (комфорт).');
  expect(w.chips).toEqual([
    { label: 'Подача', value: '36°' },
    { label: 'ТЭНов до', value: '2' },
    { label: 'Нагрузка', value: '1,3 / 8,0 кВт' },
  ]);
  expect(w.items).toEqual([
    { pip: 'ac', lead: 'Кондиционеры греют', text: 'гостиную (23,3°) и спальню (22,8°) до 23,0°.' },
    {
      pip: 'heat',
      lead: 'Радиаторы тёплые постоянно:',
      text: 'подача 36° (кривая 35°, поправка по комнатам +0,4°). Котёл следит за самой холодной комнатой — спальня, 22,8°.',
    },
    { pip: 'ok', lead: 'Нагрузка в норме:', text: 'запас 6,7 кВт до лимита.' },
  ]);
});

test('now scenario, en', () => {
  const w = buildWhy(STATUS_NOW, SETTINGS, 'en');
  expect(w.sub).toBe('Outside +13.8°: zone “Warm”. Target 23.0° (comfort).');
  expect(w.items[0]).toEqual({
    pip: 'ac',
    lead: 'ACs are heating',
    text: 'the living room (23.3°) and the bedroom (22.8°) to 23.0°.',
  });
  expect(w.items[1]!.text).toBe(
    'flow 36° (curve 35°, room correction +0.4°). The boiler follows the coldest room: bedroom, 22.8°.',
  );
});

test('frost: the ACs take some of the flow', () => {
  const w = buildWhy(STATUS_FROST, SETTINGS, 'ru');
  expect(w.items[1]!.text).toBe(
    'подача 54° (кривая 56°, кондиционеры греют: −3°, поправка по комнатам +0,5°). Котёл следит за средней по комнатам — 22,4°.',
  );
});

test('one AC off for the night', () => {
  const st = {
    ...STATUS_NOW,
    effective_preset: 'night',
    target: 22.5,
    acs: { ...STATUS_NOW.acs, living: { ...STATUS_NOW.acs.living, hvac: 'off' }, bedroom: { ...STATUS_NOW.acs.bedroom, quiet: true } },
  } as HhStatus;
  const s = mergeSettings(SETTINGS, { ac: { night: { living: 'off' } } });
  const w = buildWhy(st, s, 'ru');
  expect(w.items[0]).toEqual({
    pip: 'ac',
    lead: 'Кондиционер греет',
    text: 'спальню (22,8°) до 22,5°. Тихий режим: кондиционер в спальне.',
  });
  expect(w.items).toContainEqual({ pip: 'idle', lead: 'Гостиная:', text: 'кондиционер выключен на ночь.' });
});

test('hybrid off: ACs off, boiler follows the average', () => {
  const st = {
    ...STATUS_NOW,
    acs: offAcs(STATUS_NOW),
    driver: { mode: 'average', room: null, temp: 22.9 },
    background_shift: 0,
  } as HhStatus;
  const w = buildWhy(st, { ...SETTINGS, hybrid: false }, 'ru');
  expect(w.items[0]).toEqual({ pip: 'idle', lead: 'Кондиционеры выключены:', text: 'гибридный режим выключен.' });
  expect(w.items[1]!.text).toContain('за средней по комнатам — 22,9°');
});

test('why an AC is off', () => {
  const off = { ...STATUS_NOW, acs: offAcs(STATUS_NOW) } as HhStatus;
  const active = mergeSettings(SETTINGS, { layers: { ac: 'active' } });
  expect(acOffReason('living', off, { ...active, hybrid: false })).toBe('hybrid');
  expect(acOffReason('living', { ...off, effective_preset: 'away' } as HhStatus, active)).toBe('away');
  expect(acOffReason('living', { ...off, t_out: -18 } as HhStatus, active)).toBe('cold');
  const noLiving = mergeSettings(active, {});
  noLiving.zones.policies[0] = { ...noLiving.zones.policies[0]!, ac_rooms: ['bedroom'] };
  expect(acOffReason('living', off, noLiving)).toBe('zone');
  const night = mergeSettings(active, { ac: { night: { living: 'off' } } });
  expect(acOffReason('living', { ...off, effective_preset: 'night' } as HhStatus, night)).toBe('night');
  expect(acOffReason('bedroom', STATUS_NULLS, active)).toBe('unavailable');
  expect(acOffReason('living', off, SETTINGS)).toBe('observe');
  expect(acOffReason('living', off, active)).toBe('idle');
  expect(buildWhy(off, SETTINGS, 'en').items[0]).toEqual({
    pip: 'idle',
    lead: 'ACs are off:',
    text: 'the module only observes them.',
  });
});

test('classic mode waiting', () => {
  const s = mergeSettings(SETTINGS, { boiler: { mode: 'classic' } });
  const st = { ...STATUS_NOW, boiler: { ...STATUS_NOW.boiler, call_on: false } } as HhStatus;
  expect(buildWhy(st, s, 'ru').items).toContainEqual({
    pip: 'idle',
    lead: 'Котёл ждёт.',
    text: 'Самая холодная — спальня, 22,8°. Включится ниже 22,2°.',
  });
});

test('classic mode compares each room with its own target (the child is 1° cooler)', () => {
  const s = mergeSettings(SETTINGS, { boiler: { mode: 'classic' } });
  const child = { ...STATUS_NOW, rooms: { ...STATUS_NOW.rooms, child: 20.9 } } as HhStatus;
  expect(buildWhy(child, s, 'ru').items[1]).toEqual({
    pip: 'heat',
    lead: 'Котёл греет',
    text: 'с подачей 36°, ТЭНов до 2. Самая холодная — детская, 20,9°: ниже порога 21,2°.',
  });
  const avg = { ...STATUS_NOW, rooms: { ...STATUS_NOW.rooms, living: 22.5, bedroom: 22.6, child: 21.8 } } as HhStatus;
  expect(buildWhy(avg, s, 'ru').items[1]!.text).toBe('с подачей 36°, ТЭНов до 2. Средняя по комнатам 22,3° ниже цели 22,7°.');
});

test('classic mode heating for the coldest room', () => {
  const s = mergeSettings(SETTINGS, { boiler: { mode: 'classic' } });
  const st = { ...STATUS_NOW, rooms: { ...STATUS_NOW.rooms, bedroom: 22.0 } } as HhStatus;
  expect(buildWhy(st, s, 'ru').items).toContainEqual({
    pip: 'heat',
    lead: 'Котёл греет',
    text: 'с подачей 36°, ТЭНов до 2. Самая холодная — спальня, 22,0°: ниже порога 22,2°.',
  });
});

test('smooth mode paused, and the boiler off in the zone', () => {
  const paused = { ...STATUS_NOW, boiler: { ...STATUS_NOW.boiler, call_on: false } } as HhStatus;
  expect(buildWhy(paused, SETTINGS, 'ru').items[1]).toEqual({
    pip: 'idle',
    lead: 'Котёл на паузе:',
    text: 'комнаты теплее цели больше чем на 0,5°. Котёл следит за самой холодной комнатой — спальня, 22,8°.',
  });
  const s = mergeSettings(SETTINGS, {});
  s.zones.policies[0] = { ...s.zones.policies[0]!, boiler: 'off' };
  expect(buildWhy(paused, s, 'ru').items[1]).toEqual({ pip: 'idle', lead: 'Котёл выключен', text: 'в этой зоне.' });
});

test('load near the limit, and over it', () => {
  const near = { ...STATUS_NOW, load: { ...STATUS_NOW.load, kw: 7.3 } } as HhStatus;
  expect(buildWhy(near, SETTINGS, 'ru').items.at(-1)).toEqual({
    pip: 'cold',
    lead: 'Нагрузка близко к лимиту:',
    text: '7,3 из 8,0 кВт. Первым отключится бойлер.',
  });
  const over = {
    ...STATUS_NOW,
    load: { ...STATUS_NOW.load, kw: 8.6, water_heater_shed: true, rods_shed: 1, shedding: true },
  } as HhStatus;
  expect(buildWhy(over, SETTINGS, 'ru').items.at(-1)).toEqual({
    pip: 'cold',
    lead: 'Нагрузка выше лимита:',
    text: '8,6 из 8,0 кВт. Отключено: бойлер, 1 ТЭН.',
  });
});

test('nulls: no NaN, backend reason shown', () => {
  const w = buildWhy(STATUS_NULLS, SETTINGS, 'en');
  expect(JSON.stringify(w)).not.toMatch(/NaN|undefined|null/);
  expect(w.sub).toContain('—');
  expect(w.chips[2]).toEqual({ label: 'Load', value: '— / 8.0 kW' });
  expect(w.items.map(i => i.text)).toContain(STATUS_NULLS.reasons[0]!.text);
  expect(w.items).toContainEqual({ pip: 'idle', lead: 'Load:', text: 'no meter reading.' });
});

test('banners: observe, disabled and off season', () => {
  expect(buildWhy(STATUS_NOW, SETTINGS, 'ru').banners).toEqual([
    'Только наблюдение: котёл, кондиционеры, нагрузка. Решения пишутся в журнал, но ничего не меняется.',
  ]);
  const live = mergeSettings(SETTINGS, { layers: { boiler: 'active', ac: 'observe', load: 'active' } });
  expect(buildWhy(STATUS_NOW, live, 'en').banners).toEqual([
    'Observe only: ACs. Decisions go to the log, nothing is changed.',
  ]);
  const activeAll = mergeSettings(SETTINGS, { layers: { boiler: 'active', ac: 'active', load: 'active' } });
  expect(buildWhy(STATUS_NOW, activeAll, 'en').banners).toEqual([]);
  expect(buildWhy({ ...STATUS_NOW, season_active: false }, SETTINGS, 'ru').banners).toContain(
    'Не отопительный сезон: модуль только показывает данные.',
  );
  expect(buildWhy({ ...STATUS_NOW, enabled: false }, activeAll, 'en').banners).toEqual([
    'The module is off: the heating runs without it.',
  ]);
});
