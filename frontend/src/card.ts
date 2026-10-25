// The dashboard card: loads the module's data, lays out the sections and turns their events into calls.
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { HhApi } from './api';
import { PLAN_CHANGED } from './editor';
import { fire } from './dom';
import { pickLang, t, type Lang } from './i18n/index';
import { withLive } from './logic/draft';
import { normalizeConfig, type NormalConfig } from './logic/config';
import { hassLanguage, liveFromHass, relevantHassChanged } from './logic/hass';
import { withModelDefaults } from './logic/model';
import { buildWhy } from './logic/why';
import { SCHEMATIC } from './plan/builtin';
import './sections/hh-curve-card';
import './sections/hh-floor-plan';
import './sections/hh-forecast';
import './sections/hh-footer';
import './sections/hh-header';
import './sections/hh-load';
import './sections/hh-log';
import './sections/hh-probe';
import './sections/hh-rooms';
import './sections/hh-season';
import './sections/hh-suggestions';
import './sections/hh-why';
import './sections/hh-zone-editor';
import { CardStore, type StoreView } from './store';
import { shared } from './styles/shared';
import { tokens } from './styles/tokens';
import type {
  CardConfig,
  HhAction,
  HhModelParams,
  HhSettings,
  HomeAssistant,
  SectionKey,
  UiState,
  ZoneIndex,
} from './types';

type Slot = TemplateResult | typeof nothing;

/** The mockup's layout, top to bottom; a row with nothing to show is left out. */
const ROWS: { cls: string; keys: SectionKey[] }[] = [
  { cls: 'two', keys: ['plan', 'why'] },
  { cls: 'one', keys: ['forecast'] },
  { cls: 'two', keys: ['curve', 'probe'] },
  { cls: 'row3', keys: ['zone', 'rooms', 'load'] },
  { cls: 'row3', keys: ['season', 'suggestions', 'log'] },
];

