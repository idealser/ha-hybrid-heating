// "Next 48 hours": the forecast coloured by the zone the heating will be in, with energy and cost.
import { LitElement, css, html, nothing, svg } from 'lit';
import '../components/hh-hint';
import { WidthController } from '../components/width';
import { define, fire } from '../dom';
import { t, type Lang } from '../i18n/index';
import { dayLabel, localTime } from '../logic/context';
import { fmt } from '../logic/format';
import {
  forecastHourLine,
  forecastRun,
  forecastScale,
  forecastSummary,
  forecastTotals,
  niceKwh,
} from '../logic/model';
import { ZONE_TONE, zoneIndex } from '../logic/zones';
import { shared } from '../styles/shared';
import type { ForecastRow, ForecastStart } from '../logic/model';
import type { HhForecast, HhModelParams, HhSettings } from '../types';

export class HhForecastStrip extends LitElement {
  static override properties = {
    lang: {},
    settings: { attribute: false },
    model: { attribute: false },
    forecast: { attribute: false },
    fsel: { attribute: false },
    start: { attribute: false },
    tz: {},
  };
  declare lang: Lang;
  declare settings: HhSettings | null;
  declare model: HhModelParams | null;
  declare forecast: HhForecast | null | undefined;
  declare fsel: string | null;
  /** The season and the rooms now; without a status the flat starts at its target, in season. */
  declare start: ForecastStart | null;
  declare tz: string;
  private readonly size = new WidthController(this);

  constructor() {
    super();
    this.lang = 'en';
    this.settings = null;
    this.model = null;
    this.forecast = undefined;
    this.fsel = null;
    this.start = null;
    this.tz = 'UTC';
  }

