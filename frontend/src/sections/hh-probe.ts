// "What happens in this weather": where the heat would come from at a chosen outdoor temperature.
import { LitElement, css, html, nothing } from 'lit';
import '../components/hh-hint';
import { define, fire } from '../dom';
import { t, type Lang } from '../i18n/index';
import { snapProbe } from '../logic/chart-geometry';
import { fKw, fT, fmt } from '../logic/format';
import { probe, probeDaily } from '../logic/model';
import { zoneName } from '../logic/zones';
import { shared } from '../styles/shared';
import { AC_ROOMS, type HhModelParams, type HhSettings } from '../types';

export class HhProbe extends LitElement {
  static override properties = {
    lang: {},
    settings: { attribute: false },
    model: { attribute: false },
    probe: { attribute: false },
    tOut: { attribute: false },
  };
  declare lang: Lang;
  declare settings: HhSettings | null;
  declare model: HhModelParams | null;
  declare probe: number;
  declare tOut: number | null;

  constructor() {
    super();
    this.lang = 'en';
    this.settings = null;
    this.model = null;
    this.probe = 0;
    this.tOut = null;
  }

  static override styles = [
    shared,
    css`
      input[type='range'] {
        accent-color: var(--heat);
        width: 100%;
      }
      .probe-big {
        display: flex;
        align-items: baseline;
        gap: 10px;
        flex-wrap: wrap;
      }
      .probe-big .num {
        font-size: 30px;
        font-weight: 500;
      }
      .linkbtn {
        font: inherit;
        font-size: 12.5px;
        border: 1px solid var(--line);
        background: transparent;
        color: var(--ink);
        border-radius: 999px;
        padding: 4px 10px;
        cursor: pointer;
      }
      .linkbtn:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .stack {
        display: flex;
        height: 10px;
        border-radius: 999px;
        overflow: hidden;
        background: var(--bg);
        border: 1px solid var(--line);
      }
      .stack i {
        display: block;
        height: 100%;
      }
      .s-ac {
        background: var(--ac);
      }
      .s-b {
        background: var(--heat);
      }
      .s-short {
        background: repeating-linear-gradient(45deg, var(--deep) 0 4px, transparent 4px 8px);
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 16px;
        font-size: 12px;
        color: var(--muted);
      }
      .legend i {
        font-style: normal;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .legend b {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 3px;
      }
      .readout {
        display: flex;
        flex-direction: column;
      }
      .r {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 7px 0;
        border-bottom: 1px solid var(--line);
      }
      .r:last-child {
        border-bottom: 0;
      }
      .r span:last-child {
        font-family: var(--font-data);
        font-variant-numeric: tabular-nums;
        text-align: right;
      }
    `,
  ];

  override render() {
    const s = this.settings;
    const m = this.model;
    if (!s || !m) return nothing;
    const L = this.lang;
    const at = this.probe;
    const p = probe(s, m, at, { night: s.preset === 'night' });
    const day = probeDaily(p, m);
    const policy = s.zones.policies[p.zone];
    const total = Math.max(p.demandKw, 0.001);
    const pct = (v: number) => `${(v / total) * 100}%`;
    const rows: [string, string][] = [
      [
        t(L, 'probe.flow'),
        `${Math.round(p.flow)}°${p.background && s.curve.ac_background_shift ? t(L, 'probe.flow_bg') : ''}`,
      ],
      [t(L, 'probe.demand'), fKw(p.demandKw, L)],
      ...AC_ROOMS.map(
        room =>
          [t(L, `probe.ac_${room}`), p.acKw[room] > 0 ? fKw(p.acKw[room], L) : t(L, 'probe.off')] as [string, string],
      ),
      [t(L, 'probe.cop'), p.cop ? `×${fmt(p.cop, 1, L)}` : '—'],
      [
        t(L, 'probe.boiler'),
        policy.boiler === 'off'
          ? t(L, 'probe.boiler_off')
          : t(L, 'probe.boiler_of', { kw: fmt(p.boilerKw, 1, L), cap: fKw(p.boilerCapKw, L) }),
      ],
      [t(L, 'probe.kwh'), `${fmt(day.kwh, 0, L)} ${t(L, 'unit.kwh')}`],
      [t(L, 'probe.cost'), `${fmt(day.cost, 0, L)} ${m.currency}`],
      [t(L, 'probe.saving'), day.saving > 0.005 ? `−${fmt(day.saving * 100, 0, L)}%` : t(L, 'probe.same')],
    ];
    return html`<section class="card" aria-labelledby="h-probe">
      <div class="card-head">
        <h2 id="h-probe">${t(L, 'section.probe')}</h2>
        <hh-hint .lang=${L} .text=${t(L, 'probe.note', { h: fmt(m.h_w_per_k, 0, L) })}></hh-hint>
      </div>
      <div class="field">
        <label for="probe">${t(L, 'probe.out')}</label>
        <input
          type="range"
          id="probe"
          min="-20"
          max="20"
          step="0.5"
          .value=${String(at)}
          @input=${(e: Event) => fire(this, 'hh-ui', { probe: snapProbe(Number((e.target as HTMLInputElement).value)) })}
        />
      </div>
      <div class="probe-big">
        <span class="num">${fT(at, L)}</span>
        <span class="muted">${t(L, 'probe.zone', { name: zoneName(p.zone, L) })}</span>
        <button
          class="linkbtn"
          id="probe-now"
          type="button"
          ?disabled=${this.tOut === null}
          @click=${() => this.tOut !== null && fire(this, 'hh-ui', { probe: this.tOut, fsel: null })}
        >
          ${t(L, 'probe.now')}
        </button>
      </div>
      <div class="stack" aria-hidden="true">
        <i class="s-ac" style="width:${pct(p.acTotalKw)}"></i><i class="s-b" style="width:${pct(p.boilerKw)}"></i
        ><i class="s-short" style="width:${pct(p.shortKw)}"></i>
      </div>
      <div class="legend">
        <i><b style="background:var(--ac)"></b>${t(L, 'probe.legend.ac')}</i>
        <i><b style="background:var(--heat)"></b>${t(L, 'probe.legend.boiler')}</i>
        <i><b style="background:var(--deep)"></b>${t(L, 'probe.legend.short')}</i>
      </div>
      <div class="readout">${rows.map(([k, v]) => html`<div class="r"><span>${k}</span><span>${v}</span></div>`)}</div>
      ${p.shortKw > 0.05 ? html`<p class="warn">${t(L, 'probe.short', { kw: fKw(p.shortKw, L) })}</p>` : nothing}
    </section>`;
  }
}

define('hh-probe', HhProbe);
