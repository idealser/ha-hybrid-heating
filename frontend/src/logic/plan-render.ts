// Geometry and colours for the live floor plan.
import type { PlanAc, PlanRect, Pt } from '../plan/types';
import { AC_ROOMS, type AcRoom, type HhStatus } from '../types';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const r1 = (v: number): number => Math.round(v * 10) / 10;

export function pointsAttr(poly: Pt[]): string {
  return poly.map(([x, y]) => `${x},${y}`).join(' ');
}

/** Warmer than the target tints red, colder blue, stronger the further off; unknown is not tinted. */
export function roomTint(dev: number | null): { tone: 'heat' | 'cold' | null; opacity: number } {
  if (dev === null || !Number.isFinite(dev)) return { tone: null, opacity: 0 };
  const opacity = dev >= 0 ? clamp(0.1 + dev * 0.18, 0.1, 0.45) : clamp(0.12 - dev * 0.3, 0.12, 0.55);
  return { tone: dev >= 0 ? 'heat' : 'cold', opacity: Math.round(opacity * 100) / 100 };
}

/** Three wavy lines of air from the AC body into the room. */
export function acFlowPaths(ac: PlanAc): string[] {
  const y0 = ac.from;
  const dy = ac.to - ac.from;
  return [-300, 0, 300].map(dx => {
    const x = ac.cx + dx;
    return `M${x} ${r1(y0 + Math.sign(dy) * 60)} C${x - 220} ${r1(y0 + dy * 0.4)} ${x + 220} ${r1(y0 + dy * 0.75)} ${x} ${ac.to}`;
  });
}

export function glowRect(r: PlanRect, pad = 160): PlanRect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad };
}

export function deviceStates(st: HhStatus | null): { acOn: Record<AcRoom, boolean>; heatOn: boolean } {
  const acOn = Object.fromEntries(
    AC_ROOMS.map(room => [room, !!st && st.acs[room].available && st.acs[room].hvac === 'heat']),
  ) as Record<AcRoom, boolean>;
  // what really runs: the heat call, whoever drives it (in observe mode the old thermostat)
  return { acOn, heatOn: !!st && st.boiler.call_on === true };
}
