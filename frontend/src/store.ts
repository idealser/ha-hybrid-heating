// The card's data: what the integration has saved, the user's unsaved draft, and the live status.
import { HhApiError, type HhApi } from './api';
import { t, type Lang } from './i18n/index';
import { diffSettings, isDirty, rebaseDraft } from './logic/draft';
import type { FloorPlan } from './plan/types';
import type {
  HhConfigReply,
  HhForecast,
  HhLogEntry,
  HhSettings,
  HhStatus,
  HhSuggestion,
  Preset,
  Room,
} from './types';

export interface StoreView {
  phase: 'loading' | 'ready' | 'error';
  error: string | null;
  config: HhConfigReply | null;
  saved: HhSettings | null;
  draft: HhSettings | null;
  dirty: boolean;
  saving: boolean;
  status: HhStatus | null;
  log: HhLogEntry[];
  /** undefined: not loaded yet; null: this integration does not have it yet. */
  forecast: HhForecast | null | undefined;
  suggestions: HhSuggestion[] | null | undefined;
  /** The user's uploaded floor plan; null draws the built-in schematic. */
  plan: FloorPlan | null | undefined;
}

export interface StoreOptions {
  lang: () => Lang;
  notify: (message: string) => void;
  onChange: () => void;
  pollMs?: number;
}

const LOG_LIMIT = 20;
const FORECAST_EVERY_MS = 30 * 60_000;

const INITIAL: StoreView = {
  phase: 'loading',
  error: null,
  config: null,
  saved: null,
  draft: null,
  dirty: false,
  saving: false,
  status: null,
  log: [],
  forecast: undefined,
  suggestions: undefined,
  plan: undefined,
};

export class CardStore {
  view: StoreView = INITIAL;
  private timer: ReturnType<typeof setInterval> | undefined;
  private polling = false;
  private forecastAt = 0;

  constructor(
    private readonly api: HhApi,
    private readonly o: StoreOptions,
  ) {}

  private set(patch: Partial<StoreView>): void {
    this.view = { ...this.view, ...patch };
    this.o.onChange();
  }

  private problem(e: unknown): string {
    const err = e instanceof HhApiError ? e : new HhApiError('unknown_error', String(e));
    if (err.code === 'unknown_command') return t(this.o.lang(), 'error.not_set_up');
    if (err.code === 'not_loaded') return t(this.o.lang(), 'error.not_loaded');
    const lang = this.o.lang();
    if (err.code === 'invalid_config') return t(lang, 'error.invalid_config', { message: err.message });
    // Answers the integration gives in English: the card says them in its own words.
    const known = ['not_ready', 'stale', 'not_found', 'unauthorized'] as const;
    for (const code of known) if (err.code === code) return t(lang, `error.${code}`);
    return t(lang, 'error.generic', { message: err.message });
  }

