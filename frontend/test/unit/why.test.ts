import { expect, test } from 'vitest';
import { mergeSettings } from '../../src/logic/draft';
import { acOffReason, buildWhy } from '../../src/logic/why';
import type { HhReason, HhStatus } from '../../src/types';
import { SETTINGS, STATUS_FROST, STATUS_NOW, STATUS_NULLS, TZ } from '../fixtures';

// Every layer in control: why states facts. Under observe it says what the module would do.
const LIVE = mergeSettings(SETTINGS, { layers: { boiler: 'active', ac: 'active', load: 'active' } });

const offAcs = (st: HhStatus): HhStatus['acs'] => ({
  living: { ...st.acs.living, hvac: 'off', owned: false },
  bedroom: { ...st.acs.bedroom, hvac: 'off', owned: false },
});
const reason = (layer: string, code: string, data: Record<string, unknown> = {}): HhReason => ({
  layer,
  code,
  data,
  text: code,
});

test('now scenario, ru, as in the mockup', () => {
  const w = buildWhy(STATUS_NOW, LIVE, 'ru');
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
      text: 'подача 36° (кривая 35°, поправка по комнатам +0,4°). Котёл следит за комнатой дальше всех от цели — спальня, 22,8°.',
    },
    { pip: 'ok', lead: 'Нагрузка в норме:', text: 'запас 6,7 кВт до лимита.' },
  ]);
});

test('now scenario, en', () => {
  const w = buildWhy(STATUS_NOW, LIVE, 'en');
  expect(w.sub).toBe('Outside +13.8°: zone “Warm”. Target 23.0° (comfort).');
  expect(w.items[0]).toEqual({
    pip: 'ac',
    lead: 'ACs are heating',
    text: 'the living room (23.3°) and the bedroom (22.8°) to 23.0°.',
  });
  expect(w.items[1]!.text).toBe(
    'flow 36° (curve 35°, room correction +0.4°). The boiler follows the room furthest below its target: bedroom, 22.8°.',
  );
});

test('the room the boiler follows is named with its own reading, not the offset-shifted number', () => {
  // the child's room reads 21.6°; with its −1° offset the core compares 22.6° with 23.0°
  const st = { ...STATUS_NOW, rooms: { ...STATUS_NOW.rooms, child: 21.6 }, driver: { mode: 'coldest', room: 'child', temp: 22.6 } } as HhStatus;
  expect(buildWhy(st, LIVE, 'en').items[1]!.text).toContain("the room furthest below its target: child's room, 21.6°");
});

test('frost: the ACs take some of the flow', () => {
  const w = buildWhy(STATUS_FROST, LIVE, 'ru');
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
  const s = mergeSettings(LIVE, { ac: { night: { living: 'off' } } });
  const w = buildWhy(st, s, 'ru');
  expect(w.items[0]).toEqual({
    pip: 'ac',
    lead: 'Кондиционер греет',
    text: 'спальню (22,8°) до 22,5°. Тихий режим: кондиционер в спальне.',
  });
  expect(w.items).toContainEqual({ pip: 'idle', lead: 'Гостиная:', text: 'кондиционер выключен на ночь.' });
});

test('AC night modes also apply with Eco inside the night window, like the core', () => {
  const st = { ...STATUS_NOW, now: '2026-10-25T22:30:00Z', effective_preset: 'eco', acs: offAcs(STATUS_NOW) } as HhStatus;
  const s = mergeSettings(LIVE, { preset: 'eco', ac: { night: { living: 'off' } } });
  expect(acOffReason('living', st, s, TZ)).toBe('night');
  expect(acOffReason('living', { ...st, now: '2026-10-25T14:05:00Z' } as HhStatus, s, TZ)).toBe('idle');
});

