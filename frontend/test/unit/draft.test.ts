import { expect, test } from 'vitest';
import { diffSettings, isDirty, mergeSettings, rebaseDraft, withLive } from '../../src/logic/draft';
import { SETTINGS } from '../fixtures';

const S = SETTINGS;

test('diff: changed leaves and whole arrays only', () => {
  const d = mergeSettings(S, { curve: { flow_min: 32 }, zones: { bounds: [7, -3, -15] } });
  expect(diffSettings(S, d)).toEqual({ curve: { flow_min: 32 }, zones: { bounds: [7, -3, -15] } });
  expect(diffSettings(S, mergeSettings(S, { ac: { night: { bedroom: 'off' } } }))).toEqual({
    ac: { night: { bedroom: 'off' } },
  });
  const policies = structuredClone(S.zones.policies);
  policies[2].max_rods = 1;
  expect(diffSettings(S, mergeSettings(S, { zones: { policies } }))).toEqual({ zones: { policies } });
});

test('diff ignores live-only fields', () => {
  expect(diffSettings(S, { ...S, preset: 'eco', hybrid: false })).toEqual({});
});

test('rebase keeps unsaved edits over a newer saved config', () => {
  const draft = mergeSettings(S, { curve: { shift: 2 } });
  const newer = mergeSettings(S, { preset: 'eco', targets: { eco: 21 } });
  const r = rebaseDraft(S, newer, draft);
  expect(r.curve.shift).toBe(2);
  expect(r.targets.eco).toBe(21);
  expect(r.preset).toBe('eco');
  expect(isDirty(newer, r)).toBe(true);
  expect(isDirty(S, S)).toBe(false);
});

test('live values from the entities override the draft', () => {
  const r = withLive(S, { hybrid: false, preset: 'night' });
  expect(r.hybrid).toBe(false);
  expect(r.preset).toBe('night');
  expect(withLive(S, { hybrid: null, preset: null })).toEqual(S);
});

test('merge does not mutate', () => {
  const copy = structuredClone(S);
  mergeSettings(S, { curve: { shift: 3 } });
  expect(S).toEqual(copy);
});

test('rebase keeps an edited curve point and takes another point changed elsewhere', () => {
  const draft = mergeSettings(SETTINGS, {});
  draft.curve.points[0] = [20, 29];
  const next = mergeSettings(SETTINGS, {});
  next.curve.points[2] = [10, 41];
  const r = rebaseDraft(SETTINGS, next, draft);
  expect(r.curve.points[0]).toEqual([20, 29]);
  expect(r.curve.points[2]).toEqual([10, 41]);
  expect(diffSettings(next, r)).toEqual({ curve: { points: r.curve.points } });
});

test('rebase per zone: an edited boundary and a policy changed elsewhere both stay', () => {
  const draft = mergeSettings(SETTINGS, { zones: { bounds: [9, -3, -15] } });
  const next = mergeSettings(SETTINGS, {});
  next.zones.policies[2] = { ...next.zones.policies[2], max_rods: 2 };
  const r = rebaseDraft(SETTINGS, next, draft);
  expect(r.zones.bounds).toEqual([9, -3, -15]);
  expect(r.zones.policies[2].max_rods).toBe(2);
});

test('rebase: the same element changed on both sides keeps the draft', () => {
  const draft = mergeSettings(SETTINGS, {});
  draft.curve.points[2] = [10, 40];
  const next = mergeSettings(SETTINGS, {});
  next.curve.points[2] = [10, 41];
  expect(rebaseDraft(SETTINGS, next, draft).curve.points[2]).toEqual([10, 40]);
});
