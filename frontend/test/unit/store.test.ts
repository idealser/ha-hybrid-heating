import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { HhApi } from '../../src/api';
import { t } from '../../src/i18n/index';
import { mergeSettings } from '../../src/logic/draft';
import { CardStore } from '../../src/store';
import { createMockHass, type MockOptions } from '../mock-hass';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const mk = (o: MockOptions = {}) => {
  const h = createMockHass(o);
  const notes: string[] = [];
  let changes = 0;
  const st = new CardStore(new HhApi(() => h), {
    lang: () => 'en',
    notify: m => notes.push(m),
    onChange: () => (changes += 1),
  });
  return { h, st, notes, changes: () => changes };
};
const count = (h: ReturnType<typeof createMockHass>, type: string) => h.calls.filter(c => c.type === type).length;

test('start loads everything; stage 5 missing leaves nulls', async () => {
  const { st, changes } = mk({ stage5: false });
  await st.start();
  expect(st.view.phase).toBe('ready');
  expect(st.view.forecast).toBeNull();
  expect(st.view.suggestions).toBeNull();
  expect(st.view.log).toHaveLength(6);
  expect(st.view.status!.zone).toBe(0);
  expect(st.view.dirty).toBe(false);
  expect(changes()).toBeGreaterThan(0);
  st.stop();
});

test('with stage 5 the forecast and suggestions load', async () => {
  const { st } = mk();
  await st.start();
  expect(st.view.forecast!.hours).toHaveLength(48);
  expect(st.view.suggestions!.length).toBeGreaterThan(0);
  st.stop();
});

test('the uploaded floor plan loads with everything else; none stored → null', async () => {
  const plan = { version: 1, custom: true };
  const { st } = mk({ plan });
  await st.start();
  expect(st.view.plan).toEqual(plan);
  const other = mk();
  await other.st.start();
  expect(other.st.view.plan).toBeNull();
  st.stop();
  other.st.stop();
});

test('an unsaved point edit survives applying a curve suggestion, and Save keeps both', async () => {
  const { h, st } = mk();
  await st.start();
  const draft = mergeSettings(st.view.draft!, {});
  draft.curve.points[0] = [20, 29];
  st.edit(draft);
  await st.applySuggestion('curve10');
  expect(st.view.draft!.curve.points[0]).toEqual([20, 29]);
  expect(st.view.draft!.curve.points[2]).toEqual([10, 41]);
  await st.save();
  expect(st.view.saved!.curve.points[0]).toEqual([20, 29]);
  expect(st.view.saved!.curve.points[2]).toEqual([10, 41]);
  expect(h.calls.filter(c => c.type === 'hybrid_heating/set_config')).toHaveLength(1);
  st.stop();
});

test('the plan is read again after an upload', async () => {
  const { h, st } = mk();
  await st.start();
  await h.callWS({ type: 'hybrid_heating/set_plan', plan: { version: 1, mine: true } });
  await st.reloadPlan();
  expect(st.view.plan).toEqual({ version: 1, mine: true });
  st.stop();
});

test('no backend → error phase with the setup hint', async () => {
  const { st } = mk({ backend: false });
  await st.start();
  expect(st.view.phase).toBe('error');
  expect(st.view.error).toBe(t('en', 'error.not_set_up'));
});

test('revision bump refetches config and keeps the draft', async () => {
  const { h, st } = mk();
  await st.start();
  st.edit(mergeSettings(st.view.draft!, { curve: { shift: 2 } }));
  h.bumpConfig({ targets: { eco: 21 } });
  await st.poll();
  expect(st.view.saved!.targets.eco).toBe(21);
  expect(st.view.draft!.targets.eco).toBe(21);
  expect(st.view.draft!.curve.shift).toBe(2);
  expect(st.view.dirty).toBe(true);
  st.stop();
});

test('a new estimate refetches the config, which carries the heat model', async () => {
  const { h, st } = mk();
  await st.start();
  await st.poll();
  const loaded = count(h, 'hybrid_heating/get_config');
  h.statusPatch = s => ({ ...s, seq: { ...s.seq, suggestions: s.seq.suggestions + 1 } });
  await st.poll();
  expect(count(h, 'hybrid_heating/get_config')).toBe(loaded + 1);
  await st.poll();
  expect(count(h, 'hybrid_heating/get_config')).toBe(loaded + 1);
  st.stop();
});

