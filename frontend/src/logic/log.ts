// Decision-log entries as the card lists them: a colour, a time and two lines of text.
import { t, type Lang } from '../i18n/index';
import type { HhLogEntry, Pip } from '../types';
import { localTime } from './context';

const PIPS: Record<string, Pip> = {};
const codes: [Pip, string[]][] = [
  ['heat', ['smooth_on', 'smooth_resumed', 'classic_on_avg', 'classic_on_coldest', 'feedback_hot']],
  [
    'idle',
    [
      'smooth_paused',
      'smooth_overheat_wait',
      'classic_off',
      'ac_stopped',
      'ac_manual_left_alone',
      'ac_manual_off',
      'ac_manual_hold',
      'season_idle',
      'zone_boiler_off',
    ],
  ],
  [
    'cold',
    [
      'shed_water_heater',
      'shed_rod',
      'pause_boiler',
      'rods_budget_exhausted',
      'outdoor_unavailable',
      'rooms_unavailable',
      'ac_not_coping',
      'ac_unavailable',
      'load_unknown',
      'feedback_cold',
      'tick_failed',
      'failsafe',
    ],
  ],
  [
    'ok',
    ['restore_rod', 'restore_water_heater', 'season_started', 'season_ended', 'settings_changed', 'suggestion_applied'],
  ],
];
for (const [pip, list] of codes) for (const code of list) PIPS[code] = pip;
const BY_LAYER: Record<string, Pip> = { ac: 'ac', boiler: 'heat', load: 'ok' };

/** The colour of an entry: a failed command first, then its first reason's code, else that reason's layer. */
export function logPip(e: HhLogEntry): Pip {
  if (e.actions.some(a => a.status === 'failed')) return 'cold';
  const r = e.reasons[0];
  if (!r) return 'idle';
  return PIPS[r.code] ?? BY_LAYER[r.layer] ?? 'idle';
}

/** Today's entries show the time, older ones the date; `full` is both, for the tooltip. */
export function logTime(ts: string, now: string, tz: string, lang: Lang): { short: string; full: string } {
  const at = localTime(ts, tz);
  const locale = lang === 'en' ? 'en-GB' : lang; // day before month, like the rest of the card
  const date = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: tz }).format(new Date(ts));
  return { short: at.dateKey === localTime(now, tz).dateKey ? at.hhmm : date, full: `${date}, ${at.hhmm}` };
}

/** The first reason is the headline; the others, and commands that did not go through, the detail line. */
export function logLines(e: HhLogEntry, lang: Lang = 'en'): { title: string; detail: string } {
  const [first, ...rest] = e.reasons;
  const parts = rest.map(r => r.text);
  const failed = e.actions.filter(a => a.status === 'failed').length;
  const skipped = e.actions.filter(a => a.status === 'skipped').length;
  if (failed) parts.push(t(lang, 'log.failed', { n: failed }));
  if (skipped) parts.push(t(lang, 'log.skipped', { n: skipped }));
  return { title: first?.text ?? '', detail: parts.join(' · ') };
}
