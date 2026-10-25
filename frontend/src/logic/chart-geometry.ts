// The flow-curve chart's coordinates: outdoor +20…−20 left to right, flow 25…75° bottom to top.
import type { HhSettings, PointIndex } from '../types';
import { bgCurveSegments, flowFor } from './curve';

export interface ChartGeom {
  W: number;
  H: number;
  L: number;
  R: number;
  T: number;
  B: number;
  /** The zone strip under the plot: top and height. */
  sy: number;
  sh: number;
  x(t: number): number;
  y(f: number): number;
  tx(px: number): number;
  fy(py: number): number;
}

export function chartGeom(width: number): ChartGeom {
  const W = Math.max(300, width || 640);
  const H = W < 560 ? 340 : 390;
  const L = 40;
  const R = W - 16;
  const T = 30;
  const B = H - 92;
  return {
    W,
    H,
    L,
    R,
    T,
    B,
    sy: B + 30,
    sh: 34,
    x: t => L + ((20 - t) / 40) * (R - L),
    y: f => B - ((f - 25) / 50) * (B - T),
    tx: px => 20 - ((px - L) / (R - L)) * 40,
    fy: py => 25 + ((B - py) / (B - T)) * 50,
  };
}

const line = (pts: [number, number][], g: ChartGeom): string =>
  pts.map(([t, f], i) => `${i ? 'L' : 'M'}${g.x(t).toFixed(1)} ${g.y(f).toFixed(1)}`).join(' ');

/** The full curve (no AC), with the flow limits, every quarter degree. */
export function curvePath(s: HhSettings, g: ChartGeom): string {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 160; i++) {
    const t = 20 - i * 0.25;
    pts.push([t, flowFor(s.curve, t, { acActive: false, hybrid: false })]);
  }
  return line(pts, g);
}

/** The lower curve the boiler follows while ACs heat; empty without hybrid mode. */
export function bgCurvePath(s: HhSettings, g: ChartGeom): string {
  return bgCurveSegments(s)
    .map(run => line(run, g))
    .join(' ');
}

/** The probe moves in half degrees within the chart. */
export function snapProbe(t: number): number {
  return Math.min(20, Math.max(-20, Math.round(t * 2) / 2));
}

export function boundFromPx(px: number, g: ChartGeom): number {
  return Math.round(g.tx(px));
}

/** Touch targets of the nine points must not overlap, even on a phone. */
export function pointHitRadius(g: ChartGeom): number {
  return Math.min(16, (g.R - g.L) / 16 - 1);
}

/** On a narrow chart only every other point is labelled, plus the one being moved. */
export function pointLabelVisible(i: PointIndex, g: ChartGeom, active: PointIndex | null): boolean {
  return (g.R - g.L) / 8 >= 44 || i % 2 === 0 || i === active;
}
