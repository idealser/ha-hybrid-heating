// Mirror of core/model.py, plus the "what happens in this weather" estimate and forecast totals.
import { type I18nKey, type Lang, plural, t } from '../i18n/index';
import type { AcRoom, HhForecastHour, HhModelParams, HhSettings, ZoneIndex } from '../types';
import { AC_ROOMS } from '../types';
import { dayLabel, effectiveTarget, inNightWindow, localTime, presetTarget } from './context';
import { flowFor } from './curve';
import { fF, fmt, fT } from './format';
import { acText, zoneIndex, zoneName, zoneSummary } from './zones';

const AC_RATED_AT_C = 7;
const AC_LIMIT_C = -15;
const AC_CAPACITY_SHARE_AT_LIMIT = 3.0 / 6.2;

/** Neutral defaults; the card options override tariff and currency. */
export const DEFAULT_MODEL: HhModelParams = {
  h_w_per_k: 150,
  gains_w: 300,
  tariff_per_kwh: 0.25,
  currency: '€',
  rod_kw: 2.0,
  ac_rated_kw: { living: 3.5, bedroom: 2.7 },
  ac_share: { living: 0.42, bedroom: 0.23 },
  // The rooms of the season replay's model (2.6 + 1.3 + 1.3): a first guess until it is learned
  capacity_kwh_per_k: 5.2,
};

export function withModelDefaults(m?: Partial<HhModelParams>): HhModelParams {
  return { ...DEFAULT_MODEL, ...(m ?? {}) };
}

export function heatDemandKw(h: number, gains: number, tIn: number, tOut: number): number {
  return Math.max(0, (h * (tIn - tOut) - gains) / 1000);
}

/** Heat output of an inverter split at full speed; stops below its rated −15 °C limit. */
export function acCapacityKw(rated: number, tOut: number): number {
  if (tOut >= AC_RATED_AT_C) return rated;
  if (tOut < AC_LIMIT_C) return 0;
  const share =
    AC_CAPACITY_SHARE_AT_LIMIT +
    ((tOut - AC_LIMIT_C) / (AC_RATED_AT_C - AC_LIMIT_C)) * (1 - AC_CAPACITY_SHARE_AT_LIMIT);
  return rated * share;
}

/** Seasonal-style COP: 1.7 at −15 °C, 3.6 at +7 °C, 4.2 from +15 °C. */
export function acCop(tOut: number): number {
  if (tOut >= 15) return 4.2;
  if (tOut >= AC_RATED_AT_C) return 3.6 + ((tOut - AC_RATED_AT_C) * (4.2 - 3.6)) / (15 - AC_RATED_AT_C);
  const tt = Math.max(tOut, AC_LIMIT_C);
  return 1.7 + ((tt - AC_LIMIT_C) * (3.6 - 1.7)) / (AC_RATED_AT_C - AC_LIMIT_C);
}

export interface ProbeResult {
  zone: ZoneIndex;
  demandKw: number;
  acKw: Record<AcRoom, number>;
  acTotalKw: number;
  boilerKw: number;
  boilerCapKw: number;
  shortKw: number;
  cop: number | null;
  electricKw: number;
  acActive: boolean;
  /** The boiler runs the lower background curve: ACs heat and the boiler is the main heat (as the core). */
  background: boolean;
  flow: number;
}

/** Where the heat comes from at `tOut`, by the settings (the draft) and the model. */
export function probe(
  s: HhSettings,
  m: HhModelParams,
  tOut: number,
  o: { target?: number; night?: boolean } = {},
): ProbeResult {
  const zone = zoneIndex(s.zones.bounds, tOut);
  const policy = s.zones.policies[zone];
  const target = o.target ?? presetTarget(s.targets, s.preset);
  const demandKw = heatDemandKw(m.h_w_per_k, m.gains_w, target, tOut);
  const acKw = { living: 0, bedroom: 0 } as Record<AcRoom, number>;
  for (const room of AC_ROOMS) {
    const on =
      s.hybrid &&
      policy.ac_rooms.includes(room) &&
      tOut >= s.ac.min_outdoor &&
      s.preset !== 'away' &&
      !(o.night && s.ac.night[room] === 'off');
    acKw[room] = on ? Math.min(m.ac_share[room] * demandKw, acCapacityKw(m.ac_rated_kw[room], tOut)) : 0;
  }
  const acTotalKw = acKw.living + acKw.bedroom;
  const boilerCapKw = policy.boiler === 'off' ? 0 : policy.max_rods * m.rod_kw;
  const boilerKw = Math.min(Math.max(0, demandKw - acTotalKw), boilerCapKw);
  const shortKw = Math.max(0, demandKw - acTotalKw - boilerKw);
  const acActive = acTotalKw > 0;
  const background = acActive && s.hybrid && policy.boiler === 'main';
  const cop = acActive ? acCop(tOut) : null;
  return {
    zone,
    demandKw,
    acKw,
    acTotalKw,
    boilerKw,
    boilerCapKw,
    shortKw,
    cop,
    electricKw: (cop ? acTotalKw / cop : 0) + boilerKw,
    acActive,
    background,
    flow: flowFor(s.curve, tOut, { acActive: background, hybrid: s.hybrid }),
  };
}