test('log is refetched only when seq.log changes', async () => {
  const { h, st } = mk();
  await st.start();
  await st.poll();
  expect(count(h, 'hybrid_heating/get_log')).toBe(1);
  h.bumpLog();
  await st.poll();
  expect(count(h, 'hybrid_heating/get_log')).toBe(2);
  expect(st.view.log).toHaveLength(7);
  st.stop();
});

test('polls on a timer while the page is visible', async () => {
  const { h, st } = mk();
  await st.start();
  const before = count(h, 'hybrid_heating/get_status');
  await vi.advanceTimersByTimeAsync(15_000);
  expect(count(h, 'hybrid_heating/get_status')).toBe(before + 1);
  st.stop();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(count(h, 'hybrid_heating/get_status')).toBe(before + 1);
});

test('the forecast is read again every 30 minutes', async () => {
  const { h, st } = mk();
  await st.start();
  expect(count(h, 'hybrid_heating/get_forecast')).toBe(1);
  await vi.advanceTimersByTimeAsync(29 * 60_000);
  expect(count(h, 'hybrid_heating/get_forecast')).toBe(1);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(count(h, 'hybrid_heating/get_forecast')).toBe(2);
  st.stop();
});

test('a failing forecast, suggestions or plan does not stop the card, and is tried again', async () => {
  const { h, st } = mk();
  const broken = { code: 'home_assistant_error', message: 'no weather entity' };
  h.failOn = {
    'hybrid_heating/get_forecast': broken,
    'hybrid_heating/get_suggestions': broken,
    'hybrid_heating/get_plan': broken,
  };
  await st.start();
  expect(st.view.phase).toBe('ready');
  expect(st.view.forecast).toBeUndefined();
  expect(st.view.suggestions).toBeUndefined();
  expect(st.view.plan).toBeNull();
  h.failOn = {};
  await st.poll();
  expect(st.view.forecast!.hours).toHaveLength(48);
  expect(st.view.suggestions!.length).toBe(2);
  st.stop();
});

test('a card that loaded while the module was not ready yet retries by itself', async () => {
  const { h, st } = mk();
  h.failOn = { 'hybrid_heating/get_config': { code: 'not_loaded', message: 'not loaded' } };
  await st.start();
  expect(st.view.phase).toBe('error');
  expect(st.view.error).toBe(t('en', 'error.not_loaded'));
  h.failOn = {};
  await vi.advanceTimersByTimeAsync(15_000);
  expect(st.view.phase).toBe('ready');
  st.stop();
});

test('a second start keeps the draft and only resumes polling', async () => {
  const { h, st } = mk();
  await st.start();
  st.edit(mergeSettings(st.view.draft!, { curve: { shift: 2 } }));
  st.stop();
  await st.start();
  expect(count(h, 'hybrid_heating/get_config')).toBe(1);
  expect(st.view.draft!.curve.shift).toBe(2);
  st.stop();
});

test('save sends the diff and clears dirty', async () => {
  const { h, st, notes } = mk();
  await st.start();
  st.edit(mergeSettings(st.view.draft!, { curve: { shift: 2 } }));
  expect(st.view.dirty).toBe(true);
  await st.save();
  expect(h.calls.filter(c => c.type === 'hybrid_heating/set_config').at(-1)).toEqual({
    type: 'hybrid_heating/set_config',
    settings: { curve: { shift: 2 } },
  });
  expect(st.view.dirty).toBe(false);
  expect(st.view.saved!.curve.shift).toBe(2);
  expect(notes.at(-1)).toBe(t('en', 'saved'));
  st.stop();
});

test('save error keeps the draft and notifies', async () => {
  const { h, st, notes } = mk();
  await st.start();
  st.edit(mergeSettings(st.view.draft!, { curve: { flow_min: 45 } }));
  h.failNext = { code: 'invalid_config', message: 'flow_min must be below flow_max' };
  await st.save();
  expect(st.view.dirty).toBe(true);
  expect(st.view.saving).toBe(false);
  expect(st.view.draft!.curve.flow_min).toBe(45);
  expect(notes.at(-1)).toContain('flow_min must be below flow_max');
  st.stop();
});

test('discard goes back to the saved settings', async () => {
  const { st } = mk();
  await st.start();
  st.edit(mergeSettings(st.view.draft!, { curve: { shift: 2 } }));
  st.discard();
  expect(st.view.dirty).toBe(false);
  expect(st.view.draft).toEqual(st.view.saved);
  st.stop();
});

test('preset and hybrid go through their entities', async () => {
  const { h, st } = mk();
  await st.start();
  await st.setPreset('eco');
  await st.setHybrid(false);
  expect(h.services).toEqual([
    { domain: 'select', service: 'select_option', data: { entity_id: 'select.hybrid_heating_preset', option: 'eco' } },
    { domain: 'switch', service: 'turn_off', data: { entity_id: 'switch.hybrid_heating_hybrid_mode' } },
  ]);
  st.stop();
});

