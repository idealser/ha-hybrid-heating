// "Why": what the module is doing right now, in words, from the live status.
import { plural, t, type I18nKey, type Lang } from '../i18n/index';
import { AC_ROOMS, DRIVER_ROOMS, LAYERS, type AcRoom, type HhSettings, type HhStatus, type Pip, type Room } from '../types';
import { DASH, fDev, fKw, fmt, fT, orDash } from './format';
import { zoneName } from './zones';

export interface WhyItem {
  pip: Pip;
  lead: string;
  text: string;
}

export interface WhyView {
  sub: string;
  chips: { label: string; value: string }[];
  items: WhyItem[];
  banners: string[];
}

export type AcOffReason = 'hybrid' | 'away' | 'cold' | 'zone' | 'night' | 'unavailable' | 'observe' | 'idle';

/** Reasons from the integration worth a line of their own: something is missing or being limited. */
export const NOTABLE_CODES = new Set([
  'outdoor_unavailable',
  'rooms_unavailable',
  'ac_not_coping',
  'ac_unavailable',
  'rods_budget_exhausted',
  'pause_boiler',
  'shed_water_heater',
  'shed_rod',
  'load_unknown',
]);

const acHeats = (st: HhStatus, room: AcRoom): boolean => st.acs[room].available && st.acs[room].hvac === 'heat';

/** Why an AC is not heating, most fundamental reason first. */
export function acOffReason(room: AcRoom, st: HhStatus, s: HhSettings): AcOffReason {
  if (!st.acs[room].available) return 'unavailable';
  if (!s.hybrid) return 'hybrid';
  if (st.effective_preset === 'away') return 'away';
  if (st.t_out !== null && st.t_out < s.ac.min_outdoor) return 'cold';
  if (!s.zones.policies[st.zone]?.ac_rooms.includes(room)) return 'zone';
  if (st.effective_preset === 'night' && s.ac.night[room] === 'off') return 'night';
  if (s.layers.ac !== 'active') return 'observe';
  return 'idle';
}

/** Each room against its own target (target + room offset), the way the core compares them. */
function readings(st: HhStatus, s: HhSettings): { room: Room; temp: number; offset: number }[] {
  return DRIVER_ROOMS.flatMap(room => {
    const temp = st.rooms[room];
    return temp === null ? [] : [{ room, temp, offset: s.room_offsets[room] ?? 0 }];
  });
}

function coldest(st: HhStatus, s: HhSettings): { room: Room; temp: number; offset: number } | null {
  const rs = readings(st, s);
  return rs.length ? rs.reduce((a, b) => (b.temp - b.offset < a.temp - a.offset ? b : a)) : null;
}

/** The room average and the target it is held to (the preset target plus the rooms' mean offset). */
function average(st: HhStatus, s: HhSettings): { temp: number; target: number } | null {
  const rs = readings(st, s);
  if (!rs.length) return null;
  const mean = (f: (r: (typeof rs)[number]) => number) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  return { temp: mean(r => r.temp), target: st.target + mean(r => r.offset) };
}

const deg = (v: number | null): string => orDash(v, x => `${Math.round(x)}°`);

function acItems(st: HhStatus, s: HhSettings, L: Lang): WhyItem[] {
  const on = AC_ROOMS.filter(r => acHeats(st, r));
  const target = fmt(st.target, 1, L);
  if (!on.length) {
    const reasons = AC_ROOMS.map(r => acOffReason(r, st, s));
    const vars = { t: fT(s.ac.min_outdoor, L) };
    if (reasons.every(r => r === reasons[0]))
      return [{ pip: 'idle', lead: t(L, 'why.acs_off'), text: t(L, `why.acs_off.${reasons[0]!}`, vars) }];
    return AC_ROOMS.map((room, i) => ({
      pip: 'idle' as const,
      lead: `${t(L, `room.${room}`)}:`,
      text: t(L, `why.ac_off.${reasons[i]!}`, vars),
    }));
  }
  const who = on.map(r => `${t(L, `room_acc.${r}`)} (${orDash(st.rooms[r], v => fmt(v, 1, L))}°)`).join(t(L, 'why.and'));
  const quiet = on.filter(r => st.acs[r].quiet).map(r => t(L, `ac.${r}`));
  const items: WhyItem[] = [
    {
      pip: 'ac',
      lead: t(L, on.length > 1 ? 'why.acs_on' : 'why.ac_on'),
      text: t(L, 'why.ac_on_text', { who, target }) + (quiet.length ? t(L, 'why.quiet', { list: quiet.join(', ') }) : ''),
    },
  ];
  for (const room of AC_ROOMS.filter(r => !on.includes(r))) {
    items.push({
      pip: 'idle',
      lead: `${t(L, `room.${room}`)}:`,
      text: t(L, `why.ac_off.${acOffReason(room, st, s)}`, { t: fT(s.ac.min_outdoor, L) }),
    });
  }
  return items;
}

function follows(st: HhStatus, L: Lang): string {
  const d = st.driver;
  if (d.mode === 'average')
    return d.temp === null ? t(L, 'why.follows.average_unknown') : t(L, 'why.follows.average', { t: fmt(d.temp, 1, L) });
  if (d.temp === null || d.room === null) return t(L, 'why.follows.coldest_unknown');
  return t(L, 'why.follows.coldest', { room: t(L, `room_low.${d.room}`), t: fmt(d.temp, 1, L) });
}