export class HybridHeatingCard extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _view: { state: true },
    _ui: { state: true },
  };
  declare hass: HomeAssistant | undefined;
  declare _config: NormalConfig | undefined;
  declare _view: StoreView | undefined;
  declare _ui: UiState | undefined;
  private store: CardStore | undefined;
  private lastLang: Lang | undefined;

  static override styles = [
    tokens,
    shared,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      .wrap {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .two {
        display: grid;
        grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }
      .row3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        align-items: start;
      }
      @container (max-width: 940px) {
        .two,
        .row3 {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ];

  setConfig(config: CardConfig): void {
    this._config = normalizeConfig(config);
  }

  getCardSize(): number {
    return 30;
  }

  getGridOptions(): { columns: 'full' } {
    return { columns: 'full' };
  }

  static getStubConfig(): CardConfig {
    return { type: 'custom:hybrid-heating-card' };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement('hybrid-heating-card-editor');
  }

  get lang(): Lang {
    return pickLang(this.hass ? hassLanguage(this.hass) : undefined);
  }

  private get admin(): boolean {
    return this.hass?.user?.is_admin ?? false;
  }

  private readonly onPlanChanged = (): void => void this.store?.reloadPlan();

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(PLAN_CHANGED, this.onPlanChanged);
    if (this.store) void this.store.start();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(PLAN_CHANGED, this.onPlanChanged);
    this.store?.stop();
  }

  protected override shouldUpdate(changed: PropertyValues<this>): boolean {
    if (changed.size === 1 && changed.has('hass')) {
      return relevantHassChanged(changed.get('hass'), this.hass!, this._view?.config?.controls ?? null);
    }
    return true;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('hass') || !this.hass) return;
    this.toggleAttribute('dark', this.hass.themes?.darkMode ?? false);
    if (!this.store) {
      this.store = new CardStore(new HhApi(() => this.hass!), {
        lang: () => this.lang,
        notify: message => fire(this, 'hass-notification', { message }),
        onChange: () => this.adoptView(),
      });
      if (this.isConnected) void this.store.start();
    } else if (this.lastLang !== undefined && this.lastLang !== this.lang) {
      void this.store.poll(true); // texts in the new language
    }
    this.lastLang = this.lang;
  }

  private adoptView(): void {
    const view = this.store!.view;
    if (!this._ui && view.status) {
      const st = view.status;
      this._ui = { sel: st.zone, probe: st.t_out ?? st.t_out_window_mean ?? 0, fsel: null };
    }
    this._view = view;
  }

  /** The heat model: the integration's parameters, with the tariff and currency from the card options. */
  private get model(): HhModelParams {
    const c = this._config;
    return withModelDefaults({
      ...this._view?.config?.model,
      ...(c?.tariff_per_kwh !== undefined ? { tariff_per_kwh: c.tariff_per_kwh } : {}),
      ...(c?.currency ? { currency: c.currency } : {}),
    });
  }

  /** Times are shown in Home Assistant's time zone, not the browser's. */
  private get tz(): string {
    return this.hass?.config?.time_zone ?? 'UTC';
  }

  /** Settings with the preset and hybrid mode as their entities say right now. */
  private withLive(s: HhSettings | null): HhSettings | null {
    const c = this._view?.config;
    if (!s || !c || !this.hass) return s;
    return withLive(s, liveFromHass(this.hass, c.controls));
  }

  /** What the editors and the what-if parts show: the draft. */
  private get settings(): HhSettings | null {
    return this.withLive(this._view?.draft ?? null);
  }

  /** What the module runs with now: the saved settings ("Why" must not describe unsaved edits). */
  private get running(): HhSettings | null {
    return this.withLive(this._view?.saved ?? null);
  }

  private onAction(e: CustomEvent<HhAction>): void {
    const s = this.store;
    if (!s) return;
    const a = e.detail;
    switch (a.kind) {
      case 'preset':
        void s.setPreset(a.preset);
        break;
      case 'hybrid':
        void s.setHybrid(a.on);
        break;
      case 'feedback':
        void s.feedback(a.room, a.value);
        break;
      case 'apply':
        void s.applySuggestion(a.id);
        break;
      case 'dismiss':
        void s.dismissSuggestion(a.id);
        break;
      case 'save':
        void s.save();
        break;
      case 'discard':
        s.discard();
        break;
    }
  }

  private isHidden(key: SectionKey): boolean {
    return this._config?.hide_sections.includes(key) ?? false;
  }

  /** Each section's element; the ones not built yet show nothing. */
  protected section(key: SectionKey): Slot {
    const v = this._view!;
    const L = this.lang;
    const settings = this.settings;
    switch (key) {
      case 'plan':
        return html`<hh-floor-plan
          .lang=${L}
          .plan=${v.plan ?? SCHEMATIC}
          .schematic=${!v.plan}
          .status=${v.status}
          .offsets=${this.running?.room_offsets ?? {}}
        ></hh-floor-plan>`;
      case 'why':
        return v.status && this.running
          ? html`<hh-why .lang=${L} .view=${buildWhy(v.status, this.running, L)}></hh-why>`
          : nothing;
      case 'curve':
        return html`<hh-curve-card
          .lang=${L}
          .settings=${settings}
          .tOut=${v.status?.t_out ?? null}
          .ui=${this._ui ?? null}
          .readOnly=${!this.admin}
        ></hh-curve-card>`;
      case 'forecast':
        return html`<hh-forecast
          .lang=${L}
          .settings=${settings}
          .model=${this.model}
          .forecast=${v.forecast}
          .fsel=${this._ui?.fsel ?? null}
          .tz=${this.tz}
        ></hh-forecast>`;
      case 'probe':
        return html`<hh-probe
          .lang=${L}
          .settings=${settings}
          .model=${this.model}
          .probe=${this._ui?.probe ?? 0}
          .tOut=${v.status?.t_out ?? null}
        ></hh-probe>`;
      case 'zone':
        return html`<hh-zone-editor
          .lang=${L}
          .settings=${settings}
          .model=${this.model}
          .sel=${(this._ui?.sel ?? 0) as ZoneIndex}
          .readOnly=${!this.admin}
        ></hh-zone-editor>`;
      case 'rooms':
        return html`<hh-rooms
          .lang=${L}
          .settings=${settings}
          .status=${v.status}
          .learning=${v.suggestions !== null}
          .readOnly=${!this.admin}
        ></hh-rooms>`;
      case 'load':
        return html`<hh-load .lang=${L} .settings=${settings} .status=${v.status} .readOnly=${!this.admin}></hh-load>`;
      case 'season':
        return html`<hh-season
          .lang=${L}
          .settings=${settings}
          .status=${v.status}
          .readOnly=${!this.admin}
        ></hh-season>`;
      case 'suggestions':
        return html`<hh-suggestions
          .lang=${L}
          .suggestions=${v.suggestions}
          .canAct=${this.admin}
        ></hh-suggestions>`;
      case 'log':
        return html`<hh-log
          .lang=${L}
          .entries=${v.log}
          .now=${v.status?.now ?? new Date().toISOString()}
          .tz=${this.tz}
        ></hh-log>`;
      default:
        return nothing;
    }
  }

  private rows(): Slot[] {
    return ROWS.map(({ cls, keys }) => {
      const parts = keys.filter(k => !this.isHidden(k)).map(k => this.section(k)).filter(p => p !== nothing);
      if (!parts.length) return nothing;
      return cls === 'one' ? parts[0]! : html`<div class=${cls}>${parts}</div>`;
    });
  }

  override render() {
    const v = this._view;
    const L = this.lang;
    const header = html`<hh-header
      .lang=${L}
      .heading=${this._config?.title ?? ''}
      .version=${v?.config?.version ?? ''}
      .settings=${v?.phase === 'ready' ? this.settings : null}
    ></hh-header>`;
    if (!v || v.phase === 'loading')
      return html`<div class="wrap">${header}<p class="muted" role="status">${t(L, 'loading')}</p></div>`;
    if (v.phase === 'error')
      return html`<div class="wrap">${header}<p class="warn" role="alert">${v.error}</p></div>`;
    return html`<div
      class="wrap"
      @hh-action=${this.onAction}
      @hh-edit=${(e: CustomEvent<{ next: HhSettings }>) => this.store?.edit(e.detail.next)}
      @hh-ui=${(e: CustomEvent<Partial<UiState>>) => (this._ui = { ...this._ui!, ...e.detail })}
    >
      ${header} ${this.rows()}
      <hh-footer .lang=${L} .dirty=${v.dirty} .saving=${v.saving} .admin=${this.admin}></hh-footer>
    </div>`;
  }
}
