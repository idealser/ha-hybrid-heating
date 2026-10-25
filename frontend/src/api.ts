// The integration's websocket commands and the entity services the card uses.
import type { Lang } from './i18n/index';
import type {
  DeepPartial,
  HhConfigReply,
  HhFeedbackReply,
  HhForecast,
  HhLogEntry,
  HhSettings,
  HhStatus,
  HhSuggestion,
  HomeAssistant,
  Preset,
  Room,
} from './types';

export class HhApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HhApiError';
  }
}

export function isUnknownCommand(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'unknown_command';
}

function asApiError(e: unknown): HhApiError {
  if (e instanceof HhApiError) return e;
  const err = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; message?: unknown };
  return new HhApiError(String(err.code ?? 'unknown_error'), String(err.message ?? e));
}

export class HhApi {
  constructor(private readonly getHass: () => HomeAssistant) {}

  private async ws<T>(msg: Record<string, unknown>): Promise<T> {
    try {
      return await this.getHass().callWS<T>(msg);
    } catch (e) {
      throw asApiError(e);
    }
  }

  /** For commands a later version adds: null when this integration does not have them yet. */
  private async optional<T>(msg: Record<string, unknown>): Promise<T | null> {
    try {
      return await this.ws<T>(msg);
    } catch (e) {
      if (isUnknownCommand(e)) return null;
      throw e;
    }
  }

  getConfig(): Promise<HhConfigReply> {
    return this.ws({ type: 'hybrid_heating/get_config' });
  }

  setConfig(changes: DeepPartial<HhSettings>): Promise<HhConfigReply> {
    return this.ws({ type: 'hybrid_heating/set_config', settings: changes });
  }

  getStatus(lang: Lang): Promise<HhStatus> {
    return this.ws({ type: 'hybrid_heating/get_status', language: lang });
  }

  async getLog(lang: Lang, limit = 20): Promise<HhLogEntry[]> {
    const r = await this.ws<{ entries: HhLogEntry[] }>({ type: 'hybrid_heating/get_log', limit, language: lang });
    return r.entries;
  }

  /** The floor plan stored in Home Assistant, or null for the built-in schematic. */
  async getPlan<P>(): Promise<P | null> {
    const r = await this.optional<{ plan: P | null }>({ type: 'hybrid_heating/get_plan' });
    return r?.plan ?? null;
  }

  getForecast(): Promise<HhForecast | null> {
    return this.optional({ type: 'hybrid_heating/get_forecast' });
  }

  async getSuggestions(lang: Lang): Promise<HhSuggestion[] | null> {
    const r = await this.optional<{ suggestions: HhSuggestion[] }>({
      type: 'hybrid_heating/get_suggestions',
      language: lang,
    });
    return r ? r.suggestions : null;
  }

  applySuggestion(id: string, lang: Lang): Promise<HhConfigReply> {
    return this.ws({ type: 'hybrid_heating/apply_suggestion', id, language: lang });
  }

  async dismissSuggestion(id: string): Promise<void> {
    await this.ws({ type: 'hybrid_heating/dismiss_suggestion', id });
  }

  feedback(room: Room, kind: 'cold' | 'hot', lang: Lang): Promise<HhFeedbackReply | null> {
    return this.optional({ type: 'hybrid_heating/feedback', room, kind, language: lang });
  }

  async setPreset(entityId: string, preset: Preset): Promise<void> {
    await this.getHass().callService('select', 'select_option', { entity_id: entityId, option: preset });
  }

  async setHybrid(entityId: string, on: boolean): Promise<void> {
    await this.getHass().callService('switch', on ? 'turn_on' : 'turn_off', { entity_id: entityId });
  }

  async setEnabled(entityId: string, on: boolean): Promise<void> {
    await this.getHass().callService('switch', on ? 'turn_on' : 'turn_off', { entity_id: entityId });
  }
}
