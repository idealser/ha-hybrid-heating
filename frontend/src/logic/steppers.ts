// The −/+ controls: ranges, steps and the pairs that keep each other apart.
import type { HhSettings } from '../types';
import { mergeSettings } from './draft';

export type StepperKey =
  | 'curve.flow_min'
  | 'curve.flow_max'
  | 'curve.ac_background_shift'
  | 'targets.comfort'
  | 'targets.night'
  | 'targets.eco'
  | 'targets.away'
  | 'boiler.classic_coldest_tolerance'
  | 'load.limit_kw'
  | 'load.restore_kw'
  | 'season.threshold'
  | 'season.window_hours'
  | 'season.hysteresis';

export const STEPPERS: Record<StepperKey, { min: number; max: number; step: number }> = {
  'curve.flow_min': { min: 20, max: 45, step: 1 },
  'curve.flow_max': { min: 50, max: 80, step: 1 },
  'curve.ac_background_shift': { min: 0, max: 8, step: 1 },
  'targets.comfort': { min: 18, max: 26, step: 0.1 },
  'targets.night': { min: 16, max: 26, step: 0.1 },
  'targets.eco': { min: 16, max: 26, step: 0.1 },
  'targets.away': { min: 10, max: 20, step: 0.5 },
  'boiler.classic_coldest_tolerance': { min: 0.3, max: 2, step: 0.1 },
  'load.limit_kw': { min: 6, max: 10, step: 0.5 },
  'load.restore_kw': { min: 3, max: 9.5, step: 0.5 },
  'season.threshold': { min: 10, max: 22, step: 0.5 },
  'season.window_hours': { min: 1, max: 48, step: 1 },
  'season.hysteresis': { min: 0.5, max: 3, step: 0.5 },
};

const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function getAt(s: HhSettings, key: StepperKey): number {
  const [group, field] = key.split('.') as [keyof HhSettings, string];
  return (s[group] as unknown as Record<string, number>)[field]!;
}

function setAt(s: HhSettings, key: StepperKey, v: number): HhSettings {
  const [group, field] = key.split('.') as [string, string];
  return mergeSettings(s, { [group]: { [field]: v } } as never);
}

/** One step up or down, kept in range; limit/restore stay 0.5 kW apart and flow min/max 5° apart. */
export function stepSetting(s: HhSettings, key: StepperKey, dir: -1 | 1): HhSettings {
  const c = STEPPERS[key];
  let v = clamp(round2(getAt(s, key) + dir * c.step), c.min, c.max);
  if (key === 'load.restore_kw') v = Math.min(v, round2(s.load.limit_kw - 0.5));
  if (key === 'curve.flow_min') v = Math.min(v, s.curve.flow_max - 5);
  if (key === 'curve.flow_max') v = Math.max(v, s.curve.flow_min + 5);
  let next = setAt(s, key, v);
  if (key === 'load.limit_kw') next = setAt(next, 'load.restore_kw', Math.min(s.load.restore_kw, round2(v - 0.5)));
  return next;
}

/** The parallel shift of the whole curve: whole degrees within ±10. */
export function setShift(s: HhSettings, v: number): HhSettings {
  return mergeSettings(s, { curve: { shift: clamp(Math.round(v), -10, 10) } });
}
