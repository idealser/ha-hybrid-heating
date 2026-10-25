// "Why": what the module is doing right now, in words, from the live status.
import { plural, t, type I18nKey, type Lang } from '../i18n/index';
import { AC_ROOMS, DRIVER_ROOMS, type AcRoom, type HhSettings, type HhStatus, type Pip, type Room } from '../types';
import { inNightWindow, localTime } from './context';
import { DASH, fDev, fKw, fmt, fT, orDash } from './format';
import { zoneName } from './zones';

export interface WhyItem {
  pip: Pip;
  lead: string;
  text: string;
}

export interface WhyView {
  /** One plain line: boiler · ACs · load. */
  summary: string;
  sub: string;
  chips: { label: string; value: string }[];
  items: WhyItem[];
}

export type AcOffReason =
  | 'hybrid'
  | 'away'
  | 'cold'
  | 'zone'
  | 'night'
  | 'unavailable'
  | 'manual'
  | 'hand_off'
  | 'layer_off'
  | 'observe'
  | 'idle';

/** Reasons from the integration worth a line of their own (the AC, boiler and load lines cover the rest). */
export const NOTABLE_CODES = new Set(['outdoor_unavailable', 'rooms_unavailable', 'ac_not_coping', 'rods_budget_exhausted']);

const HVAC_MODES = ['cool', 'dry', 'fan_only', 'auto', 'heat_cool'];

const acHeats = (st: HhStatus, room: AcRoom): boolean => st.acs[room].available && st.acs[room].hvac === 'heat';
const offset = (s: HhSettings, room: Room): number => s.room_offsets[room] ?? 0;

/** Why an AC is not heating, most fundamental reason first (the core's order). */
export function acOffReason(room: AcRoom, st: HhStatus, s: HhSettings, tz = 'UTC'): AcOffReason {
  const ac = st.acs[room];
  if (!ac.available) return 'unavailable';
  if (ac.hvac && ac.hvac !== 'off' && ac.hvac !== 'heat') return 'manual';
  if (s.layers.ac === 'off') return 'layer_off';
  if (!s.hybrid) return 'hybrid';
  if (st.effective_preset === 'away') return 'away';
  if (st.t_out !== null && st.t_out < s.ac.min_outdoor) return 'cold';
  if (!s.zones.policies[st.zone]?.ac_rooms.includes(room)) return 'zone';
  // Night modes apply inside the night window whatever the preset, and all day on the Night preset.
  const night =
    st.effective_preset === 'night' || s.preset === 'night' || inNightWindow(s.targets, localTime(st.now, tz).hhmm);
  if (night && s.ac.night[room] === 'off') return 'night';
  if (s.layers.ac !== 'active') return 'observe';
  const held = st.reasons.some(
    r => (r.code === 'ac_manual_hold' || r.code === 'ac_manual_off') && r.data?.room === room,
  );
  return held ? 'hand_off' : 'idle';
}

