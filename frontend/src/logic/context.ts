// Time in the house's time zone, and the target in effect (mirror of core/context.py).
import type { Lang } from '../i18n/index';
import type { Preset, PresetTargets } from '../types';

const PARTS = new Map<string, Intl.DateTimeFormat>();

function parts(ts: string, tz: string): Record<string, string> {
  let f = PARTS.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    PARTS.set(tz, f);
  }
  return Object.fromEntries(f.formatToParts(new Date(ts)).map(p => [p.type, p.value]));
}

/** Wall-clock time in `tz`: "HH:MM", the hour, and a "YYYY-MM-DD" key for the local day. */
export function localTime(ts: string, tz: string): { hhmm: string; hour: number; dateKey: string } {
  const p = parts(ts, tz);
  return { hhmm: `${p.hour}:${p.minute}`, hour: Number(p.hour), dateKey: `${p.year}-${p.month}-${p.day}` };
}

export function presetTarget(t: PresetTargets, p: Preset): number {
  return { comfort: t.comfort, eco: t.eco, night: t.night, away: t.away }[p];
}

/** Inside the night window (it may cross midnight), by the wall clock "HH:MM". */
export function inNightWindow(t: PresetTargets, hhmm: string): boolean {
  const start = t.night_start.slice(0, 5);
  const end = t.night_end.slice(0, 5);
  return start <= end ? start <= hhmm && hhmm < end : hhmm >= start || hhmm < end;
}

/** Comfort turns into Night inside the night window; other presets hold all day. */
export function effectiveTarget(t: PresetTargets, preset: Preset, hhmm: string): [Preset, number] {
  const night = inNightWindow(t, hhmm);
  const effective = preset === 'comfort' && night ? 'night' : preset;
  return [effective, presetTarget(t, effective)];
}

/** "вс 25" / "Sun 25" for the local day of `ts`. */
export function dayLabel(ts: string, tz: string, lang: Lang): string {
  const date = new Date(ts);
  const weekday = new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', { timeZone: tz, weekday: 'short' })
    .format(date)
    .replace('.', '');
  return `${weekday} ${Number(parts(ts, tz).day)}`;
}