test('hybrid off: ACs off, boiler follows the average', () => {
  const st = {
    ...STATUS_NOW,
    acs: offAcs(STATUS_NOW),
    driver: { mode: 'average', room: null, temp: 22.9 },
    background_shift: 0,
  } as HhStatus;
  const w = buildWhy(st, { ...LIVE, hybrid: false }, 'ru');
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
  expect(acOffReason('living', off, mergeSettings(SETTINGS, { layers: { ac: 'off' } }))).toBe('layer_off');
  expect(acOffReason('living', off, active)).toBe('idle');
  const held = { ...off, reasons: [reason('ac', 'ac_manual_hold', { room: 'living' })] } as HhStatus;
  expect(acOffReason('living', held, active)).toBe('hand_off');
  expect(acOffReason('bedroom', held, active)).toBe('idle');
  const cooling = { ...off, acs: { ...off.acs, living: { ...off.acs.living, hvac: 'cool' } } } as HhStatus;
  expect(acOffReason('living', cooling, active)).toBe('manual');
  expect(buildWhy(cooling, active, 'en').items).toContainEqual({
    pip: 'idle',
    lead: 'Living room:',
    text: 'the AC runs by hand in cooling mode.',
  });
  expect(buildWhy(off, SETTINGS, 'en').items[0]).toEqual({
    pip: 'idle',
    lead: 'ACs are off:',
    text: 'the module only observes them.',
  });
  expect(buildWhy(held, active, 'en').items).toContainEqual({
    pip: 'idle',
    lead: 'Living room:',
    text: 'switched off by hand; it stays off until the preset changes.',
  });
});

test('ACs the module does not run are shown as run by hand, with their own setpoint', () => {
  expect(buildWhy(STATUS_NOW, SETTINGS, 'en').items[0]).toEqual({
    pip: 'ac',
    lead: 'ACs run by hand',
    text: 'living room (23.3°, set to 24°) and bedroom (22.8°, set to 24°).',
  });
  expect(buildWhy(STATUS_NOW, SETTINGS, 'ru').items[0]).toEqual({
    pip: 'ac',
    lead: 'Кондиционеры включены вручную',
    text: 'гостиная (23,3°, уставка 24°) и спальня (22,8°, уставка 24°).',
  });
  const quietByHand = { ...STATUS_NOW, acs: { ...STATUS_NOW.acs, bedroom: { ...STATUS_NOW.acs.bedroom, quiet: true } } } as HhStatus;
  expect(buildWhy(quietByHand, SETTINGS, 'en').items[0]!.text).not.toContain('Quiet');
});

test('classic mode waiting', () => {
  const s = mergeSettings(LIVE, { boiler: { mode: 'classic' } });
  const st = { ...STATUS_NOW, boiler: { ...STATUS_NOW.boiler, call_on: false, wanted: false } } as HhStatus;
  expect(buildWhy(st, s, 'ru').items).toContainEqual({
    pip: 'idle',
    lead: 'Котёл ждёт.',
    text: 'Самая холодная — спальня, 22,8°. Включится ниже 22,2°.',
  });
});

test('classic mode compares each room with its own target (the child is 1° cooler)', () => {
  const s = mergeSettings(LIVE, { boiler: { mode: 'classic' } });
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
  const s = mergeSettings(LIVE, { boiler: { mode: 'classic' } });
  const st = { ...STATUS_NOW, rooms: { ...STATUS_NOW.rooms, bedroom: 22.0 } } as HhStatus;
  expect(buildWhy(st, s, 'ru').items).toContainEqual({
    pip: 'heat',
    lead: 'Котёл греет',
    text: 'с подачей 36°, ТЭНов до 2. Самая холодная — спальня, 22,0°: ниже порога 22,2°.',
  });
});