/** Each room against its own target (target + room offset), the way the core compares them. */
function readings(st: HhStatus, s: HhSettings): { room: Room; temp: number; offset: number }[] {
  return DRIVER_ROOMS.flatMap(room => {
    const temp = st.rooms[room];
    return temp === null ? [] : [{ room, temp, offset: offset(s, room) }];
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

/** ACs that heat, split by who runs them: the module needs its AC layer in control and the AC taken over. */
export function acSplit(st: HhStatus, s: HhSettings): { heating: AcRoom[]; byModule: AcRoom[]; byHand: AcRoom[] } {
  const heating = AC_ROOMS.filter(r => acHeats(st, r));
  const byModule = heating.filter(r => s.layers.ac === 'active' && st.acs[r].owned);
  return { heating, byModule, byHand: heating.filter(r => !byModule.includes(r)) };
}

function acItems(st: HhStatus, s: HhSettings, L: Lang, tz: string): WhyItem[] {
  const { heating, byModule, byHand } = acSplit(st, s);
  const vars = { t: fT(s.ac.min_outdoor, L) };
  const offText = (room: AcRoom, all: boolean) => {
    const reason = acOffReason(room, st, s, tz);
    const hvac = st.acs[room].hvac ?? '';
    const mode = HVAC_MODES.includes(hvac) ? t(L, `hvac.${hvac}` as I18nKey) : hvac;
    return t(L, `why.${all ? 'acs_off' : 'ac_off'}.${reason}`, { ...vars, mode });
  };
  if (!heating.length) {
    const reasons = AC_ROOMS.map(r => acOffReason(r, st, s, tz));
    if (reasons.every(r => r === reasons[0]))
      return [{ pip: 'idle', lead: t(L, 'why.acs_off'), text: offText(AC_ROOMS[0], true) }];
    return AC_ROOMS.map(room => ({ pip: 'idle' as const, lead: `${t(L, `room.${room}`)}:`, text: offText(room, false) }));
  }
  const items: WhyItem[] = [];
  if (byModule.length) {
    const targets = byModule.map(r => st.target + offset(s, r));
    const same = targets.every(v => v === targets[0]);
    const temp = (r: AcRoom) => orDash(st.rooms[r], v => fmt(v, 1, L));
    const who = byModule
      .map((r, i) =>
        same ? `${t(L, `room_acc.${r}`)} (${temp(r)}°)` : `${t(L, `room_acc.${r}`)} (${temp(r)}° → ${fmt(targets[i]!, 1, L)}°)`,
      )
      .join(t(L, 'why.and'));
    const quiet = byModule.filter(r => st.acs[r].quiet).map(r => t(L, `ac.${r}`));
    items.push({
      pip: 'ac',
      lead: t(L, byModule.length > 1 ? 'why.acs_on' : 'why.ac_on'),
      text:
        (same ? t(L, 'why.ac_on_text', { who, target: fmt(targets[0]!, 1, L) }) : `${who}.`) +
        (quiet.length ? t(L, 'why.quiet', { list: quiet.join(', ') }) : ''),
    });
  }
  if (byHand.length) {
    const who = byHand
      .map(r => {
        const sp = st.acs[r].setpoint;
        const vars = { room: t(L, `room_low.${r}`), t: orDash(st.rooms[r], v => fmt(v, 1, L)) };
        return sp === null ? t(L, 'why.ac_hand_who_nosp', vars) : t(L, 'why.ac_hand_who', { ...vars, sp: fmt(sp, 0, L) });
      })
      .join(t(L, 'why.and'));
    items.push({ pip: 'ac', lead: t(L, byHand.length > 1 ? 'why.acs_hand' : 'why.ac_hand'), text: `${who}.` });
  }
  for (const room of AC_ROOMS.filter(r => !heating.includes(r)))
    items.push({ pip: 'idle', lead: `${t(L, `room.${room}`)}:`, text: offText(room, false) });
  return items;
}

/** The room the boiler follows, with its own reading (the core compares readings less their room offsets). */
function follows(st: HhStatus, s: HhSettings, L: Lang): string {
  const d = st.driver;
  if (d.mode === 'average') {
    const avg = average(st, s)?.temp ?? d.temp;
    return avg === null ? t(L, 'why.follows.average_unknown') : t(L, 'why.follows.average', { t: fmt(avg, 1, L) });
  }
  if (d.room === null) return t(L, 'why.follows.coldest_unknown');
  const temp = st.rooms[d.room] ?? d.temp;
  if (temp === null) return t(L, 'why.follows.coldest_unknown');
  return t(L, 'why.follows.coldest', { room: t(L, `room_low.${d.room}`), t: fmt(temp, 1, L) });
}

function boilerItem(st: HhStatus, s: HhSettings, L: Lang): WhyItem {
  if (!st.decided) return { pip: 'idle', lead: t(L, 'why.starting'), text: t(L, 'why.starting_text') };
  // Observing, the module only decides: say what it would do, the old thermostat drives the boiler.
  const obs = s.layers.boiler !== 'active';
  const k = (key: string) => (obs ? `why.obs.${key}` : `why.${key}`) as I18nKey;
  const flow = orDash(st.flow_target, v => String(Math.round(v)));
  if (!st.boiler.available)
    return { pip: 'cold', lead: t(L, 'why.boiler_unavailable'), text: t(L, 'why.boiler_unavailable_text') };
  if (s.zones.policies[st.zone]?.boiler === 'off')
    return { pip: 'idle', lead: t(L, k('boiler_off')), text: t(L, 'why.boiler_off_text') };
  if (!st.season_active) return { pip: 'idle', lead: t(L, 'why.season_idle'), text: t(L, k('season_idle_text')) };
  // The module's decision, not the device: in observe mode the old thermostat drives the call.
  const heating = st.boiler.wanted ?? st.boiler.call_on === true;
  if (!heating && s.layers.load === 'active' && st.reasons.some(r => r.code === 'pause_boiler'))
    return { pip: 'cold', lead: t(L, 'why.load_pause'), text: t(L, 'why.load_pause_text', { s: s.load.pause_s }) };
  if (s.boiler.mode === 'smooth') {
    if (!heating)
      return {
        pip: 'idle',
        lead: t(L, k('smooth_paused')),
        text: t(L, k('smooth_paused_text'), {
          m: fmt(s.boiler.overheat_margin, 1, L),
          r: fmt(s.boiler.resume_margin, 1, L),
          follows: follows(st, s, L),
        }),
      };
    const parts: string[] = [];
    if (st.curve_flow !== null) parts.push(t(L, 'why.part.curve', { t: Math.round(st.curve_flow) }));
    if (st.background_shift > 0) parts.push(t(L, 'why.part.bg', { t: fmt(st.background_shift, 0, L) }));
    if (st.correction !== 0) parts.push(t(L, 'why.part.corr', { t: fDev(st.correction, L) }));
    return {
      pip: 'heat',
      lead: t(L, k('smooth_on')),
      text: t(L, k('smooth_on_text'), {
        flow,
        parts: parts.length ? ` (${parts.join(', ')})` : '',
        follows: follows(st, s, L),
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
    return { pip: 'heat', lead: t(L, k('classic_on')), text: t(L, 'why.classic_on_text', { flow, rods }) + why };
  }
  return {
    pip: 'idle',
    lead: t(L, k('classic_wait')),
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
  const live = s.layers.load === 'active';
  const over = kw > s.load.limit_kw;
  if (st.load.shedding) {
    const what: string[] = [];
    if (st.load.water_heater_shed) what.push(t(L, 'why.water_heater'));
    if (st.load.rods_shed > 0) what.push(plural(L, 'rods', st.load.rods_shed));
    if (!what.length) what.push(t(L, 'why.boiler_paused_word')); // only the boiler pause so far
    const list = what.join(', ');
    if (over)
      return {
        pip: 'cold',
        lead: t(L, 'why.load_over'),
        // observing, nothing was switched off: the module only says what it would switch off
        text: t(L, live ? 'why.load_over_text' : 'why.obs.load_over_text', { ...vars, what: list }),
      };
    return {
      pip: 'ok',
      lead: t(L, 'why.load_recover'),
      text: t(L, live ? 'why.load_recover_text' : 'why.obs.load_recover_text', {
        min: Math.round(s.load.restore_after_s / 60),
        restore: fKw(s.load.restore_kw, L),
        what: list,
      }),
    };
  }
  if (over)
    return { pip: 'cold', lead: t(L, 'why.load_over'), text: t(L, 'why.load_hold_text', { ...vars, s: s.load.shed_after_s }) };
  const spare = s.load.limit_kw - kw;
  if (spare < 1) return { pip: 'cold', lead: t(L, 'why.load_near'), text: t(L, 'why.load_near_text', vars) };
  return { pip: 'ok', lead: t(L, 'why.load_ok'), text: t(L, 'why.load_ok_text', { spare: fKw(spare, L) }) };
}

function summary(st: HhStatus, s: HhSettings, L: Lang): string {
  const obs = s.layers.boiler !== 'active';
  const k = (key: string) => (obs ? `sum.obs.${key}` : `sum.${key}`) as I18nKey;
  let boiler: string;
  if (!st.decided) boiler = t(L, 'sum.starting');
  else if (!st.boiler.available) boiler = t(L, 'sum.unavailable');
  else if (s.zones.policies[st.zone]?.boiler === 'off') boiler = t(L, k('zone_off'));
  else if (!st.season_active) boiler = t(L, 'sum.season');
  else if (st.boiler.wanted ?? st.boiler.call_on === true) boiler = t(L, k('on'), { flow: deg(st.flow_target).replace('°', '') });
  else boiler = t(L, k('paused'));
  const { byModule, byHand } = acSplit(st, s);
  const acs = byModule.length
    ? t(L, byModule.length > 1 ? 'sum.acs_on' : 'sum.ac_on')
    : byHand.length
      ? t(L, byHand.length > 1 ? 'sum.acs_hand' : 'sum.ac_hand')
      : t(L, 'sum.acs_off');
  const kw = st.load.kw;
  const load =
    kw === null
      ? t(L, 'sum.load_unknown')
      : kw > s.load.limit_kw
        ? t(L, 'sum.load_over')
        : t(L, 'sum.load', { kw: fmt(kw, 1, L), limit: fKw(s.load.limit_kw, L) });
  return [boiler, acs, load].join(' · ');
}

export function buildWhy(st: HhStatus, s: HhSettings, L: Lang, tz = 'UTC'): WhyView {
  const sub = t(L, 'why.sub', {
    t: orDash(st.t_out, v => fT(v, L)),
    zone: zoneName(st.zone, L),
    target: fmt(st.target, 1, L),
    preset: t(L, `preset.${st.effective_preset}`).toLowerCase(),
  });
  const chips = [
    // the module's flow; observing, the boiler itself runs on the old thermostat's setpoint
    { label: t(L, s.layers.boiler === 'active' ? 'chip.flow' : 'chip.flow_obs'), value: deg(st.flow_target) },
    { label: t(L, 'chip.rods'), value: String(st.boiler.rods_limit ?? s.zones.policies[st.zone]?.max_rods ?? DASH) },
    { label: t(L, 'chip.load'), value: `${orDash(st.load.kw, v => fmt(v, 1, L))} / ${fKw(s.load.limit_kw, L)}` },
  ];
  const notable = st.reasons
    .filter(r => NOTABLE_CODES.has(r.code) && r.text)
    .map(r => ({ pip: 'cold' as const, lead: '', text: r.text }));
  const items = [...acItems(st, s, L, tz), boilerItem(st, s, L), ...notable, loadItem(st, s, L)];
  return { summary: summary(st, s, L), sub, chips, items };
}
