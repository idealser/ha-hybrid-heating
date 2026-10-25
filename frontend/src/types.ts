// Mirror of the integration's settings (core/types.py) and of its websocket replies.

export type Room = 'living' | 'bedroom' | 'child' | 'bath';
export type AcRoom = 'living' | 'bedroom';
export type Preset = 'comfort' | 'eco' | 'night' | 'away';
export type BoilerZoneMode = 'off' | 'backup' | 'main';
export type BoilerMode = 'smooth' | 'classic';
export type NightMode = 'quiet' | 'off' | 'day';
export type SeasonMode = 'auto' | 'on' | 'off';
export type LayerMode = 'off' | 'observe' | 'active';
export type Layer = 'boiler' | 'ac' | 'load';
export type Pip = 'ac' | 'heat' | 'idle' | 'cold' | 'ok';
export type ZoneIndex = 0 | 1 | 2 | 3;

export const ROOMS = ['living', 'bedroom', 'child', 'bath'] as const satisfies readonly Room[];
export const AC_ROOMS = ['living', 'bedroom'] as const satisfies readonly AcRoom[];
export const DRIVER_ROOMS = ['living', 'bedroom', 'child'] as const satisfies readonly Room[];
export const PRESETS = ['comfort', 'eco', 'night', 'away'] as const satisfies readonly Preset[];
export const LAYERS = ['boiler', 'ac', 'load'] as const satisfies readonly Layer[];

export type CurvePoint = [number, number];
export type CurvePoints = [
  CurvePoint, CurvePoint, CurvePoint, CurvePoint, CurvePoint, CurvePoint, CurvePoint, CurvePoint, CurvePoint,
];
export type PointIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const CURVE_TEMPS = [20, 15, 10, 5, 0, -5, -10, -15, -20] as const;

export interface CurveSettings {
  points: CurvePoints;
  shift: number;
  flow_min: number;
  flow_max: number;
  ac_background_shift: number;
}

export interface ZonePolicy {
  ac_rooms: AcRoom[];
  boiler: BoilerZoneMode;
  max_rods: number;
}

export type Bounds = [number, number, number];

export interface ZoneSettings {
  bounds: Bounds;
  hysteresis: number;
  policies: [ZonePolicy, ZonePolicy, ZonePolicy, ZonePolicy];
}

export interface PresetTargets {
  comfort: number;
  eco: number;
  night: number;
  away: number;
  night_start: string; // "HH:MM:SS" (or "HH:MM")
  night_end: string;
}

export interface SeasonSettings {
  mode: SeasonMode;
  threshold: number;
  window_hours: number;
  hysteresis: number;
}

export interface BoilerSettings {
  mode: BoilerMode;
  kp: number;
  ki_per_hour: number;
  corr_limit: number;
  overheat_margin: number;
  overheat_after_s: number;
  resume_margin: number;
  classic_hysteresis: number;
  classic_coldest_tolerance: number;
  write_min_delta: number;
  write_min_interval_s: number;
  write_budget_per_day: number;
  budget_low_threshold: number;
  budget_low_min_delta: number;
  fallback_flow: number;
}

export interface AcSettings {
  deadband: number;
  step_interval_s: number;
  setpoint_min: number;
  setpoint_max: number;
  min_outdoor: number;
  fail_error: number;
  fail_after_s: number;
  command_grace_s: number;
  night: Record<AcRoom, NightMode>;
}

export interface LoadSettings {
  limit_kw: number;
  restore_kw: number;
  shed_after_s: number;
  pause_s: number;
  step_interval_s: number;
  restore_after_s: number;
}

export interface HhSettings {
  hybrid: boolean;
  preset: Preset;
  targets: PresetTargets;
  curve: CurveSettings;
  zones: ZoneSettings;
  boiler: BoilerSettings;
  ac: AcSettings;
  load: LoadSettings;
  season: SeasonSettings;
  layers: Record<Layer, LayerMode>;
  room_offsets: Partial<Record<Room, number>>;
  sensor_offsets: Partial<Record<Room, number>>;
  timezone: string;
  outdoor_stale_after_s: number;
}

/** Arrays are replaced whole; objects are merged key by key. */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

// ---- websocket replies

