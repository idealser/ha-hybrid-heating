// "Boiler flow temperature": the chart, the curve's limits and mode, and the list of weather zones.
import { LitElement, css, html, nothing } from 'lit';
import '../components/hh-hint';
import '../components/hh-seg';
import { stepperField } from '../components/fields';
import { define, fire } from '../dom';
import { t, type Lang } from '../i18n/index';
import { fmt } from '../logic/format';
import { getAt, setShift, type StepperKey } from '../logic/steppers';
import { shared } from '../styles/shared';
import type { BoilerMode, HhSettings, UiState } from '../types';
import './hh-curve-chart';

export class HhCurveCard extends LitElement {
  static override properties = {
    lang: {},
    settings: { attribute: false },
    tOut: { attribute: false },
    ui: { attribute: false },
    readOnly: { type: Boolean },
  };
  declare lang: Lang;
  declare settings: HhSettings | null;
  declare tOut: number | null;
  declare ui: UiState | null;
  declare readOnly: boolean;

  constructor() {
    super();
    this.lang = 'en';
    this.settings = null;
    this.tOut = null;
    this.ui = null;
    this.readOnly = false;
  }

  static override styles = [
    shared,
    css`
      .hint {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 16px;
        font-size: 12px;
        color: var(--muted);
      }
      .hint i {
        font-style: normal;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .sw {
        display: inline-block;
        width: 18px;
        height: 0;
        border-top: 3px solid var(--heat);
        border-radius: 2px;
      }
      .sw.now {
        border-top: 2px dashed var(--cold);
      }
      .sw.bg {
        border-top: 2px dashed var(--heat);
        opacity: 0.75;
      }
      .sw.probe {
        border-top: 1.5px solid var(--ink);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 20px;
        align-items: center;
      }
      .range-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      input[type='range'] {
        accent-color: var(--heat);
        width: 180px;
        max-width: 100%;
      }
    `,
  ];

  private edit(next: HhSettings): void {
    fire(this, 'hh-edit', { next });
  }

  private stepper(key: StepperKey, label: string, text: string) {
    return stepperField(this, this.settings!, key, label, text, this.readOnly);
  }

  override render() {
    const s = this.settings;
    if (!s) return nothing;
    const L = this.lang;
    const c = s.curve;
    const sel = this.ui?.sel ?? null;
    return html`<section class="card" aria-labelledby="h-curve">
      <div class="card-head">
        <h2 id="h-curve">${t(L, 'section.curve')}</h2>
        <hh-hint .lang=${L} .text=${t(L, 'curve.note', { limit: fmt(s.boiler.corr_limit, 0, L) })}></hh-hint>
      </div>
      <div class="hint">
        <i><span class="sw"></span>${t(L, 'curve.legend.curve')}</i>
        ${s.hybrid ? html`<i><span class="sw bg"></span>${t(L, 'curve.legend.bg')}</i>` : nothing}
        <i><span class="sw now"></span>${t(L, 'curve.legend.now')}</i>
        <i><span class="sw probe"></span>${t(L, 'curve.legend.probe')}</i>
      </div>
      <hh-curve-chart
        .lang=${L}
        .settings=${s}
        .tOut=${this.tOut}
        .ui=${this.ui}
        .readOnly=${this.readOnly}
      ></hh-curve-chart>
      <p class="note">${t(L, 'zones.note')}</p>
      <div class="controls">
        <div class="field">
          <label for="shift">${t(L, 'curve.shift')}</label>
          <div class="range-row">
            <input
              type="range"
              id="shift"
              min="-10"
              max="10"
              step="1"
              .value=${String(c.shift)}
              ?disabled=${this.readOnly}
              @input=${(e: Event) => this.edit(setShift(s, Number((e.target as HTMLInputElement).value)))}
            />
            <span class="num">${c.shift > 0 ? '+' : ''}${fmt(c.shift, 0, L)}°</span>
          </div>
        </div>
        ${this.stepper('curve.flow_min', t(L, 'curve.flow_min'), `${fmt(getAt(s, 'curve.flow_min'), 0, L)}°`)}
        ${this.stepper('curve.flow_max', t(L, 'curve.flow_max'), `${fmt(getAt(s, 'curve.flow_max'), 0, L)}°`)}
        <div class="field">
          <span class="lbl">${t(L, 'curve.mode')}</span>
          <hh-seg
            .label=${t(L, 'curve.mode')}
            .options=${(['smooth', 'classic'] as const).map(m => ({ value: m, label: t(L, `mode.${m}`) }))}
            .value=${s.boiler.mode}
            .disabled=${this.readOnly}
            @hh-select=${(e: CustomEvent<{ value: BoilerMode }>) =>
              this.edit({ ...s, boiler: { ...s.boiler, mode: e.detail.value } })}
          ></hh-seg>
        </div>
        <div id="bg-field" ?hidden=${!s.hybrid}>
          ${this.stepper('curve.ac_background_shift', t(L, 'curve.bg'), `−${fmt(c.ac_background_shift, 0, L)}°`)}
        </div>
      </div>
    </section>`;
  }
}

define('hh-curve-card', HhCurveCard);
