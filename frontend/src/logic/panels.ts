// Small derived values for the rooms, load and season sections.
import { t, type Lang } from '../i18n/index';
import type { HassEntity, HhSettings, HhStatus } from '../types';
import { DASH, fDev } from './format';

/** Fill and limit mark as percentages of the scale; "hi" when less than 2 kW is left. */
export function loadMeter(kw: number | null, limit: number, scale = 10): { fill: number; hi: boolean; mark: number } {
  const pct = (v: number) => Math.round(Math.min(100, Math.max(0, (v / scale) * 100)) * 10) / 10;
  return { fill: kw === null ? 0 : pct(kw), hi: kw !== null && limit - kw < 2, mark: pct(limit) };
}

export function seasonStatus(st: HhStatus, s: HhSettings, lang: Lang): string {
  const mean = st.t_out_window_mean;
  return t(lang, st.season_active ? 'season.on' : 'season.off', {
    hours: s.season.window_hours,
    t: mean === null ? DASH : `${fDev(mean, lang)}°`,
  });
}

/** What load shedding has switched off right now (observing: what it would have), or null. */
export function shedNow(st: HhStatus, s: HhSettings, lang: Lang): string | null {
  const l = st.load;
  if (!l.shedding) return null;
  const what: string[] = [];
  if (l.water_heater_shed) what.push(t(lang, 'why.water_heater'));
  if (l.rods_shed > 0) what.push(t(lang, 'load.shed_rods', { n: l.rods_shed }));
  if (!what.length) what.push(t(lang, 'why.boiler_paused_word'));
  const key = s.layers.load === 'active' ? 'load.shedding_now' : 'load.shedding_obs';
  return t(lang, key, { what: what.join(', ') });
}

/** The old thermostat's target when it differs from the module's (>= 0.5°): worth a word before Control. */
export function thermostatGap(entity: HassEntity | undefined, target: number): { thermostat: number; target: number } | null {
  const value = entity?.attributes?.temperature;
  if (!entity || entity.state === 'off' || typeof value !== 'number') return null;
  return Math.abs(value - target) >= 0.5 ? { thermostat: value, target } : null;
}
