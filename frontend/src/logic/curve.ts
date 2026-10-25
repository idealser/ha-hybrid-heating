// Mirror of core/curve.py: the weather curve and the flow the boiler gets.
import type { CurvePoints, CurveSettings, HhSettings, PointIndex } from '../types';
import { zoneIndex } from './zones';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Flow from the curve points plus the parallel shift, before limits; flat beyond the ends. */
export function rawCurve(c: CurveSettings, t: number): number {
  const pts = c.points;
  if (t >= pts[0][0]) return pts[0][1] + c.shift;
  for (let i = 0; i < pts.length - 1; i++) {
    const [tWarm, fWarm] = pts[i]!;
    const [tCold, fCold] = pts[i + 1]!;
    if (tCold <= t && t <= tWarm) return fWarm + ((fCold - fWarm) * (tWarm - t)) / (tWarm - tCold) + c.shift;
  }
  return pts[pts.length - 1]![1] + c.shift;
}

/** Flow setpoint: curve, lowered while ACs heat in hybrid mode, plus the room correction, clamped. */
export function flowFor(
  c: CurveSettings,
  t: number,
  o: { acActive: boolean; hybrid: boolean; correction?: number },
): number {
  const background = o.hybrid && o.acActive ? c.ac_background_shift : 0;
  return clamp(rawCurve(c, t) - background + (o.correction ?? 0), c.flow_min, c.flow_max);
}

/** A dragged point's flow: half degrees within 15..85. */
export function clampPointFlow(f: number): number {
  return clamp(Math.round(f * 2) / 2, 15, 85);
}

export function setPointFlow(c: CurveSettings, i: PointIndex, f: number): CurveSettings {
  const points = c.points.map((p, j) => (j === i ? [p[0], clampPointFlow(f)] : [...p])) as CurvePoints;
  return { ...c, points };
}

export function nudgePoint(c: CurveSettings, i: PointIndex, delta: number): CurveSettings {
  return setPointFlow(c, i, c.points[i][1] + delta);
}

/** Runs of the background curve: where the zone has an AC and it is warm enough for it to heat. */
export function bgCurveSegments(s: HhSettings, step = 0.25): [number, number][][] {
  if (!s.hybrid || s.curve.ac_background_shift <= 0) return [];
  const runs: [number, number][][] = [];
  let run: [number, number][] | null = null;
  for (let i = 0; i <= 40 / step; i++) {
    const t = 20 - i * step;
    const policy = s.zones.policies[zoneIndex(s.zones.bounds, t)];
    // As the core: no background shift where the boiler follows the coldest room (backup zones).
    if (policy.ac_rooms.length > 0 && policy.boiler === 'main' && t >= s.ac.min_outdoor) {
      if (!run) runs.push((run = []));
      run.push([t, flowFor(s.curve, t, { acActive: true, hybrid: true })]);
    } else {
      run = null;
    }
  }
  return runs;
}
