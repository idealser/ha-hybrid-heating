// The settings draft: merge, diff and rebase, the same way the integration merges a patch.
import type { DeepPartial, HhSettings, Preset } from '../types';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}

function merge(base: unknown, changes: unknown): unknown {
  if (!isObject(base) || !isObject(changes)) return structuredClone(changes);
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(changes)) out[k] = isObject(v) && isObject(base[k]) ? merge(base[k], v) : structuredClone(v);
  return out;
}

/** Objects merge key by key; arrays and values are replaced whole. The inputs are not changed. */
export function mergeSettings(base: HhSettings, changes: DeepPartial<HhSettings>): HhSettings {
  return merge(structuredClone(base), changes) as HhSettings;
}

function diff(saved: unknown, draft: unknown): Json | undefined {
  if (deepEqual(saved, draft)) return undefined;
  if (isObject(saved) && isObject(draft)) {
    const out: Record<string, Json> = {};
    for (const k of Object.keys(draft)) {
      const d = diff(saved[k], draft[k]);
      if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return structuredClone(draft) as Json;
}

/** Only the changed leaves (arrays whole). Preset and hybrid go through their entities, not the draft. */
export function diffSettings(saved: HhSettings, draft: HhSettings): DeepPartial<HhSettings> {
  const d = (diff({ ...saved, preset: null, hybrid: null }, { ...draft, preset: null, hybrid: null }) ?? {}) as Record<
    string,
    Json
  >;
  return d as DeepPartial<HhSettings>;
}

export function isDirty(saved: HhSettings, draft: HhSettings): boolean {
  return Object.keys(diffSettings(saved, draft)).length > 0;
}

/**
 * Three-way merge: where the draft differs from the settings it started from, the draft wins; everywhere
 * else the newer settings do. Arrays of the same length (curve points, zone bounds and policies) merge
 * element by element, so a point dragged here and another point changed by a suggestion both survive.
 */
function rebase(base: unknown, next: unknown, draft: unknown): unknown {
  if (deepEqual(base, draft)) return structuredClone(next);
  if (isObject(base) && isObject(next) && isObject(draft)) {
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(next), ...Object.keys(draft)])) {
      const v = rebase(base[k], next[k], draft[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (Array.isArray(base) && Array.isArray(next) && Array.isArray(draft)) {
    if (base.length === next.length && base.length === draft.length)
      return draft.map((d, i) => rebase(base[i], next[i], d));
  }
  return structuredClone(draft);
}

/** Unsaved edits carried over onto settings that changed elsewhere (another tab, a suggestion). */
export function rebaseDraft(oldSaved: HhSettings, newSaved: HhSettings, draft: HhSettings): HhSettings {
  return rebase(oldSaved, newSaved, draft) as HhSettings;
}

/** The draft with the live preset and hybrid mode from their entities, when they are known. */
export function withLive(draft: HhSettings, live: { hybrid: boolean | null; preset: Preset | null }): HhSettings {
  return {
    ...draft,
    hybrid: live.hybrid ?? draft.hybrid,
    preset: live.preset ?? draft.preset,
  };
}
