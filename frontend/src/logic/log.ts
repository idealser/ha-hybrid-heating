// Decision-log entries as the card lists them: a colour, a time and two lines of text.
import type { Lang } from '../i18n/index';
import type { HhLogEntry, Pip } from '../types';
import { localTime } from './context';

const PIPS: Record<string, Pip> = {};
const codes: [Pip, string[]][] = [
  ['heat', ['smooth_on', 'smooth_resumed', 'classic_on_avg', 'classic_on_coldest', 'feedback_hot']],
  ['idle', ['smooth_paused', 'smooth_overheat_wait', 'classic_off', 'ac_stopped', 'ac_manual_left_alone']],
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

/** The colour of an entry: by its first reason's code, else by that reason's layer. */
export function logPip(e: HhLogEntry): Pip {
  const r = e.reasons[0];
  if (!r) return 'idle';
  return PIPS[r.code] ?? BY_LAYER[r.layer] ?? 'idle';
}

/** Today's entries show the time, older ones the date; `full` is both, for the tooltip. */
export function logTime(ts: string, now: string, tz: string, lang: Lang): { short: string; full: string } {
  const at = localTime(ts, tz);
  const date = new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', timeZone: tz }).format(new Date(ts));
  return { short: at.dateKey === localTime(now, tz).dateKey ? at.hhmm : date, full: `${date}, ${at.hhmm}` };
}

/** The first reason is the headline; the others, if any, the detail line. */
export function logLines(e: HhLogEntry): { title: string; detail: string } {
  const [first, ...rest] = e.reasons;
  return { title: first?.text ?? '', detail: rest.map(r => r.text).join(' · ') };
}