  static override styles = [
    shared,
    css`
      .hour {
        margin: 6px 0 0;
        font-weight: 500;
      }
      svg:focus-visible {
        outline: 2px solid var(--cold);
        outline-offset: 2px;
      }
      svg {
        display: block;
        width: 100%;
        height: auto;
      }
      .fc-bar {
        fill: transparent;
        cursor: pointer;
      }
      .fc-bar:hover {
        fill: var(--ink);
        fill-opacity: 0.05;
      }
      .fc-panel {
        fill: var(--muted);
        font-size: 11px;
        font-weight: 600;
      }
      .fc-legend {
        fill: var(--muted);
        font-size: 11px;
      }
      .lg-in {
        fill: var(--ink);
      }
      .lg-target {
        fill: var(--muted);
      }
      .lg-boiler {
        fill: var(--fc-boiler);
      }
      .lg-ac {
        fill: var(--fc-ac);
      }
      .fc-in {
        fill: none;
        stroke: var(--ink);
        stroke-width: 2;
      }
      .fc-target {
        fill: none;
        stroke: var(--muted);
        stroke-width: 1.5;
        stroke-dasharray: 4 3;
      }
      .fc-kwh-boiler {
        fill: var(--fc-boiler);
      }
      .fc-kwh-ac {
        fill: var(--fc-ac);
      }
      .fc-axis {
        stroke: var(--line);
      }
      .fc-dot {
        fill: var(--ink);
        stroke: var(--surface);
        stroke-width: 2;
      }
      .band-ac {
        fill: var(--ac-fill);
      }
      .band-mix {
        fill: var(--mix-fill);
      }
      .band-heat {
        fill: var(--heat-fill);
      }
      .band-deep {
        fill: var(--deep-fill);
      }
      .fc-out {
        fill: none;
        stroke: var(--ink);
        stroke-width: 2;
      }
      .fc-sel {
        fill: none;
        stroke: var(--ink);
        stroke-width: 1.5;
      }
      .fc-t {
        fill: var(--muted);
        font-family: var(--font-data);
        font-size: 11px;
      }
      .fc-day {
        fill: var(--ink);
        font-size: 11.5px;
        font-weight: 600;
      }
      .fc-zero {
        stroke: var(--line-strong);
        stroke-dasharray: 3 3;
      }
      .fc-sum {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 24px;
        align-items: baseline;
      }
      .big {
        font-weight: 500;
        font-size: 22px;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  private rows(): ForecastRow[] {
    const start = this.start ?? { seasonActive: true, windowMean: null, indoor: null };
    return forecastRun(this.settings!, this.model!, this.forecast!.hours, this.tz, start);
  }

  /** The tapped hour's place in the hours now, or null (none, or no longer in the forecast). */
  private selIndex(): number | null {
    const i = this.fsel === null ? -1 : (this.forecast?.hours.findIndex(h => h.ts === this.fsel) ?? -1);
    return i >= 0 ? i : null;
  }

  private pick(i: number | null): void {
    const h = i === null ? undefined : this.forecast!.hours[i];
    fire(this, 'hh-ui', h ? { fsel: h.ts, probe: h.t_out } : { fsel: null });
  }

  private onKey(e: KeyboardEvent): void {
    const n = this.forecast!.hours.length;
    const cur = this.selIndex();
    const next: Record<string, number | null> = {
      ArrowRight: cur === null ? 0 : Math.min(n - 1, cur + 1),
      ArrowLeft: cur === null ? 0 : Math.max(0, cur - 1),
      Home: 0,
      End: n - 1,
      Escape: null,
    };
    if (!(e.key in next)) return;
    e.preventDefault();
    this.pick(next[e.key]!);
  }

  private strip(rows: ForecastRow[] | null) {
    const s = this.settings!;
    const hours = this.forecast!.hours;
    const L = this.lang;
    const W = Math.max(300, this.size.width || 640);
    const left = 30;
    const right = W - 8;
    // Three panels on one time axis, each on its own scale: outside, the flat inside, electricity per hour.
    const A = { top: 18, bottom: 104 };
    const B = { top: 130, bottom: 178 };
    const C = { top: 204, bottom: 244 };
    const last = rows ? C.bottom : A.bottom;
    const H = last + 44;
    const bw = (right - left) / hours.length;
    const xc = (i: number) => left + i * bw + bw / 2;
    const line = (vals: number[], y: (v: number) => number) =>
      vals.map((v, i) => `${i ? 'L' : 'M'}${xc(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    const { tmin, tmax, ticks } = forecastScale(hours.map(h => h.t_out));
    const yA = (v: number) => A.bottom - ((v - tmin) / (tmax - tmin)) * (A.bottom - A.top);
    const every = W < 520 ? 12 : 6;
    const sel = this.selIndex();
    const tick = (y: number, text: string) =>
      svg`<text class="fc-t" x=${left - 6} y=${y + 4} text-anchor="end">${text}</text>`;

    let inside: unknown = nothing;
    let energy: unknown = nothing;
    let insideDot: unknown = nothing;
    if (rows) {
      const temps = rows.flatMap(r => [r.indoor, r.target]);
      const lo = Math.floor(Math.min(...temps) - 0.5);
      const hi = Math.ceil(Math.max(...temps) + 0.5);
      const yB = (v: number) => B.bottom - ((v - lo) / (hi - lo)) * (B.bottom - B.top);
      const target = rows
        .map((r, i) => `${i ? 'L' : 'M'}${(left + i * bw).toFixed(1)} ${yB(r.target).toFixed(1)} L${(left + (i + 1) * bw).toFixed(1)} ${yB(r.target).toFixed(1)}`)
        .join(' ');
      inside = svg`
        <text class="fc-panel" x=${left} y=${B.top - 8}>${t(L, 'forecast.panel_in')}</text>
        <text class="fc-legend" x=${right} y=${B.top - 8} text-anchor="end"><tspan class="lg-in">━</tspan> ${t(L, 'forecast.legend_model')}  <tspan class="lg-target">┅</tspan> ${t(L, 'forecast.legend_target')}</text>
        <line class="fc-axis" x1=${left} x2=${right} y1=${B.bottom} y2=${B.bottom}></line>
        ${tick(yB(hi), `${hi}°`)}${tick(yB(lo), `${lo}°`)}
        <path class="fc-target" d=${target}></path>
        <path class="fc-in" d=${line(rows.map(r => r.indoor), yB)}></path>`;
      if (sel !== null) insideDot = svg`<circle class="fc-dot" cx=${xc(sel)} cy=${yB(rows[sel]!.indoor)} r="4"></circle>`;
      const top = niceKwh(Math.max(...rows.map(r => r.electricKwh)));
      const h = (kwh: number) => (kwh / top) * (C.bottom - C.top);
      const bar = Math.max(1, bw - 2); // a 2px gap between neighbouring bars
      const rx = Math.min(2, bar / 2);
      energy = svg`
        <text class="fc-panel" x=${left} y=${C.top - 8}>${t(L, 'forecast.panel_kwh')}</text>
        <text class="fc-legend" x=${right} y=${C.top - 8} text-anchor="end"><tspan class="lg-boiler">■</tspan> ${t(L, 'forecast.legend_boiler')}  <tspan class="lg-ac">■</tspan> ${t(L, 'forecast.legend_acs')}</text>
        ${tick(C.top, fmt(top, top < 1 ? 1 : 0, L))}${tick(C.bottom, '0')}
        ${rows.map((r, i) => {
          const x = left + i * bw + 1;
          const hb = h(r.boilerKwh);
          const ha = h(r.acKwh);
          const gap = hb >= 0.5 && ha >= 0.5 ? 2 : 0; // a surface gap between the stacked parts
          return svg`${hb >= 0.5 ? svg`<rect class="fc-kwh-boiler" x=${x} y=${C.bottom - hb} width=${bar} height=${hb} rx=${rx}></rect>` : nothing}${
            ha >= 0.5 ? svg`<rect class="fc-kwh-ac" x=${x} y=${C.bottom - hb - gap - ha} width=${bar} height=${ha} rx=${rx}></rect>` : nothing
          }`;
        })}
        <line class="fc-axis" x1=${left} x2=${right} y1=${C.bottom} y2=${C.bottom}></line>`;
    }

    return html`<svg viewBox="0 0 ${W} ${H}" role="group" tabindex="0" aria-label=${t(L, 'forecast.aria')}
      @mousedown=${(e: MouseEvent) => e.preventDefault() /* a click picks an hour; Tab brings the focus */}
      @keydown=${(e: KeyboardEvent) => this.onKey(e)}>
      <text class="fc-panel" x=${left} y=${A.top - 8}>${t(L, 'forecast.panel_out')}</text>
      ${hours.map(
        (h, i) => svg`<rect class="fc-zone band-${ZONE_TONE[zoneIndex(s.zones.bounds, h.t_out)]}"
          x=${left + i * bw} y=${A.top} width=${bw + 0.5} height=${A.bottom - A.top}></rect>`,
      )}
      ${tmin < 0 && tmax > 0 ? svg`<line class="fc-zero" x1=${left} x2=${right} y1=${yA(0)} y2=${yA(0)}></line>` : nothing}
      ${ticks.map(v => tick(yA(v), v > 0 ? `+${v}` : fmt(v, 0, L)))}
      <path class="fc-out" d=${line(hours.map(h => h.t_out), yA)}></path>
      ${inside}${energy}
      ${sel !== null
        ? svg`<rect class="fc-sel" x=${left + sel * bw} y=${A.top} width=${bw} height=${last - A.top}></rect>
            <circle class="fc-dot" cx=${xc(sel)} cy=${yA(hours[sel]!.t_out)} r="4"></circle>${insideDot}`
        : nothing}
      ${hours.map((h, i) => {
        const local = localTime(h.ts, this.tz);
        const x = left + i * bw;
        return svg`${local.hour % every === 0 || i === 0
          ? svg`<text class="fc-t" x=${x + bw / 2} y=${last + 16} text-anchor="middle">${local.hhmm}</text>`
          : nothing}${local.hour === 0 || i === 0
          ? svg`<text class="fc-day" x=${x + 2} y=${last + 36}>${dayLabel(h.ts, this.tz, L)}</text>`
          : nothing}`;
      })}
      ${hours.map(
        (_, i) => svg`<rect class="fc-bar" data-h=${i} x=${left + i * bw} y=${A.top} width=${bw + 0.5} height=${last - A.top}
          @click=${() => this.pick(sel === i ? null : i)}></rect>`,
      )}
    </svg>`;
  }

  private body() {
    const L = this.lang;
    const f = this.forecast;
    if (f === undefined) return html`<p class="note">…</p>`;
    if (f === null) return html`<p class="note">${t(L, 'stage5.forecast')}</p>`;
    if (f.unavailable) return html`<p class="note">${t(L, 'forecast.unavailable')}</p>`;
    if (!f.hours.length) return html`<p class="note">${t(L, 'forecast.empty')}</p>`;
    const sel = this.selIndex();
    const rows = this.model ? this.rows() : null;
    const row = sel === null || !rows ? null : rows[sel]!;
    return html`${this.strip(rows)}
      ${row ? html`<p class="hour" aria-live="polite">${forecastHourLine(this.settings!, f.hours[sel!]!, row, this.tz, L)}</p>` : nothing}
      <p class="small">${forecastSummary(this.settings!, f.hours, this.tz, L)}</p>`;
  }

  private totals() {
    const f = this.forecast;
    const m = this.model;
    if (!f?.hours.length || !m) return nothing;
    const L = this.lang;
    const start = this.start ?? { seasonActive: true, windowMean: null, indoor: null };
    const r = forecastTotals(this.settings!, m, f.hours, this.tz, start);
    if (r.heatedHours === 0) return html`<p class="muted small">${t(L, 'forecast.no_season')}</p>`;
    return html`<div class="fc-sum">
      <span><span class="big">${fmt(r.kwh, 0, L)}</span> <span class="muted">${t(L, 'unit.kwh')}</span></span>
      <span>
        <span class="big">${fmt(r.cost, 0, L)}</span>
        <span class="muted">${t(L, 'forecast.per48', { currency: m.currency })}</span>
      </span>
      <span class="muted small">
        ${t(L, 'forecast.boiler_only', { cost: `${fmt(r.boilerOnlyCost, 0, L)} ${m.currency}` })}
      </span>
    </div>`;
  }

  override render() {
    if (!this.settings) return nothing;
    const L = this.lang;
    return html`<section class="card" aria-labelledby="h-fc">
      <div class="head-row">
        <div class="card-head">
          <h2 id="h-fc">${t(L, 'section.forecast')}</h2>
          <hh-hint .lang=${L} .text=${t(L, 'forecast.note')}></hh-hint>
        </div>
        ${this.totals()}
      </div>
      ${this.body()}
    </section>`;
  }
}

define('hh-forecast', HhForecastStrip);