  /**
   * Load everything once, then poll; after a failed load the same timer tries the load again (the module
   * may still be starting). Called again after stop(), it keeps the draft and only resumes.
   */
  async start(): Promise<void> {
    if (this.view.phase !== 'ready') await this.load();
    else void this.poll();
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => {
      if (!this.visible()) return;
      if (this.view.phase === 'error') void this.load();
      else void this.poll();
    }, this.o.pollMs ?? 15_000);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private visible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
  }

  private readonly onVisibility = (): void => {
    if (this.visible()) void this.poll();
  };

  /** An optional part (forecast, suggestions, plan): a failure leaves it unloaded, not the whole card. */
  private async optional<T>(get: () => Promise<T>): Promise<T | undefined> {
    try {
      return await get();
    } catch {
      return undefined;
    }
  }

  /** The forecast, asked every 30 minutes. No hourly forecast from the weather entity is an answer too: it
   * is kept (and said) until the next ask; any other failure leaves it unloaded for the next poll. */
  private async forecast(): Promise<HhForecast | null | undefined> {
    this.forecastAt = Date.now();
    try {
      return await this.api.getForecast();
    } catch (e) {
      if (e instanceof HhApiError && e.code === 'forecast_unavailable')
        return { source: '', updated: '', hours: [], unavailable: true };
      return undefined;
    }
  }

  private async load(): Promise<void> {
    const lang = this.o.lang();
    if (this.view.phase !== 'error') this.set({ ...INITIAL });
    try {
      const config = await this.api.getConfig();
      const [status, log, forecast, suggestions, plan] = await Promise.all([
        this.api.getStatus(lang),
        this.api.getLog(lang, LOG_LIMIT),
        this.forecast(),
        this.optional(() => this.api.getSuggestions(lang)),
        this.optional(() => this.api.getPlan<FloorPlan>()),
      ]);
      this.set({
        phase: 'ready',
        config,
        saved: config.settings,
        draft: config.settings,
        dirty: false,
        status,
        log,
        forecast,
        suggestions,
        plan: plan ?? null,
        error: null,
      });
    } catch (e) {
      this.set({ phase: 'error', error: this.problem(e) });
    }
  }

  /** New status; settings, log and suggestions only when their counters moved (or `texts` asks). */
  async poll(texts = false): Promise<void> {
    if (this.view.phase !== 'ready' || this.polling) return;
    this.polling = true;
    const lang = this.o.lang();
    const before = this.view.status;
    try {
      const status = await this.api.getStatus(lang);
      if (status.revision !== this.view.config?.revision) this.adopt(await this.api.getConfig());
      const patch: Partial<StoreView> = { status };
      if (texts || status.seq.log !== before?.seq.log) patch.log = await this.api.getLog(lang, LOG_LIMIT);
      const sugg = this.view.suggestions;
      if (sugg === undefined || (sugg !== null && (texts || status.seq.suggestions !== before?.seq.suggestions)))
        patch.suggestions = await this.optional(() => this.api.getSuggestions(lang));
      const fc = this.view.forecast;
      if (fc === undefined || (fc !== null && Date.now() - this.forecastAt >= FORECAST_EVERY_MS))
        patch.forecast = await this.forecast();
      this.set(patch);
    } catch {
      // Keep what is on screen, and redraw: the status line marks data that stopped coming as old.
      this.o.onChange();
    } finally {
      this.polling = false;
    }
  }

  /** New saved settings from the integration; unsaved edits are carried over onto them. */
  private adopt(config: HhConfigReply, keepDraft = true): void {
    const { saved, draft } = this.view;
    const next = keepDraft && saved && draft ? rebaseDraft(saved, config.settings, draft) : config.settings;
    this.set({ config, saved: config.settings, draft: next, dirty: isDirty(config.settings, next) });
  }

  edit(next: HhSettings): void {
    if (!this.view.saved) return;
    this.set({ draft: next, dirty: isDirty(this.view.saved, next) });
  }

  discard(): void {
    this.set({ draft: this.view.saved, dirty: false });
  }

  async save(): Promise<void> {
    const { saved, draft } = this.view;
    if (!saved || !draft || this.view.saving) return;
    this.set({ saving: true });
    try {
      this.adopt(await this.api.setConfig(diffSettings(saved, draft)), false);
      this.o.notify(t(this.o.lang(), 'saved'));
    } catch (e) {
      this.o.notify(this.problem(e));
    } finally {
      this.set({ saving: false });
    }
  }

  private async act(run: () => Promise<unknown>): Promise<void> {
    try {
      await run();
    } catch (e) {
      this.o.notify(this.problem(e));
    }
  }

  setPreset(preset: Preset): Promise<void> {
    return this.act(async () => {
      const c = this.view.config;
      if (c) await this.api.setPreset(c.controls.preset, preset);
    });
  }

  setHybrid(on: boolean): Promise<void> {
    return this.act(async () => {
      const c = this.view.config;
      if (c) await this.api.setHybrid(c.controls.hybrid, on);
    });
  }

  private async refreshSuggestions(): Promise<void> {
    this.set({ suggestions: await this.api.getSuggestions(this.o.lang()) });
  }

  feedback(room: Room, kind: 'cold' | 'hot'): Promise<void> {
    return this.act(async () => {
      const lang = this.o.lang();
      const r = await this.api.feedback(room, kind, lang);
      if (!r) return; // this integration does not take feedback yet
      const said = { room: t(lang, `room_low.${room}`), kind: t(lang, `feedback.kind.${kind}`) };
      this.o.notify(
        r.suggestion
          ? t(lang, 'feedback.toast_suggestion', { ...said, title: r.suggestion.title })
          : t(lang, 'feedback.toast', said),
      );
      if (r.suggestion) await this.refreshSuggestions();
    });
  }

  /** Read the floor plan again (an admin uploaded or removed one). */
  reloadPlan(): Promise<void> {
    return this.act(async () => this.set({ plan: await this.api.getPlan<FloorPlan>() }));
  }

  applySuggestion(id: string): Promise<void> {
    return this.act(async () => {
      const lang = this.o.lang();
      const title = this.view.suggestions?.find(s => s.id === id)?.title;
      this.adopt(await this.api.applySuggestion(id, lang));
      if (title) this.o.notify(t(lang, 'suggestion.applied_toast', { title }));
      await this.refreshSuggestions();
      this.set({ log: await this.api.getLog(lang, LOG_LIMIT) });
    });
  }

  dismissSuggestion(id: string): Promise<void> {
    return this.act(async () => {
      await this.api.dismissSuggestion(id);
      await this.refreshSuggestions();
    });
  }
}