/** A day at the probe's weather: energy, cost and the saving against heating with the boiler alone. */
export function probeDaily(p: ProbeResult, m: HhModelParams): { kwh: number; cost: number; boilerOnlyCost: number; saving: number } {
  const kwh = p.electricKw * 24;
  const cost = kwh * m.tariff_per_kwh;
  const boilerOnlyCost = p.demandKw * 24 * m.tariff_per_kwh;
  return { kwh, cost, boilerOnlyCost, saving: boilerOnlyCost > 0 ? 1 - cost / boilerOnlyCost : 0 };
}

/** Each forecast hour with the target in effect at that local time; night = the night preset is in effect. */
/** Where the forecast starts: the season and the rooms now (from the status). */
export interface ForecastStart {
  seasonActive: boolean;
  windowMean: number | null;
  /** Mean of the room readings now; null starts the flat at the first hour's target. */
  indoor: number | null;
}

export interface ForecastRow {
  /** In the heating season: the module heats at all. */
  heats: boolean;
  target: number;
  /** The flat's mean temperature at the end of the hour. */
  indoor: number;
  heatKwh: number;
  /** The electricity for that heat: the ACs at their COP, the boiler at 1. */
  electricKwh: number;
  /** Of it, the boiler's and the ACs'. */
  boilerKwh: number;
  acKwh: number;
  /** Where the heat comes from in this hour's weather, held at the target. */
  p: ProbeResult;
}

/** Whether the module heats in each hour: the core's season rule on the rolling mean of the forecast,
 * started from the window mean the module has now. */
export function seasonByHour(
  s: HhSettings,
  hours: HhForecastHour[],
  now: { seasonActive: boolean; windowMean: number | null },
): boolean[] {
  const ss = s.season;
  if (ss.mode !== 'auto') return hours.map(() => ss.mode === 'on');
  const w = ss.window_hours;
  let active = now.seasonActive;
  return hours.map((_, i) => {
    const known = hours.slice(Math.max(0, i - w + 1), i + 1).map(h => h.t_out);
    const missing = w - known.length;
    const sum = known.reduce((a, b) => a + b, 0);
    const mean = missing > 0 ? (now.windowMean === null ? null : (sum + now.windowMean * missing) / w) : sum / w;
    if (mean !== null) active = active ? mean < ss.threshold + ss.hysteresis : mean < ss.threshold;
    return active;
  });
}

/** The forecast hour by hour: a warm flat cools on its stored heat before the heating starts, a cold one
 * warms up as fast as the heaters allow, and out of season nothing is heated. */
export function forecastRun(
  s: HhSettings,
  m: HhModelParams,
  hours: HhForecastHour[],
  tz: string,
  start: ForecastStart,
): ForecastRow[] {
  const season = seasonByHour(s, hours, start);
  const c = m.capacity_kwh_per_k;
  const loss = (inside: number, tOut: number) => (m.h_w_per_k * (inside - tOut) - m.gains_w) / 1000;
  let indoor: number | null = start.indoor;
  return hours.map((h, i) => {
    const hhmm = localTime(h.ts, tz).hhmm;
    const [, target] = effectiveTarget(s.targets, s.preset, hhmm);
    // AC night modes: inside the night window with any preset, and all day on Night (as the core)
    const p = probe(s, m, h.t_out, { target, night: s.preset === 'night' || inNightWindow(s.targets, hhmm) });
    let t = indoor ?? target;
    let heat = 0;
    const free = t - loss(t, h.t_out) / c;
    if (!season[i]) t = free;
    else if (free >= target) t = free; // the flat coasts on its stored heat
    else {
      const cap = p.boilerCapKw + AC_ROOMS.reduce((a, r) => a + (p.acKw[r] > 0 ? acCapacityKw(m.ac_rated_kw[r], h.t_out) : 0), 0);
      const need = t > target ? c * (target - free) : Math.max(0, loss(target, h.t_out)) + c * (target - t);
      heat = Math.min(need, Math.max(cap, p.demandKw));
      t = heat < need ? t + (heat - loss(t, h.t_out)) / c : target;
    }
    indoor = t;
    // The heat splits as the probe shares it at the target; a warm-up beyond that is the boiler's too.
    const scale = p.demandKw > 0 ? heat / p.demandKw : 0;
    const electricKwh = heat === 0 ? 0 : p.demandKw > 0 ? p.electricKw * scale : heat;
    const acKwh = heat === 0 || !p.cop ? 0 : (p.acTotalKw * scale) / p.cop;
    return { heats: season[i]!, target, indoor: t, heatKwh: heat, electricKwh, boilerKwh: electricKwh - acKwh, acKwh, p };
  });
}

