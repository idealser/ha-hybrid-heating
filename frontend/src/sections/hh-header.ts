// Title, presets with their targets, and the hybrid switch (both go through the module's entities).
import { LitElement, css, html } from 'lit';
import '../components/hh-switch';
import { define, fire } from '../dom';
import { t, type Lang } from '../i18n/index';
import { fmt } from '../logic/format';
import { shared } from '../styles/shared';
import { PRESETS, type HhAction, type HhSettings, type Preset } from '../types';

export class HhHeader extends LitElement {
  static override properties = {
    lang: {},
    heading: {},
    version: {},
    settings: { attribute: false },
  };
  declare lang: Lang;
  declare heading: string;
  declare version: string;
  declare settings: HhSettings | null;

  constructor() {
    super();
    this.lang = 'en';
    this.heading = '';
    this.version = '';
    this.settings = null;
  }

  static override styles = [
    shared,
    css`
      .top {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 14px 24px;
      }
      .title {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        max-width: 560px;
      }
      .top-ctl {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      .presets {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .preset {
        font: inherit;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        min-width: 92px;
        padding: 8px 12px;
        border-radius: 12px;
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--ink);
        cursor: pointer;
        text-align: left;
      }
      .pt-n {
        font-weight: 600;
        font-size: 13px;
      }
      .pt-v {
        font-family: var(--font-data);
        font-size: 12px;
        color: var(--muted);
      }
      .preset[aria-pressed='true'] {
        background: var(--ink);
        color: var(--surface);
        border-color: var(--ink);
      }
      .preset[aria-pressed='true'] .pt-v {
        color: inherit;
        opacity: 0.75;
      }
    `,
  ];

  private act(action: HhAction) {
    fire(this, 'hh-action', action);
  }

  override render() {
    const s = this.settings;
    const L = this.lang;
    return html`<header class="top">
      <div class="title">
        <span class="eyebrow">Hybrid Heating${this.version ? ` · ${this.version}` : ''}</span>
        <h1>${this.heading || t(L, 'title')}</h1>
        <p class="muted">${t(L, 'subtitle')}</p>
      </div>
      ${s
        ? html`<div class="top-ctl">
            <div class="presets" role="group" aria-label=${t(L, 'preset.group')}>
              ${PRESETS.map(
                (p: Preset) => html`<button
                  type="button"
                  class="preset"
                  aria-pressed=${String(s.preset === p)}
                  @click=${() => s.preset !== p && this.act({ kind: 'preset', preset: p })}
                >
                  <span class="pt-n">${t(L, `preset.${p}`)}</span>
                  <span class="pt-v">${fmt(s.targets[p], 1, L)}°</span>
                </button>`,
              )}
            </div>
            <hh-switch
              .checked=${s.hybrid}
              .label=${t(L, 'hybrid')}
              @hh-toggle=${(e: CustomEvent<{ checked: boolean }>) => this.act({ kind: 'hybrid', on: e.detail.checked })}
            ></hh-switch>
          </div>`
        : null}
    </header>`;
  }
}

define('hh-header', HhHeader);