test('feedback is acknowledged; without stage 5 nothing is said', async () => {
  const { h, st, notes } = mk();
  await st.start();
  await st.feedback('child', 'cold');
  expect(h.calls.at(-1)).toEqual({ type: 'hybrid_heating/feedback', room: 'child', kind: 'cold', language: 'en' });
  expect(notes.at(-1)).toBe("Noted: child's room, cold");
  const old = mk({ stage5: false });
  await old.st.start();
  await old.st.feedback('child', 'hot');
  expect(old.notes).toEqual([]);
  st.stop();
  old.st.stop();
});

test('applying a suggestion rebases the draft and refetches suggestions', async () => {
  const { h, st, notes } = mk();
  await st.start();
  st.edit(mergeSettings(st.view.draft!, { curve: { shift: 2 } }));
  await st.applySuggestion('curve10');
  expect(st.view.saved!.curve.points[2]).toEqual([10, 41]);
  expect(st.view.draft!.curve.points[2]).toEqual([10, 41]);
  expect(st.view.draft!.curve.shift).toBe(2);
  expect(st.view.suggestions!.find(s => s.id === 'curve10')!.state).toBe('applied');
  expect(notes.at(-1)).toBe('Applied: Raise the +10° point from 39.5° to 41°');
  expect(count(h, 'hybrid_heating/get_log')).toBe(2);
  await st.dismissSuggestion('hloss');
  expect(st.view.suggestions!.find(s => s.id === 'hloss')!.state).toBe('dismissed');
  expect(count(h, 'hybrid_heating/get_suggestions')).toBe(3);
  st.stop();
});


test('errors the integration answers with are said in the card\'s words', async () => {
  const { h, st, notes } = mk();
  await st.start();
  h.failNext = { code: 'not_ready', message: 'The module has not decided anything yet' };
  await st.feedback('child', 'cold');
  expect(notes.at(-1)).toBe(t('en', 'error.not_ready'));
  h.failNext = { code: 'stale', message: 'The setting was changed since; the suggestion is withdrawn' };
  await st.applySuggestion('curve10');
  expect(notes.at(-1)).toBe(t('en', 'error.stale'));
  h.failNext = { code: 'not_found', message: 'No such suggestion: curve10' };
  await st.dismissSuggestion('curve10');
  expect(notes.at(-1)).toBe(t('en', 'error.not_found'));
  h.failNext = { code: 'unauthorized', message: 'Unauthorized' };
  await st.dismissSuggestion('curve10');
  expect(notes.at(-1)).toBe(t('en', 'error.unauthorized'));
  h.failNext = { code: 'timeout', message: 'no answer' };
  await st.dismissSuggestion('curve10');
  expect(notes.at(-1)).toBe(t('en', 'error.generic', { message: 'no answer' }));
  st.stop();
});

test('a weather entity without an hourly forecast says so, and is asked again every 30 minutes', async () => {
  const { h, st } = mk();
  h.failOn = { 'hybrid_heating/get_forecast': { code: 'forecast_unavailable', message: 'weather.home: no forecast' } };
  await st.start();
  expect(st.view.forecast).toEqual({ source: '', updated: '', hours: [], unavailable: true });
  const asked = count(h, 'hybrid_heating/get_forecast');
  await vi.advanceTimersByTimeAsync(5 * 60_000); // 20 polls
  expect(count(h, 'hybrid_heating/get_forecast')).toBe(asked);
  await vi.advanceTimersByTimeAsync(30 * 60_000);
  expect(count(h, 'hybrid_heating/get_forecast')).toBeGreaterThan(asked);
  st.stop();
});

test('a mark that leads to a suggestion says so', async () => {
  const { h, st, notes } = mk();
  await st.start();
  h.feedbackSuggestion = {
    id: 'fb:child:cold@2026-10-25T15:00+01:00',
    kind: 'feedback',
    state: 'new',
    created: '2026-10-25T15:00:00+01:00',
    title: "Child's room: raise its target by 0.3°",
    detail: '',
  };
  await st.feedback('child', 'cold');
  expect(notes.at(-1)).toBe(
    t('en', 'feedback.toast_suggestion', {
      room: t('en', 'room_low.child'),
      kind: t('en', 'feedback.kind.cold'),
      title: "Child's room: raise its target by 0.3°",
    }),
  );
  st.stop();
});