test('smooth mode paused, and the boiler off in the zone', () => {
  const paused = { ...STATUS_NOW, boiler: { ...STATUS_NOW.boiler, call_on: false, wanted: false } } as HhStatus;
  expect(buildWhy(paused, LIVE, 'ru').items[1]).toEqual({
    pip: 'idle',
    lead: 'Котёл на паузе:',
    text: 'комнаты были теплее цели больше чем на 0,5°; снова включится, когда превышение станет меньше 0,2°. Котёл следит за комнатой дальше всех от цели — спальня, 22,8°.',
  });
  const s = mergeSettings(LIVE, {});
  s.zones.policies[0] = { ...s.zones.policies[0]!, boiler: 'off' };
  expect(buildWhy(paused, s, 'ru').items[1]).toEqual({ pip: 'idle', lead: 'Котёл выключен', text: 'в этой зоне.' });
});

test('a pause for the season or the load says so, not "rooms too warm"', () => {
  const off = { ...STATUS_NOW, season_active: false, boiler: { ...STATUS_NOW.boiler, wanted: false } } as HhStatus;
  expect(buildWhy(off, LIVE, 'ru').items[1]).toEqual({ pip: 'idle', lead: 'Не отопительный сезон:', text: 'котёл не греет.' });
  expect(buildWhy(off, SETTINGS, 'ru').items[1]).toEqual({
    pip: 'idle',
    lead: 'Не отопительный сезон:',
    text: 'модуль не включал бы котёл.',
  });
  const load = { ...STATUS_NOW, reasons: [reason('load', 'pause_boiler')], boiler: { ...STATUS_NOW.boiler, wanted: false } } as HhStatus;
  expect(buildWhy(load, LIVE, 'ru').items[1]).toEqual({
    pip: 'cold',
    lead: 'Пауза из-за нагрузки:',
    text: 'котёл ждёт 20 с, пока нагрузка выше лимита.',
  });
});

test('load near the limit, over it, and back under it', () => {
  const near = { ...STATUS_NOW, load: { ...STATUS_NOW.load, kw: 7.3 } } as HhStatus;
  expect(buildWhy(near, LIVE, 'ru').items.at(-1)).toEqual({
    pip: 'cold',
    lead: 'Нагрузка близко к лимиту:',
    text: '7,3 из 8,0 кВт. При превышении первыми отключатся бойлер и ТЭН.',
  });
  const hold = { ...STATUS_NOW, load: { ...STATUS_NOW.load, kw: 8.3 } } as HhStatus;
  expect(buildWhy(hold, LIVE, 'ru').items.at(-1)).toEqual({
    pip: 'cold',
    lead: 'Нагрузка выше лимита:',
    text: '8,3 из 8,0 кВт: если продержится 5 с, начнётся отключение.',
  });
  const over = {
    ...STATUS_NOW,
    load: { ...STATUS_NOW.load, kw: 8.6, water_heater_shed: true, rods_shed: 1, shedding: true },
  } as HhStatus;
  expect(buildWhy(over, LIVE, 'ru').items.at(-1)).toEqual({
    pip: 'cold',
    lead: 'Нагрузка выше лимита:',
    text: '8,6 из 8,0 кВт. Отключено: бойлер, 1 ТЭН.',
  });
  const back = { ...over, load: { ...over.load, kw: 4.0 } } as HhStatus;
  expect(buildWhy(back, LIVE, 'ru').items.at(-1)).toEqual({
    pip: 'ok',
    lead: 'Нагрузка снова в норме:',
    text: 'возврат после 10 мин ниже 6,0 кВт: бойлер, 1 ТЭН.',
  });
  const pauseOnly = { ...over, load: { ...over.load, water_heater_shed: false, rods_shed: 0 } } as HhStatus;
  expect(buildWhy(pauseOnly, LIVE, 'ru').items.at(-1)!.text).toBe('8,6 из 8,0 кВт. Отключено: котёл (пауза).');
});

