// The card's visual editor in the dashboard: title, sections, tariff, heat capacity, and the floor plan upload.
import { LitElement, css, html, nothing } from 'lit';
import { fire } from './dom';
import { pickLang, t, type Lang } from './i18n/index';
import { normalizeConfig, SECTION_KEYS, type NormalConfig } from './logic/config';
import { hassLanguage } from './logic/hass';
import { tokens } from './styles/tokens';
import { shared } from './styles/shared';
import type { CardConfig, HomeAssistant } from './types';

/** Tells the cards on the page to read the floor plan again. */
export const PLAN_CHANGED = 'hybrid-heating-plan-changed';

export class HybridHeatingCardEditor extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _planNote: { state: true },
  };
  declare hass: HomeAssistant | undefined;
  declare _config: NormalConfig | undefined;
  declare _planNote: string;

  constructor() {
    super();
    this._planNote = '';
  }

  static override styles = [
    tokens,
    shared,
    css`
      .form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      input[type='text'],
      input[type='number'] {
        font: inherit;
        padding: 6px 8px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        color: var(--ink);
      }
      .checks {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 6px 16px;
      }
      .checks label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: var(--ink);
      }
    `,
  ];

  setConfig(config: CardConfig): void {
    this._config = normalizeConfig(config);
  }

  private get uiLang(): Lang {
    return pickLang(this.hass ? hassLanguage(this.hass) : undefined);
  }

  private change(patch: Partial<CardConfig>): void {
    const next: Record<string, unknown> = { ...this._config!, ...patch };
    for (const [k, v] of Object.entries(next)) if (v === undefined || v === '') delete next[k];
    this._config = normalizeConfig(next);
    fire(this, 'config-changed', { config: this._config });
  }

  private toggle(key: (typeof SECTION_KEYS)[number], shown: boolean): void {
    const hidden = this._config!.hide_sections.filter(k => k !== key);
    this.change({ hide_sections: shown ? hidden : [...hidden, key] });
  }

  private async setPlan(plan: unknown): Promise<void> {
    const L = this.uiLang;
    try {
      await this.hass!.callWS({ type: 'hybrid_heating/set_plan', plan });
      this._planNote = t(L, plan === null ? 'editor.plan_cleared' : 'editor.plan_done');
      window.dispatchEvent(new CustomEvent(PLAN_CHANGED));
    } catch (e) {
      const message = typeof e === 'object' && e !== null && 'message' in e ? String(e.message) : String(e);
      this._planNote = t(L, 'editor.plan_error', { message });
    }
  }

  private async upload(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await this.setPlan(JSON.parse(await file.text()));
    } catch (err) {
      this._planNote = t(this.uiLang, 'editor.plan_error', { message: (err as Error).message });
    }
  }

  override render() {
    const c = this._config;
    if (!c) return nothing;
    const L = this.uiLang;
    const value = (e: Event) => (e.target as HTMLInputElement).value.trim();
    return html`<div class="form">
      <div class="field">
        <label for="title">${t(L, 'editor.title')}</label>
        <input
          type="text"
          id="title"
          name="title"
          placeholder=${t(L, 'title')}
          .value=${c.title ?? ''}
          @change=${(e: Event) => this.change({ title: value(e) || undefined })}
        />
      </div>
      <div class="field">
        <span class="lbl">${t(L, 'editor.sections')}</span>
        <div class="checks">
          ${SECTION_KEYS.map(
            key => html`<label>
              <input
                type="checkbox"
                name=${key}
                .checked=${!c.hide_sections.includes(key)}
                @change=${(e: Event) => this.toggle(key, (e.target as HTMLInputElement).checked)}
              />${t(L, `section.${key}`)}
            </label>`,
          )}
        </div>
      </div>
      <div class="pair">
        <div class="field">
          <label for="tariff">${t(L, 'editor.tariff')}</label>
          <input
            type="number"
            id="tariff"
            name="tariff_per_kwh"
            min="0"
            step="0.01"
            .value=${c.tariff_per_kwh === undefined ? '' : String(c.tariff_per_kwh)}
            @change=${(e: Event) => this.change({ tariff_per_kwh: value(e) === '' ? undefined : Number(value(e)) })}
          />
        </div>
        <div class="field">
          <label for="currency">${t(L, 'editor.currency')}</label>
          <input
            type="text"
            id="currency"
            name="currency"
            placeholder="€"
            .value=${c.currency ?? ''}
            @change=${(e: Event) => this.change({ currency: value(e) || undefined })}
          />
        </div>
      </div>
      <div class="field">
        <label for="capacity">${t(L, 'editor.capacity')}</label>
        <p class="note">${t(L, 'editor.capacity_note')}</p>
        <input
          type="number"
          id="capacity"
          name="capacity_kwh_per_k"
          min="0.1"
          step="0.1"
          placeholder=${t(L, 'editor.capacity_auto')}
          .value=${c.capacity_kwh_per_k === undefined ? '' : String(c.capacity_kwh_per_k)}
          @change=${(e: Event) => {
            const kwh = Number(value(e));
            this.change({ capacity_kwh_per_k: value(e) !== '' && kwh > 0 ? kwh : undefined });
          }}
        />
      </div>
      <div class="field">
        <label for="plan">${t(L, 'editor.plan')}</label>
        <p class="note">${t(L, 'editor.plan_note')}</p>
        <div class="pair">
          <input type="file" id="plan" name="plan_file" accept=".json,application/json" @change=${this.upload} />
          <button class="btn sm" type="button" @click=${() => this.setPlan(null)}>${t(L, 'editor.plan_reset')}</button>
        </div>
        ${this._planNote ? html`<p class="small" role="status">${this._planNote}</p>` : nothing}
      </div>
    </div>`;
  }
}