export function forecastTotals(
  s: HhSettings,
  m: HhModelParams,
  hours: HhForecastHour[],
  tz: string,
  start: ForecastStart,
): { kwh: number; cost: number; boilerOnlyCost: number; heatedHours: number } {
  const rows = forecastRun(s, m, hours, tz, start);
  const kwh = rows.reduce((a, r) => a + r.electricKwh, 0);
  const heat = rows.reduce((a, r) => a + r.heatKwh, 0);
  return {
    kwh,
    cost: kwh * m.tariff_per_kwh,
    boilerOnlyCost: heat * m.tariff_per_kwh,
    heatedHours: rows.filter(r => r.heats).length,
  };
}

/** A round top for the electricity scale: 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10 kWh. */
export function niceKwh(v: number): number {
  for (const step of [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10]) if (v <= step) return step;
  return Math.ceil(v / 5) * 5;
}

/** The line for a tapped hour: what runs then and about how much it draws. */
export function forecastHourLine(s: HhSettings, h: HhForecastHour, row: ForecastRow, tz: string, lang: Lang): string {
  const when = `${dayLabel(h.ts, tz, lang)}, ${localTime(h.ts, tz).hhmm}, ${fT(h.t_out, lang)}`;
  if (!row.heats) return t(lang, 'forecast.hour_off', { when });
  const zone = zoneName(row.p.zone, lang);
  if (row.heatKwh === 0) return t(lang, 'forecast.hour_coast', { when, zone, t: fmt(row.indoor, 1, lang) });
  const policy = s.zones.policies[row.p.zone];
  const running = { ...policy, ac_rooms: AC_ROOMS.filter(r => row.p.acKw[r] > 0) };
  const parts = [acText(running, lang), t(lang, `boiler_sum.${policy.boiler}` as I18nKey)];
  if (policy.boiler !== 'off') {
    parts.push(plural(lang, 'rods', policy.max_rods), t(lang, 'forecast.hour_flow', { flow: fF(row.p.flow, lang) }));
  }
  parts.push(t(lang, 'forecast.hour_kw', { kw: fmt(row.electricKwh, 1, lang) }));
  parts.push(t(lang, 'forecast.hour_inside', { t: fmt(row.indoor, 1, lang) }));
  return t(lang, 'forecast.hour', { when, zone, what: parts.join(' · ') });
}

/** Temperature axis for the forecast strip: 3° of room each side, ticks on multiples of 5 inside. */
export function forecastScale(temps: number[]): { tmin: number; tmax: number; ticks: number[] } {
  const tmin = Math.floor(Math.min(...temps)) - 3;
  const tmax = Math.ceil(Math.max(...temps)) + 3;
  const ticks: number[] = [];
  for (let v = Math.ceil((tmin + 1) / 5) * 5; v < tmax; v += 5) ticks.push(v);
  return { tmin, tmax, ticks };
}

/** The line under the strip: the next zone change and the coldest hour. */
export function forecastSummary(s: HhSettings, hours: HhForecastHour[], tz: string, lang: Lang): string {
  if (hours.length === 0) return '';
  const zoneOf = (h: HhForecastHour) => zoneIndex(s.zones.bounds, h.t_out);
  const z0 = zoneOf(hours[0]!);
  const change = hours.find(h => zoneOf(h) !== z0);
  const coldest = hours.reduce((a, b) => (b.t_out < a.t_out ? b : a));
  let text = '';
  if (change) {
    const z = zoneOf(change);
    text += t(lang, 'forecast.change', {
      day: dayLabel(change.ts, tz, lang),
      hhmm: localTime(change.ts, tz).hhmm,
      t: fT(change.t_out, lang),
      zone: zoneName(z, lang),
      summary: zoneSummary(s.zones.policies[z], lang),
    });
  }
  text += t(lang, 'forecast.coldest', {
    day: dayLabel(coldest.ts, tz, lang),
    hhmm: localTime(coldest.ts, tz).hhmm,
    t: fT(coldest.t_out, lang),
    zone: zoneName(zoneOf(coldest), lang),
  });
  return text;
}
