// "Heating season" and "Control": when the module heats at all, and what each layer may do.
import { LitElement, css, html, nothing } from 'lit';
import '../components/hh-hint';
import { stepperField } from '../components/fields';
import '../components/hh-seg';
import { define, fire } from '../dom';
import { plural, t, type Lang } from '../i18n/index';
import { fmt } from '../logic/format';
import { seasonStatus } from '../logic/panels';
import { shared } from '../styles/shared';
import { LAYERS, type HhSettings, type HhStatus, type Layer, type LayerMode, type SeasonMode } from '../types';

const SEASON_MODES: SeasonMode[] = ['auto', 'on', 'off'];
const LAYER_MODES: LayerMode[] = ['off', 'observe', 'active'];

export class HhSeason extends LitElement {
  static override properties = {
    lang: {},
    settings: { attribute: false },
    status: { attribute: false },
    readOnly: { type: Boolean },
  };
  declare lang: Lang;
  declare settings: HhSettings | null;
  declare status: HhStatus | null;
  declare readOnly: boolean;

  constructor() {
    super();
    this.lang = 'en';
    this.settings = null;
    this.status = null;
    this.readOnly = false;
  }

  static override styles = [
    shared,
    css`
      .layers {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .layer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 6px 12px;
      }
    `,
  ];

  private edit(next: HhSettings): void {
    fire(this, 'hh-edit', { next });
  }

  override render() {
    const s = this.settings;
    if (!s) return nothing;
    const L = this.lang;
    const se = s.season;
    const fixed = this.readOnly || se.mode !== 'auto';
    return html`<section class="card" aria-labelledby="h-season">
      <div class="card-head">
        <h2 id="h-season">${t(L, 'section.season')}</h2>
        <hh-hint .lang=${L} .text=${t(L, 'season.note')}></hh-hint>
      </div>
      <div class="field">
        <span class="lbl">${t(L, 'season.mode')}</span>
        <hh-seg
          .label=${t(L, 'season.mode')}
          .options=${SEASON_MODES.map(m => ({ value: m, label: t(L, `season.mode.${m}`) }))}
          .value=${se.mode}
          .disabled=${this.readOnly}
          @hh-select=${(e: CustomEvent<{ value: SeasonMode }>) =>
            this.edit({ ...s, season: { ...se, mode: e.detail.value } })}
        ></hh-seg>
      </div>
      ${stepperField(this, s, 'season.threshold', t(L, 'season.threshold'), `${fmt(se.threshold, 1, L)}°`, fixed)}
      <div class="pair">
        ${stepperField(this, s, 'season.window_hours', t(L, 'season.window'), plural(L, 'hours', se.window_hours), fixed)}
        ${stepperField(this, s, 'season.hysteresis', t(L, 'season.hysteresis'), `${fmt(se.hysteresis, 1, L)}°`, fixed)}
      </div>
      ${this.status ? html`<p class="small">${seasonStatus(this.status, s, L)}</p>` : nothing}
      <div class="card-head">
        <h3>${t(L, 'layers.title')}</h3>
        <hh-hint .lang=${L} .text=${t(L, 'layers.note')}></hh-hint>
      </div>
      <div class="layers">
        ${LAYERS.map(
          (layer: Layer) => html`<div class="layer">
            <span>${t(L, `layers.${layer}`)}</span>
            <hh-seg
              small
              .label=${t(L, `layers.${layer}`)}
              .options=${LAYER_MODES.map(m => ({ value: m, label: t(L, `layer_mode.${m}`) }))}
              .value=${s.layers[layer]}
              .disabled=${this.readOnly}
              @hh-select=${(e: CustomEvent<{ value: LayerMode }>) =>
                this.edit({ ...s, layers: { ...s.layers, [layer]: e.detail.value } })}
            ></hh-seg>
          </div>`,
        )}
      </div>
    </section>`;
  }
}

define('hh-season', HhSeason);
