// "Load limit": the limit and the restore level, what goes first, and the meter right now.
import { LitElement, css, html, nothing } from 'lit';
import '../components/hh-hint';
import { stepperField } from '../components/fields';
import { define } from '../dom';
import { t, type Lang } from '../i18n/index';
import { fKw } from '../logic/format';
import { loadMeter, shedNow } from '../logic/panels';
import { shared } from '../styles/shared';
import type { HhSettings, HhStatus } from '../types';

const SCALE_KW = 10;

export class HhLoad extends LitElement {
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
      ol.shed {
        margin: 0;
        padding-left: 20px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .meter {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .bar {
        height: 12px;
        border-radius: 999px;
        background: var(--bg);
        border: 1px solid var(--line);
        position: relative;
        overflow: hidden;
      }
      .fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--ac);
        transition: width 0.4s;
      }
      .fill.hi {
        background: var(--mix);
      }
      .mark {
        position: absolute;
        top: -1px;
        bottom: -1px;
        width: 2px;
        background: var(--ink);
      }
    `,
  ];

  override render() {
    const s = this.settings;
    if (!s) return nothing;
    const L = this.lang;
    const kw = this.status?.load.kw ?? null;
    const limit = s.load.limit_kw;
    const m = loadMeter(kw, limit, SCALE_KW);
    const shed = this.status ? shedNow(this.status, s, L) : null;
    return html`<section class="card" aria-labelledby="h-load">
      <div class="card-head">
        <h2 id="h-load">${t(L, 'section.load')}</h2>
        <hh-hint .lang=${L} .text=${t(L, 'load.note')}></hh-hint>
      </div>
      <div class="pair">
        ${stepperField(this, s, 'load.limit_kw', t(L, 'load.limit'), fKw(limit, L), this.readOnly)}
        ${stepperField(this, s, 'load.restore_kw', t(L, 'load.restore'), fKw(s.load.restore_kw, L), this.readOnly)}
      </div>
      <div class="field">
        <span class="lbl">${t(L, 'load.queue')}</span>
        <ol class="shed">
          <li>${t(L, 'load.q1', { s: s.load.shed_after_s, p: s.load.pause_s })}</li>
          <li>${t(L, 'load.q2', { step: s.load.step_interval_s })}</li>
          <li>
            ${t(L, 'load.q3', { restore: fKw(s.load.restore_kw, L), min: Math.round(s.load.restore_after_s / 60) })}
          </li>
        </ol>
      </div>
      ${shed ? html`<p class="warn">${shed}</p>` : nothing}
      <div class="meter">
        <div class="bar">
          <span class="fill ${m.hi ? 'hi' : ''}" style="width:${m.fill}%"></span>
          <span class="mark" style="left:${m.mark}%"></span>
        </div>
        <span class="small muted">
          ${kw === null
            ? t(L, 'load.now_unknown')
            : t(L, 'load.now', { kw: fKw(kw, L), limit: fKw(limit, L), scale: SCALE_KW })}
        </span>
      </div>
    </section>`;
  }
}

define('hh-load', HhLoad);