test('nulls: no NaN, backend reason shown once', () => {
  const st = { ...STATUS_NULLS, reasons: [...STATUS_NULLS.reasons, { ...reason('ac', 'ac_unavailable', { room: 'bedroom' }), text: 'Bedroom: AC unavailable' }] } as HhStatus;
  const w = buildWhy(st, LIVE, 'en');
  expect(JSON.stringify(w)).not.toMatch(/NaN|undefined|null/);
  expect(w.sub).toContain('—');
  expect(w.chips[2]).toEqual({ label: 'Load', value: '— / 8.0 kW' });
  expect(w.items.map(i => i.text)).toContain(STATUS_NULLS.reasons[0]!.text);
  expect(w.items.map(i => i.text)).not.toContain('Bedroom: AC unavailable'); // already said by the AC line
  expect(w.items).toContainEqual({ pip: 'idle', lead: 'Load:', text: 'no meter reading.' });
});

test('in control, why follows the module, not the device', () => {
  const st = { ...STATUS_NOW, boiler: { ...STATUS_NOW.boiler, call_on: false, wanted: true } } as HhStatus;
  expect(buildWhy(st, LIVE, 'en').items[1]!.lead).toBe('Radiators stay warm:');
  const off = { ...STATUS_NOW, boiler: { ...STATUS_NOW.boiler, call_on: true, wanted: false } } as HhStatus;
  expect(buildWhy(off, LIVE, 'en').items[1]!.lead).toBe('The boiler is paused:');
});

test('observe: why says what the module would do, not what happens', () => {
  expect(buildWhy(STATUS_NOW, SETTINGS, 'en').items[1]).toEqual({
    pip: 'heat',
    lead: 'Would keep the radiators warm:',
    text: 'flow 36° (curve 35°, room correction +0.4°). It would follow the room furthest below its target: bedroom, 22.8°.',
  });
  expect(buildWhy(STATUS_NOW, SETTINGS, 'ru').items[1]).toEqual({
    pip: 'heat',
    lead: 'Держал бы радиаторы тёплыми:',
    text: 'подача 36° (кривая 35°, поправка по комнатам +0,4°). Котёл следил бы за комнатой дальше всех от цели — спальня, 22,8°.',
  });
  const paused = { ...STATUS_NOW, boiler: { ...STATUS_NOW.boiler, wanted: false } } as HhStatus;
  expect(buildWhy(paused, SETTINGS, 'en').items[1]!.lead).toBe('Would pause the boiler:');
  const classic = mergeSettings(SETTINGS, { boiler: { mode: 'classic' } });
  expect(buildWhy(STATUS_NOW, classic, 'en').items[1]!.lead).toBe('Would heat with the boiler');
  expect(buildWhy(paused, classic, 'en').items[1]!.lead).toBe('The boiler would wait.');
  expect(buildWhy(STATUS_NOW, SETTINGS, 'en').chips[0]).toEqual({ label: 'Module flow', value: '36°' });
});

test('observe: shedding is what the module would switch off', () => {
  const over = {
    ...STATUS_NOW,
    load: { ...STATUS_NOW.load, kw: 8.6, water_heater_shed: true, rods_shed: 1, shedding: true },
  } as HhStatus;
  expect(buildWhy(over, SETTINGS, 'ru').items.at(-1)).toEqual({
    pip: 'cold',
    lead: 'Нагрузка выше лимита:',
    text: '8,6 из 8,0 кВт. Отключил бы: бойлер, 1 ТЭН.',
  });
});

test('before the first decision why says the module is starting', () => {
  const st = {
    ...STATUS_NOW,
    decided: false,
    flow_target: null,
    curve_flow: null,
    reasons: [],
    boiler: { ...STATUS_NOW.boiler, wanted: null, call_on: false },
  } as HhStatus;
  const w = buildWhy(st, LIVE, 'en');
  expect(w.items[1]).toEqual({
    pip: 'idle',
    lead: 'Starting:',
    text: 'the module makes its first decision within a couple of minutes.',
  });
  expect(JSON.stringify(w)).not.toMatch(/paused|NaN|undefined/);
});
