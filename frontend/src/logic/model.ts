// Mirror of core/model.py, plus the "what happens in this weather" estimate and forecast totals.
import { type Lang, t } from '../i18n/index';
import type { AcRoom, HhForecastHour, HhModelParams, HhSettings, ZoneIndex } from '../types';
import { AC_ROOMS } from '../types';
import { dayLabel, effectiveTarget, localTime, presetTarget } from './context';
import { flowFor } from './curve';
import { fT } from './format';
import { zoneIndex, zoneName, zoneSummary } from './zones';

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
    flow: flowFor(s.curve, tOut, { acActive, hybrid: s.hybrid }),
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
export function forecastTotals(
  s: HhSettings,
  m: HhModelParams,
  hours: HhForecastHour[],
  tz: string,
): { kwh: number; cost: number; boilerOnlyCost: number } {
  let kwh = 0;
  let demand = 0;
  for (const h of hours) {
    const [preset, target] = effectiveTarget(s.targets, s.preset, localTime(h.ts, tz).hhmm);
    const p = probe(s, m, h.t_out, { target, night: preset === 'night' });
    kwh += p.electricKw;
    demand += p.demandKw;
  }
  return { kwh, cost: kwh * m.tariff_per_kwh, boilerOnlyCost: demand * m.tariff_per_kwh };
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
