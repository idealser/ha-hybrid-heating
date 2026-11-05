// A small dashboard card with only the flat: the floor plan, tinted by the rooms, and the devices running.
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { HhApi } from './api';
import { fire } from './dom';
import { PLAN_CHANGED } from './editor';
import { pickLang, t, type Lang } from './i18n/index';
import { hassLanguage, relevantHassChanged } from './logic/hass';
import { SCHEMATIC } from './plan/builtin';
import './sections/hh-floor-plan';
import { CardStore, type StoreView } from './store';
import { shared } from './styles/shared';
import { tokens } from './styles/tokens';
import type { HhAction, HomeAssistant } from './types';

export interface PlanCardConfig {
  type: string;
  /** Replaces the heading ("Apartment now"). */
  title?: string;
  /** false: no heading at all, only the plan. */
  show_title?: boolean;
}

export function normalizePlanConfig(c: unknown): PlanCardConfig {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) throw new Error('Invalid configuration');
  const raw = c as Record<string, unknown>;
  if (raw.title !== undefined && typeof raw.title !== 'string') throw new Error('title must be text');
  if (raw.show_title !== undefined && typeof raw.show_title !== 'boolean')
    throw new Error('show_title must be true or false');
  return raw as unknown as PlanCardConfig;
}

export class HybridHeatingPlanCard extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _view: { state: true },
  };
  declare hass: HomeAssistant | undefined;
  declare _config: PlanCardConfig | undefined;
  declare _view: StoreView | undefined;
  private store: CardStore | undefined;
  private lastLang: Lang | undefined;

  static override styles = [
    tokens,
    shared,
    css`
      :host {
        display: block;
      }
    `,
  ];

  setConfig(config: PlanCardConfig): void {
    this._config = normalizePlanConfig(config);
  }

  getCardSize(): number {
    return 6;
  }

  getGridOptions(): { columns: number; min_columns: number } {
    return { columns: 12, min_columns: 6 };
  }

  static getStubConfig(): PlanCardConfig {
    return { type: 'custom:hybrid-heating-plan-card' };
  }

  get lang(): Lang {
    return pickLang(this.hass ? hassLanguage(this.hass) : undefined);
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
    if (changed.size === 1 && changed.has('hass'))
      return relevantHassChanged(changed.get('hass'), this.hass!, this._view?.config?.controls ?? null, []);
    return true;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('hass') || !this.hass) return;
    this.toggleAttribute('dark', this.hass.themes?.darkMode ?? false);
    if (!this.store) {
      this.store = new CardStore(new HhApi(() => this.hass!), {
        lang: () => this.lang,
        notify: message => fire(this, 'hass-notification', { message }),
        onChange: () => (this._view = this.store!.view),
        lite: true,
      });
      if (this.isConnected) void this.store.start();
    } else if (this.lastLang !== undefined && this.lastLang !== this.lang) {
      void this.store.poll(true);
    }
    this.lastLang = this.lang;
  }

  /** Cold/Hot: as on the full card, only when the module has a decision to keep with the mark. */
  private get canMark(): boolean {
    const v = this._view;
    return !!v && v.suggestions !== null && v.status?.enabled === true && v.status.decided;
  }

  private onAction(e: CustomEvent<HhAction>): void {
    const a = e.detail;
    if (a.kind === 'feedback') void this.store?.feedback(a.room, a.value);
  }

  override render() {
    const v = this._view;
    const L = this.lang;
    const heading = this._config?.title ?? '';
    const bare = this._config?.show_title === false;
    if (!v || v.phase !== 'ready')
      return html`<section class="card">
        ${bare ? nothing : html`<h2>${heading || t(L, 'section.plan')}</h2>`}
        ${v?.phase === 'error'
          ? html`<p class="warn" role="alert">${v.error}</p>`
          : html`<p class="muted" role="status">${t(L, 'loading')}</p>`}
      </section>`;
    return html`<hh-floor-plan
      @hh-action=${this.onAction}
      .lang=${L}
      .heading=${heading}
      .bare=${bare}
      .plan=${v.plan ?? SCHEMATIC}
      .schematic=${!v.plan}
      .status=${v.status}
      .offsets=${v.saved?.room_offsets ?? {}}
      .settings=${v.saved}
      .learning=${this.canMark}
    ></hh-floor-plan>`;
  }
}
