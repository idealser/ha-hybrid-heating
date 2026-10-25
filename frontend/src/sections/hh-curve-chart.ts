// The flow curve: nine draggable points, zone bands with draggable boundaries, "now" and a probe.
import { LitElement, css, html, nothing, svg } from 'lit';
import { WidthController } from '../components/width';
import { define, fire } from '../dom';
import { t, type Lang } from '../i18n/index';
import {
  bgCurvePath,
  boundFromPx,
  chartGeom,
  curvePath,
  pointHitRadius,
  pointLabelVisible,
  snapProbe,
  type ChartGeom,
} from '../logic/chart-geometry';
import { clampPointFlow, flowFor, nudgePoint, setPointFlow } from '../logic/curve';
import { fF, fT, fmt } from '../logic/format';
import { setBound, stripLabel, ZONE_TONE, zoneName } from '../logic/zones';
import { shared } from '../styles/shared';
import type { HhSettings, PointIndex, UiState, ZoneIndex } from '../types';

type Drag = { k: 'p' | 'b'; i: number } | { k: 'probe' };

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export class HhCurveChart extends LitElement {
  static override properties = {
    settings: { attribute: false },
    tOut: { attribute: false },
    ui: { attribute: false },
    lang: {},
    readOnly: { type: Boolean },
    hover: { state: true },
    drag: { state: true },
    focused: { state: true },
  };
  declare settings: HhSettings | null;
  declare tOut: number | null;
  declare ui: UiState | null;
  declare lang: Lang;
  declare readOnly: boolean;
  declare hover: number | null;
  declare drag: Drag | null;
  declare focused: PointIndex | null;
  private readonly size = new WidthController(this);

  constructor() {
    super();
    this.settings = null;
    this.tOut = null;
    this.ui = null;
    this.lang = 'en';
    this.readOnly = false;
    this.hover = null;
    this.drag = null;
    this.focused = null;
  }

  static override styles = [
    shared,
    css`
      :host {
        display: block;
        width: 100%;
        min-width: 0;
        /* a swipe on the chart still scrolls the page; the points and grips take the touch themselves */
        touch-action: pan-y;
        user-select: none;
        -webkit-user-select: none;
      }
      svg {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
      }
      .grid-l {
        stroke: var(--line);
        stroke-width: 1;
      }
      .grid-z {
        stroke: var(--line-strong);
        stroke-width: 1;
      }
      .tick {
        fill: var(--muted);
        font-family: var(--font-data);
        font-size: 11px;
      }
      .axis-t {
        fill: var(--muted);
        font-size: 11px;
      }
      .clamp {
        stroke: var(--muted);
        stroke-width: 1;
        stroke-dasharray: 3 4;
        opacity: 0.7;
      }
      .clamp-t {
        fill: var(--muted);
        font-size: 10.5px;
      }
      .curve {
        fill: none;
        stroke: var(--heat);
        stroke-width: 3;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
      .curve-bg {
        fill: none;
        stroke: var(--heat);
        stroke-width: 2;
        stroke-dasharray: 6 5;
        opacity: 0.75;
        stroke-linecap: round;
      }
      .pt {
        fill: var(--surface);
        stroke: var(--heat);
        stroke-width: 2.5;
      }
      .pt-hit {
        fill: transparent;
        cursor: ns-resize;
        touch-action: none;
      }
      .pt-hit:focus {
        outline: none;
      }
      .pt-hit:focus-visible + .pt,
      .pt.active {
        stroke-width: 4;
      }
      .pt-label {
        fill: var(--ink);
        font-family: var(--font-data);
        font-size: 11px;
      }
      .now-l {
        stroke: var(--cold);
        stroke-width: 1.5;
        stroke-dasharray: 4 4;
      }
      .now-t {
        fill: var(--cold);
        font-size: 11.5px;
        font-weight: 600;
      }
      .probe-l {
        stroke: var(--ink);
        stroke-width: 1;
      }
      .probe-d {
        fill: var(--ink);
      }
      .probe-t {
        fill: var(--ink);
        font-size: 11.5px;
        font-weight: 600;
      }
      .hover-l {
        stroke: var(--muted);
        stroke-width: 1;
        stroke-dasharray: 2 3;
      }
      .hover-t {
        fill: var(--muted);
        font-size: 11px;
        font-family: var(--font-data);
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
      .strip {
        cursor: pointer;
      }
      .strip-ac {
        fill: var(--ac-fill);
        stroke: var(--ac);
      }
      .strip-mix {
        fill: var(--mix-fill);
        stroke: var(--mix);
      }
      .strip-heat {
        fill: var(--heat-fill);
        stroke: var(--heat);
      }
      .strip-deep {
        fill: var(--deep-fill);
        stroke: var(--deep);
      }
      .strip-t {
        fill: var(--ink);
        font-size: 12px;
        font-weight: 500;
        pointer-events: none;
      }
      .bnd-l {
        stroke: var(--line-strong);
        stroke-width: 1;
        stroke-dasharray: 2 3;
      }
      .grip {
        fill: var(--surface);
        stroke: var(--ink);
        stroke-width: 1.5;
      }
      .grip-hit {
        fill: transparent;
        cursor: ew-resize;
        touch-action: none;
      }
      .grip-hit:focus {
        outline: none;
      }
      .grip-hit:focus-visible + .grip {
        stroke-width: 3;
      }
      .grip-line {
        stroke: var(--ink);
        stroke-width: 1;
        pointer-events: none;
      }
      .bnd-t {
        fill: var(--ink);
        font-family: var(--font-data);
        font-size: 11px;
      }
      :host([read-only]) .pt-hit,
      :host([read-only]) .grip-hit {
        cursor: default;
      }
    `,
  ];

  protected override willUpdate(): void {
    this.toggleAttribute('read-only', this.readOnly);
  }

  private get g(): ChartGeom {
    return chartGeom(this.size.width);
  }

  private flow(t: number): number {
    return flowFor(this.settings!.curve, t, { acActive: false, hybrid: false });
  }

  private edit(next: HhSettings): void {
    fire(this, 'hh-edit', { next });
  }

  private setUi(patch: Partial<UiState>): void {
    fire(this, 'hh-ui', patch);
  }

  private at(e: PointerEvent): { px: number; py: number } {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const g = this.g;
    return { px: ((e.clientX - r.left) * g.W) / r.width, py: ((e.clientY - r.top) * g.H) / r.height };
  }

  private inPlot(px: number, py: number): boolean {
    const g = this.g;
    return px >= g.L && px <= g.R && py >= g.T && py <= g.B;
  }

  private onDown(e: PointerEvent): void {
    const target = e.target as SVGElement;
    const handle = target.closest<SVGElement>('[data-drag]');
    const zone = target.closest<SVGElement>('[data-zone]');
    const svgEl = e.currentTarget as SVGSVGElement;
    if (handle && !this.readOnly) {
      this.drag = { k: handle.dataset.drag as 'p' | 'b', i: Number(handle.dataset.i) };
      svgEl.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (zone) {
      this.setUi({ sel: Number(zone.dataset.zone) });
      return;
    }
    const { px, py } = this.at(e);
    if (this.inPlot(px, py)) {
      this.setUi({ probe: snapProbe(this.g.tx(px)) });
      this.drag = { k: 'probe' };
      svgEl.setPointerCapture(e.pointerId);
    }
  }

  private onMove(e: PointerEvent): void {
    const s = this.settings!;
    const { px, py } = this.at(e);
    const g = this.g;
    const d = this.drag;
    if (!d) {
      const h = this.inPlot(px, py) && e.pointerType === 'mouse' ? snapProbe(g.tx(px)) : null;
      if (h !== this.hover) this.hover = h;
      return;
    }
    if (d.k === 'probe') {
      const probe = snapProbe(g.tx(px));
      if (probe !== this.ui?.probe) this.setUi({ probe });
    } else if (d.k === 'p') {
      const i = d.i as PointIndex;
      const f = clampPointFlow(g.fy(py) - s.curve.shift);
      if (f !== s.curve.points[i][1]) this.edit({ ...s, curve: setPointFlow(s.curve, i, f) });
    } else {
      const bounds = setBound(s.zones.bounds, d.i as 0 | 1 | 2, boundFromPx(px, g));
      if (bounds[d.i] !== s.zones.bounds[d.i]) this.edit({ ...s, zones: { ...s.zones, bounds } });
    }
  }

  private endDrag(): void {
    this.drag = null;
  }

  private onKey(e: KeyboardEvent): void {
    const handle = (e.target as SVGElement).closest<SVGElement>('[data-drag]');
    if (!handle || this.readOnly) return;
    const s = this.settings!;
    const i = Number(handle.dataset.i);
    if (handle.dataset.drag === 'p') {
      const dir = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
      if (!dir) return;
      this.edit({ ...s, curve: nudgePoint(s.curve, i as PointIndex, dir * (e.shiftKey ? 2 : 0.5)) });
    } else {
      const dir = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0; // left is warmer
      if (!dir) return;
      this.edit({ ...s, zones: { ...s.zones, bounds: setBound(s.zones.bounds, i as 0 | 1 | 2, s.zones.bounds[i]! + dir) } });
    }
    e.preventDefault();
  }

  private onFocus(e: FocusEvent, on: boolean): void {
    const el = e.target as SVGElement;
    this.focused = on && el.dataset?.drag === 'p' ? (Number(el.dataset.i) as PointIndex) : null;
  }

  private grid(g: ChartGeom) {
    const { L, R, T, B, x, y, W } = g;
    const lines = [];
    for (let f = 25; f <= 75; f += 5) lines.push(svg`<line class="grid-l" x1=${L} x2=${R} y1=${y(f)} y2=${y(f)}></line>`);
    for (let t = 20; t >= -20; t -= 5)
      lines.push(svg`<line class=${t === 0 ? 'grid-z' : 'grid-l'} x1=${x(t)} x2=${x(t)} y1=${T} y2=${B}></line>`);
    for (let f = 30; f <= 70; f += 10)
      lines.push(svg`<text class="tick" x=${L - 8} y=${y(f) + 4} text-anchor="end">${f}</text>`);
    const step = W < 480 ? 10 : 5;
    for (let t = 20; t >= -20; t -= step)
      lines.push(svg`<text class="tick" x=${x(t)} y=${B + 16} text-anchor="middle">${t > 0 ? `+${t}` : fmt(t, 0, this.lang)}</text>`);
    return lines;
  }

  override render() {
    const s = this.settings;
    if (!s) return nothing;
    const g = this.g;
    const { W, H, L, R, T, B, x, y, sy, sh } = g;
    const Lg = this.lang;
    const c = s.curve;
    const bounds = s.zones.bounds;
    const edges = [20, ...bounds, -20];
    const bg = bgCurvePath(s, g);
    const hit = pointHitRadius(g);
    const sel = this.ui?.sel ?? null;
    const probe = this.ui?.probe ?? null;
    const now = this.tOut === null ? null : clamp(this.tOut, -20, 20);
    const active = this.drag?.k === 'p' ? (this.drag.i as PointIndex) : this.focused;
    const xn = now === null ? null : x(now);
    return html`<svg
      viewBox="0 0 ${W} ${H}"
      role="img"
      aria-label=${t(Lg, 'chart.aria')}
      @pointerdown=${this.onDown}
      @pointermove=${this.onMove}
      @pointerleave=${() => !this.drag && (this.hover = null)}
      @pointerup=${this.endDrag}
      @pointercancel=${this.endDrag}
      @keydown=${this.onKey}
      @focusin=${(e: FocusEvent) => this.onFocus(e, true)}
      @focusout=${(e: FocusEvent) => this.onFocus(e, false)}
    >
      ${[0, 1, 2, 3].map(i => {
        const x1 = x(edges[i]!);
        return svg`<rect class="band-${ZONE_TONE[i]}" x=${x1} y=${T} width=${x(edges[i + 1]!) - x1} height=${B - T}></rect>`;
      })}
      ${this.grid(g)}
      <text class="axis-t" x=${L} y=${T - 14}>${t(Lg, 'chart.flow_axis')}</text>
      <text class="axis-t" x=${R} y=${T - 14} text-anchor="end">
        ${t(Lg, W < 480 ? 'chart.out_axis_short' : 'chart.out_axis')}
      </text>
      <line class="clamp" x1=${L} x2=${R} y1=${y(c.flow_min)} y2=${y(c.flow_min)}></line>
      <text class="clamp-t" x=${L + 4} y=${y(c.flow_min) + 13}>${t(Lg, 'chart.min', { t: fmt(c.flow_min, 0, Lg) })}</text>
      <line class="clamp" x1=${L} x2=${R} y1=${y(c.flow_max)} y2=${y(c.flow_max)}></line>
      <text class="clamp-t" x=${R - 4} y=${y(c.flow_max) - 5} text-anchor="end">
        ${t(Lg, 'chart.max', { t: fmt(c.flow_max, 0, Lg) })}
      </text>
      ${bounds.map(b => svg`<line class="bnd-l" x1=${x(b)} x2=${x(b)} y1=${T} y2=${B}></line>`)}
      <path class="curve" d=${curvePath(s, g)}></path>
      ${bg ? svg`<path class="curve-bg" d=${bg}></path>` : nothing}
      ${this.hover !== null && !this.drag
        ? svg`<line class="hover-l" x1=${x(this.hover)} x2=${x(this.hover)} y1=${T} y2=${B}></line>
            <text class="hover-t" x=${clamp(x(this.hover) + 6, L, R - 70)} y=${B - 8}>
              ${fT(this.hover, Lg)} → ${Math.round(this.flow(this.hover))}°
            </text>`
        : nothing}
      ${xn !== null && now !== null
        ? svg`<line class="now-l" x1=${xn} x2=${xn} y1=${T} y2=${B}></line>
            <text class="now-t" x=${clamp(xn, L + 40, R - 40)} y=${T - 2} text-anchor="middle">
              ${t(Lg, 'chart.now', { t: fT(this.tOut!, Lg) })}
            </text>`
        : nothing}
      ${probe !== null
        ? svg`<line class="probe-l" x1=${x(probe)} x2=${x(probe)} y1=${T} y2=${B}></line>
            <circle class="probe-d" cx=${x(probe)} cy=${y(this.flow(probe))} r="4"></circle>
            <text class="probe-t" x=${clamp(x(probe), L + 54, R - 54)}
              y=${xn !== null && Math.abs(x(probe) - xn) < 90 ? T + 14 : T - 2} text-anchor="middle"
            >${fT(probe, Lg)} → ${Math.round(this.flow(probe))}°</text>`
        : nothing}
      ${c.points.map(([pt], i) => {
        const f = this.flow(pt);
        const cx = x(pt);
        const cy = y(f);
        const idx = i as PointIndex;
        return svg`<circle class="pt-hit" data-k="p${i}" data-drag="p" data-i=${i}
            tabindex=${this.readOnly ? -1 : 0} role="slider"
            aria-label=${t(Lg, 'chart.point', { t: fT(pt, Lg) })}
            aria-valuemin="15" aria-valuemax="85" aria-valuenow=${f} aria-valuetext=${fF(f, Lg)}
            aria-readonly=${this.readOnly ? 'true' : 'false'}
            cx=${cx} cy=${cy} r=${hit}></circle>
          <circle class="pt ${active === idx ? 'active' : ''}" cx=${cx} cy=${cy} r="6.5" pointer-events="none"></circle>
          ${pointLabelVisible(idx, g, active)
            ? svg`<text class="pt-label" x=${clamp(cx, L + 14, R - 14)} y=${cy - 12 < T + 4 ? cy + 22 : cy - 12}
                text-anchor="middle">${fF(f, Lg)}</text>`
            : nothing}`;
      })}
      ${[0, 1, 2, 3].map(i => {
        const x1 = x(edges[i]!);
        const w = x(edges[i + 1]!) - x1;
        const label = stripLabel(zoneName(i as ZoneIndex, Lg), w);
        return svg`<rect class="strip strip-${ZONE_TONE[i]}" data-zone=${i} x=${x1 + 1} y=${sy}
            width=${Math.max(0, w - 2)} height=${sh} rx="7" stroke-width=${sel === i ? 2 : 0}></rect>
          ${label ? svg`<text class="strip-t" x=${x1 + w / 2} y=${sy + sh / 2 + 4} text-anchor="middle">${label}</text>` : nothing}`;
      })}
      ${bounds.map((b, i) => {
        const bx = x(b);
        const names = { a: zoneName(i as ZoneIndex, Lg), b: zoneName((i + 1) as ZoneIndex, Lg) };
        return svg`<rect class="grip-hit" data-k="b${i}" data-drag="b" data-i=${i}
            tabindex=${this.readOnly ? -1 : 0} role="slider" aria-label=${t(Lg, 'chart.bound', names)}
            aria-valuemin="-19" aria-valuemax="19" aria-valuenow=${b} aria-valuetext=${fT(b, Lg)}
            aria-readonly=${this.readOnly ? 'true' : 'false'}
            x=${bx - 16} y=${sy - 6} width="32" height=${sh + 12}></rect>
          <rect class="grip" x=${bx - 6} y=${sy - 4} width="12" height=${sh + 8} rx="4" pointer-events="none"></rect>
          <line class="grip-line" x1=${bx - 2} x2=${bx - 2} y1=${sy + 10} y2=${sy + sh - 10}></line>
          <line class="grip-line" x1=${bx + 2} x2=${bx + 2} y1=${sy + 10} y2=${sy + sh - 10}></line>
          <text class="bnd-t" x=${clamp(bx, L + 12, R - 12)} y=${sy + sh + 20} text-anchor="middle">${fT(b, Lg)}</text>`;
      })}
    </svg>`;
  }
}

define('hh-curve-chart', HhCurveChart);