export interface HhModelParams {
  h_w_per_k: number;
  gains_w: number;
  tariff_per_kwh: number;
  currency: string;
  rod_kw: number;
  ac_rated_kw: Record<AcRoom, number>;
  ac_share: Record<AcRoom, number>;
}

/** This integration's own entities, which the card drives through their services. */
export interface HhControls {
  enabled: string;
  hybrid: string;
  preset: string;
  boiler_mode: string;
}

export interface HhConfigReply {
  revision: number;
  version: string;
  enabled: boolean;
  settings: HhSettings;
  entities: Record<string, string | boolean>;
  controls: HhControls;
  takeover: Record<string, unknown>;
  status: string;
  model?: Partial<HhModelParams>;
}

export interface HhReason {
  layer: string;
  code: string;
  data: Record<string, unknown>;
  text: string;
}

export interface HhAcStatus {
  available: boolean;
  hvac: string | null;
  setpoint: number | null;
  owned: boolean;
  quiet: boolean;
  degraded: boolean;
}

export interface HhStatus {
  revision: number;
  seq: { log: number; suggestions: number };
  enabled: boolean;
  season_active: boolean;
  now: string;
  t_out: number | null;
  t_out_window_mean: number | null;
  zone: ZoneIndex;
  preset: Preset;
  effective_preset: Preset;
  target: number;
  flow_target: number | null;
  curve_flow: number | null;
  background_shift: number;
  correction: number;
  driver: { mode: 'coldest' | 'average'; room: Room | null; temp: number | null };
  boiler: {
    available: boolean;
    call_on: boolean | null;
    /** The module's own decision (also in observe mode, where call_on belongs to the old thermostat). */
    wanted: boolean | null;
    setpoint: number | null;
    rods_limit: number | null;
    writes_left: number;
  };
  rooms: Record<Room, number | null>;
  acs: Record<AcRoom, HhAcStatus>;
  load: {
    kw: number | null;
    water_heater_on: boolean | null;
    water_heater_shed: boolean;
    rods_shed: number;
    shedding: boolean;
  };
  reasons: HhReason[];
}

export interface HhLogAction {
  kind: string;
  value: unknown;
  room: string | null;
  status: 'ok' | 'skipped' | 'failed';
  detail: string | null;
}

/** One decision-log entry as the integration stores it; get_log adds `text` to each reason. */
export interface HhLogEntry {
  ts: string;
  kind: 'tick' | 'system';
  zone: number | null;
  target: number | null;
  preset: Preset | null;
  flow_target: number | null;
  season_active: boolean | null;
  reasons: HhReason[];
  actions: HhLogAction[];
}

export interface HhForecastHour {
  ts: string;
  t_out: number;
}

export interface HhForecast {
  hours: HhForecastHour[];
  source: string;
  updated: string;
}

export interface HhSuggestion {
  id: string;
  kind: string;
  state: 'new' | 'applied' | 'dismissed' | 'info';
  title: string;
  detail: string;
  created: string;
}

export interface HhFeedbackReply {
  suggestion: HhSuggestion | null;
}

// ---- the parts of Home Assistant's frontend object the card uses

export interface HassEntity {
  state: string;
  attributes?: Record<string, unknown>;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  locale?: { language: string };
  language?: string;
  themes?: { darkMode?: boolean };
  user?: { is_admin: boolean };
  config?: { time_zone: string };
}

export type SectionKey =
  | 'plan'
  | 'why'
  | 'forecast'
  | 'curve'
  | 'probe'
  | 'zone'
  | 'rooms'
  | 'load'
  | 'season'
  | 'suggestions'
  | 'log';

/** What the card shows that is not a setting: the selected zone, the probe and forecast hour. */
export interface UiState {
  sel: number;
  probe: number | null;
  fsel: number | null;
}

/** What a section asks the card to do (the `hh-action` event). */
export type HhAction =
  | { kind: 'preset'; preset: Preset }
  | { kind: 'hybrid'; on: boolean }
  | { kind: 'feedback'; room: Room; value: 'cold' | 'hot' }
  | { kind: 'apply' | 'dismiss'; id: string }
  | { kind: 'save' }
  | { kind: 'discard' };

export interface CardConfig {
  type: string;
  title?: string;
  hide_sections?: SectionKey[];
  tariff_per_kwh?: number;
  currency?: string;
}
