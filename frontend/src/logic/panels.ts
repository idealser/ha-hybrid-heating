// Small derived values for the rooms, load and season sections.
import { t, type Lang } from '../i18n/index';
import type { HhSettings, HhStatus } from '../types';
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

/** What load shedding has switched off right now, or null when nothing is. */
export function shedNow(st: HhStatus, lang: Lang): string | null {
  const l = st.load;
  if (!l.shedding) return null;
  const what = [l.water_heater_shed ? t(lang, 'why.water_heater') : null];
  if (l.rods_shed > 0) what.push(t(lang, 'load.shed_rods', { n: l.rods_shed }));
  return t(lang, 'load.shedding_now', { what: what.filter(Boolean).join(', ') });
}
