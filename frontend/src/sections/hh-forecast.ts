// "Next 48 hours": the forecast coloured by the zone the heating will be in, with energy and cost.
import { LitElement, css, html, nothing, svg } from 'lit';
import '../components/hh-hint';
import { WidthController } from '../components/width';
import { define, fire } from '../dom';
import { t, type Lang } from '../i18n/index';
import { dayLabel, localTime } from '../logic/context';
import { fmt } from '../logic/format';
import { forecastHourLine, forecastRun, forecastScale, forecastSummary, forecastTotals } from '../logic/model';
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
        cursor: pointer;
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
      .fc-line {
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

  private strip() {
    const s = this.settings!;
    const hours = this.forecast!.hours;
    const L = this.lang;
    const W = Math.max(300, this.size.width || 640);
    const H = 170;
    const left = 30;
    const right = W - 8;
    const T = 14;
    const B = 116;
    const bw = (right - left) / hours.length;
    const { tmin, tmax, ticks } = forecastScale(hours.map(h => h.t_out));
    const y = (v: number) => B - ((v - tmin) / (tmax - tmin)) * (B - T);
    const every = W < 520 ? 12 : 6;
    const sel = this.selIndex();
    const line = hours.map((h, i) => `${i ? 'L' : 'M'}${(left + i * bw + bw / 2).toFixed(1)} ${y(h.t_out).toFixed(1)}`).join(' ');
    return html`<svg viewBox="0 0 ${W} ${H}" role="group" tabindex="0" aria-label=${t(L, 'forecast.aria')}
      @mousedown=${(e: MouseEvent) => e.preventDefault() /* a click picks an hour; Tab brings the focus */}
      @keydown=${(e: KeyboardEvent) => this.onKey(e)}>
      ${hours.map(
        (h, i) => svg`<rect class="fc-bar band-${ZONE_TONE[zoneIndex(s.zones.bounds, h.t_out)]}" data-h=${i}
          x=${left + i * bw} y=${T} width=${bw + 0.5} height=${B - T}
          @click=${() => this.pick(sel === i ? null : i)}></rect>`,
      )}
      ${tmin < 0 && tmax > 0 ? svg`<line class="fc-zero" x1=${left} x2=${right} y1=${y(0)} y2=${y(0)}></line>` : nothing}
      ${ticks.map(
        v => svg`<text class="fc-t" x=${left - 6} y=${y(v) + 4} text-anchor="end">${v > 0 ? `+${v}` : fmt(v, 0, L)}</text>`,
      )}
      <path class="fc-line" d=${line}></path>
      ${sel !== null
        ? svg`<rect class="fc-sel" x=${left + sel * bw} y=${T} width=${bw} height=${B - T}></rect>
            <circle cx=${left + sel * bw + bw / 2} cy=${y(hours[sel]!.t_out)} r="4" fill="var(--ink)"></circle>`
        : nothing}
      ${hours.map((h, i) => {
        const local = localTime(h.ts, this.tz);
        const x = left + i * bw;
        return svg`${local.hour % every === 0 || i === 0
          ? svg`<text class="fc-t" x=${x + bw / 2} y=${B + 16} text-anchor="middle">${local.hhmm}</text>`
          : nothing}${local.hour === 0 || i === 0
          ? svg`<text class="fc-day" x=${x + 2} y=${B + 36}>${dayLabel(h.ts, this.tz, L)}</text>`
          : nothing}`;
      })}
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
    const row = sel === null || !this.model ? null : this.rows()[sel]!;
    return html`${this.strip()}
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