function boilerItem(st: HhStatus, s: HhSettings, L: Lang): WhyItem {
  const flow = orDash(st.flow_target, v => String(Math.round(v)));
  if (!st.boiler.available)
    return { pip: 'cold', lead: t(L, 'why.boiler_unavailable'), text: t(L, 'why.boiler_unavailable_text') };
  if (s.zones.policies[st.zone]?.boiler === 'off')
    return { pip: 'idle', lead: t(L, 'why.boiler_off'), text: t(L, 'why.boiler_off_text') };
  // The module's decision, not the device: in observe mode the old thermostat drives the call.
  const heating = st.boiler.wanted ?? st.boiler.call_on === true;
  if (s.boiler.mode === 'smooth') {
    if (!heating)
      return {
        pip: 'idle',
        lead: t(L, 'why.smooth_paused'),
        text: t(L, 'why.smooth_paused_text', { m: fmt(s.boiler.overheat_margin, 1, L), follows: follows(st, L) }),
      };
    const parts: string[] = [];
    if (st.curve_flow !== null) parts.push(t(L, 'why.part.curve', { t: Math.round(st.curve_flow) }));
    if (st.background_shift > 0) parts.push(t(L, 'why.part.bg', { t: fmt(st.background_shift, 0, L) }));
    if (st.correction !== 0) parts.push(t(L, 'why.part.corr', { t: fDev(st.correction, L) }));
    return {
      pip: 'heat',
      lead: t(L, 'why.smooth_on'),
      text: t(L, 'why.smooth_on_text', {
        flow,
        parts: parts.length ? ` (${parts.join(', ')})` : '',
        follows: follows(st, L),
      }),
    };
  }
  const c = coldest(st, s);
  // The coldest room's own threshold: its target (preset target + offset) less the tolerance.
  const threshold = st.target + (c?.offset ?? 0) - s.boiler.classic_coldest_tolerance;
  const thr = fmt(threshold, 1, L);
  if (heating) {
    const rods = String(st.boiler.rods_limit ?? s.zones.policies[st.zone]?.max_rods ?? DASH);
    const avg = average(st, s);
    const why =
      c && c.temp < threshold
        ? t(L, 'why.classic_coldest', { room: t(L, `room_low.${c.room}`), t: fmt(c.temp, 1, L), thr })
        : t(L, 'why.classic_average', {
            t: orDash(avg?.temp, v => fmt(v, 1, L)),
            thr: orDash(avg?.target, v => fmt(v, 1, L)),
          });
    return { pip: 'heat', lead: t(L, 'why.classic_on'), text: t(L, 'why.classic_on_text', { flow, rods }) + why };
  }
  return {
    pip: 'idle',
    lead: t(L, 'why.classic_wait'),
    text: t(L, 'why.classic_wait_text', {
      room: c ? t(L, `room_low.${c.room}`) : DASH,
      t: orDash(c?.temp, v => fmt(v, 1, L)),
      thr,
    }),
  };
}

function loadItem(st: HhStatus, s: HhSettings, L: Lang): WhyItem {
  const { kw } = st.load;
  const limit = fKw(s.load.limit_kw, L);
  if (kw === null) return { pip: 'idle', lead: t(L, 'why.load_unknown'), text: t(L, 'why.load_unknown_text') };
  const vars = { kw: fmt(kw, 1, L), limit };
  if (st.load.shedding) {
    const what = [st.load.water_heater_shed ? t(L, 'why.water_heater') : null];
    if (st.load.rods_shed > 0) what.push(plural(L, 'rods', st.load.rods_shed));
    return {
      pip: 'cold',
      lead: t(L, 'why.load_over'),
      text: t(L, 'why.load_over_text', { ...vars, what: what.filter(Boolean).join(', ') }),
    };
  }
  const spare = s.load.limit_kw - kw;
  if (spare < 1) return { pip: 'cold', lead: t(L, 'why.load_near'), text: t(L, 'why.load_near_text', vars) };
  return { pip: 'ok', lead: t(L, 'why.load_ok'), text: t(L, 'why.load_ok_text', { spare: fKw(spare, L) }) };
}

function banners(st: HhStatus, s: HhSettings, L: Lang): string[] {
  const out: string[] = [];
  if (!st.season_active) out.push(t(L, 'banner.season'));
  if (!st.enabled) {
    out.push(t(L, 'banner.disabled'));
    return out;
  }
  const observed = LAYERS.filter(l => s.layers[l] === 'observe');
  if (observed.length)
    out.push(t(L, 'banner.observe', { layers: observed.map(l => t(L, `layer.${l}` as I18nKey)).join(', ') }));
  return out;
}

export function buildWhy(st: HhStatus, s: HhSettings, L: Lang): WhyView {
  const sub = t(L, 'why.sub', {
    t: orDash(st.t_out, v => fT(v, L)),
    zone: zoneName(st.zone, L),
    target: fmt(st.target, 1, L),
    preset: t(L, `preset.${st.effective_preset}`).toLowerCase(),
  });
  const chips = [
    { label: t(L, 'chip.flow'), value: deg(st.flow_target) },
    { label: t(L, 'chip.rods'), value: String(st.boiler.rods_limit ?? s.zones.policies[st.zone]?.max_rods ?? DASH) },
    { label: t(L, 'chip.load'), value: `${orDash(st.load.kw, v => fmt(v, 1, L))} / ${fKw(s.load.limit_kw, L)}` },
  ];
  const notable = st.reasons
    .filter(r => NOTABLE_CODES.has(r.code) && r.text)
    .map(r => ({ pip: 'cold' as const, lead: '', text: r.text }));
  const items = [...acItems(st, s, L), boilerItem(st, s, L), ...notable, loadItem(st, s, L)];
  return { sub, chips, items, banners: banners(st, s, L) };
}
