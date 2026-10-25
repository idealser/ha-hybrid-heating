// A fake Home Assistant for unit tests and the test harness: the integration's websocket commands
// and the entity services the card calls, with no network.
import { mergeSettings } from '../src/logic/draft';
import type {
  DeepPartial,
  HassEntity,
  HhConfigReply,
  HhLogEntry,
  HhSettings,
  HhStatus,
  HhSuggestion,
  HomeAssistant,
} from '../src/types';
import { CONFIG, FORECAST, LOG, STATUS_FROST, STATUS_NOW, STATUS_NULLS, SUGGESTIONS, TZ } from './fixtures';

export interface MockOptions {
  lang?: string;
  dark?: boolean;
  admin?: boolean;
  status?: 'now' | 'frost' | 'nulls';
  stage5?: boolean;
  backend?: boolean;
  plan?: unknown;
}

export interface MockHass extends HomeAssistant {
  calls: Record<string, unknown>[];
  services: { domain: string; service: string; data: Record<string, unknown> }[];
  failNext?: { code: string; message: string };
  /** Commands that keep failing until removed from here. */
  failOn: Record<string, { code: string; message: string }>;
  bumpConfig(changes: DeepPartial<HhSettings>): void;
  bumpLog(): void;
}

const UNKNOWN = { code: 'unknown_command', message: 'Unknown command.' };
const STATUSES = { now: STATUS_NOW, frost: STATUS_FROST, nulls: STATUS_NULLS } as const;
const STAGE5 = new Set([
  'hybrid_heating/get_forecast',
  'hybrid_heating/get_suggestions',
  'hybrid_heating/apply_suggestion',
  'hybrid_heating/dismiss_suggestion',
  'hybrid_heating/feedback',
]);

export function createMockHass(o: MockOptions = {}): MockHass {
  const lang = (o.lang ?? 'en').startsWith('ru') ? 'ru' : 'en';
  let config: HhConfigReply = structuredClone(CONFIG);
  let logSeq = 6;
  let plan = o.plan ?? null;
  const log: Record<'en' | 'ru', HhLogEntry[]> = structuredClone({ en: LOG.en.entries, ru: LOG.ru.entries });
  const suggestions: Record<'en' | 'ru', HhSuggestion[]> = structuredClone({
    en: SUGGESTIONS.en.suggestions,
    ru: SUGGESTIONS.ru.suggestions,
  });
  const controls = config.controls;
  const states: Record<string, HassEntity> = {
    [controls.enabled]: { state: 'on' },
    [controls.hybrid]: { state: config.settings.hybrid ? 'on' : 'off' },
    [controls.preset]: { state: config.settings.preset },
    [controls.boiler_mode]: { state: config.settings.boiler.mode },
  };

  const status = (): HhStatus => {
    const base = structuredClone(STATUSES[o.status ?? 'now']);
    const preset = states[controls.preset]!.state as HhStatus['preset'];
    return { ...base, revision: config.revision, seq: { ...base.seq, log: logSeq }, preset };
  };

  const hass: MockHass = {
    states,
    calls: [],
    services: [],
    failOn: {},
    locale: { language: o.lang ?? 'en' },
    language: o.lang ?? 'en',
    themes: { darkMode: o.dark ?? false },
    user: { is_admin: o.admin ?? true },
    config: { time_zone: TZ },

    async callWS<T>(msg: Record<string, unknown>): Promise<T> {
      hass.calls.push(msg);
      const type = String(msg.type);
      if (o.backend === false || (o.stage5 === false && STAGE5.has(type))) throw { ...UNKNOWN };
      if (hass.failOn[type]) throw { ...hass.failOn[type] };
      if (hass.failNext) {
        const err = hass.failNext;
        hass.failNext = undefined;
        throw { ...err };
      }
      const l = (msg.language === 'ru' ? 'ru' : msg.language === 'en' ? 'en' : lang) as 'en' | 'ru';
      switch (type) {
        case 'hybrid_heating/get_config':
          return structuredClone(config) as T;
        case 'hybrid_heating/set_config':
          config = {
            ...config,
            revision: config.revision + 1,
            settings: mergeSettings(config.settings, msg.settings as DeepPartial<HhSettings>),
          };
          return structuredClone(config) as T;
        case 'hybrid_heating/get_status':
          return status() as T;
        case 'hybrid_heating/get_log':
          return { entries: log[l].slice(0, Number(msg.limit ?? 100)) } as T;
        case 'hybrid_heating/get_plan':
          return { plan } as T;
        case 'hybrid_heating/set_plan':
          plan = msg.plan ?? null;
          return { plan } as T;
        case 'hybrid_heating/get_forecast':
          return structuredClone(FORECAST) as T;
        case 'hybrid_heating/get_suggestions':
          return { suggestions: structuredClone(suggestions[l]) } as T;
        case 'hybrid_heating/apply_suggestion': {
          for (const key of ['en', 'ru'] as const) {
            const s = suggestions[key].find(x => x.id === msg.id);
            if (s) s.state = 'applied';
          }
          if (msg.id === 'curve10') {
            const points = structuredClone(config.settings.curve.points);
            points[2] = [10, 41];
            config = { ...config, revision: config.revision + 1, settings: { ...config.settings, curve: { ...config.settings.curve, points } } };
          }
          return structuredClone(config) as T;
        }
        case 'hybrid_heating/dismiss_suggestion':
          for (const key of ['en', 'ru'] as const) {
            const s = suggestions[key].find(x => x.id === msg.id);
            if (s) s.state = 'dismissed';
          }
          return {} as T;
        case 'hybrid_heating/feedback':
          return { suggestion: null } as T;
        default:
          throw { ...UNKNOWN };
      }
    },

    async callService(domain: string, service: string, data: Record<string, unknown> = {}) {
      hass.services.push({ domain, service, data });
      const id = String(data.entity_id);
      if (domain === 'select' && service === 'select_option') states[id] = { state: String(data.option) };
      if (domain === 'switch') states[id] = { state: service === 'turn_on' ? 'on' : 'off' };
      return {};
    },

    bumpConfig(changes) {
      config = { ...config, revision: config.revision + 1, settings: mergeSettings(config.settings, changes) };
    },

    bumpLog() {
      logSeq += 1;
      for (const key of ['en', 'ru'] as const) log[key].unshift({ ...log[key][0]!, ts: STATUS_NOW.now });
    },
  };
  return hass;
}
