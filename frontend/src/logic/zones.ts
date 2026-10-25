// Weather zones: which zone a temperature falls in, and editing the zones.
import { type I18nKey, type Lang, plural, t } from '../i18n/index';
import type { AcRoom, BoilerZoneMode, Bounds, ZoneIndex, ZonePolicy, ZoneSettings } from '../types';
import { fT } from './format';

export const ZONE_TONE = ['ac', 'mix', 'heat', 'deep'] as const;

/** 0 = warmest zone, 3 = severe frost. A boundary belongs to the warmer zone (as in core/context.py). */
export function zoneIndex(b: Bounds, temp: number): ZoneIndex {
  for (let i = 0; i < b.length; i++) if (temp >= b[i]!) return i as ZoneIndex;
  return 3;
}

/** Move one boundary: whole degrees, at least 1° from its neighbours, within ±19. */
export function setBound(b: Bounds, i: 0 | 1 | 2, v: number): Bounds {
  const hi = i === 0 ? 19 : b[i - 1]! - 1;
  const lo = i === 2 ? -19 : b[i + 1]! + 1;
  const next = [...b] as Bounds;
  next[i] = Math.min(hi, Math.max(lo, Math.round(v)));
  return next;
}

export function zoneLowerBound(b: Bounds, i: ZoneIndex): number {
  return i === 3 ? -20 : b[i];
}

export function zoneName(i: ZoneIndex, lang: Lang): string {
  return t(lang, `zone.${i}` as I18nKey);
}

export function zoneRange(i: ZoneIndex, b: Bounds, lang: Lang): string {
  if (i === 0) return t(lang, 'range.above', { t: fT(b[0], lang) });
  if (i === 3) return t(lang, 'range.below', { t: fT(b[2], lang) });
  return t(lang, 'range.between', { from: fT(b[i], lang), to: fT(b[i - 1]!, lang) });
}

export function acText(p: ZonePolicy, lang: Lang): string {
  const living = p.ac_rooms.includes('living');
  const bedroom = p.ac_rooms.includes('bedroom');
  if (living && bedroom) return t(lang, 'ac.both');
  if (living) return t(lang, 'ac.living');
  if (bedroom) return t(lang, 'ac.bedroom');
  return t(lang, 'ac.none');
}

export function zoneSummary(p: ZonePolicy, lang: Lang): string {
  const parts = [acText(p, lang), t(lang, `boiler_sum.${p.boiler}` as I18nKey)];
  if (p.boiler !== 'off') parts.push(plural(lang, 'rods', p.max_rods));
  return parts.join(' · ');
}

function withPolicy(z: ZoneSettings, i: ZoneIndex, change: Partial<ZonePolicy>): ZoneSettings {
  const policies = z.policies.map((p, j) => (j === i ? { ...p, ...change } : p)) as ZoneSettings['policies'];
  return { ...z, policies };
}

/** Switch one AC on or off in a zone; the list stays sorted like the integration's JSON. */
export function toggleZoneAc(z: ZoneSettings, i: ZoneIndex, room: AcRoom): ZoneSettings {
  const rooms = z.policies[i].ac_rooms;
  const next = rooms.includes(room) ? rooms.filter(r => r !== room) : [...rooms, room].sort();
  return withPolicy(z, i, { ac_rooms: next });
}

export function setZoneBoiler(z: ZoneSettings, i: ZoneIndex, mode: BoilerZoneMode): ZoneSettings {
  return withPolicy(z, i, { boiler: mode });
}

export function setZoneRods(z: ZoneSettings, i: ZoneIndex, n: 1 | 2 | 3): ZoneSettings {
  return withPolicy(z, i, { max_rods: n });
}

/** A zone's name on the strip under the chart: full, initials, or nothing when it does not fit. */
export function stripLabel(name: string, widthPx: number): string {
  if (widthPx > 110) return name;
  if (widthPx > 52) return name.split(' ').map(w => w[0]!.toUpperCase()).join('');
  return '';
}
