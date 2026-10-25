// "Apartment now": rooms tinted by how far they are from the target, with the devices that are running.
import { LitElement, css, html, svg } from 'lit';
import { define } from '../dom';
import { t, type Lang } from '../i18n/index';
import { DASH, fmt } from '../logic/format';
import { acFlowPaths, deviceStates, glowRect, pointsAttr, roomTint } from '../logic/plan-render';
import type { FloorPlan, PlanAc, PlanRect } from '../plan/types';
import { shared } from '../styles/shared';
import { ROOMS, type AcRoom, type HhStatus, type Room } from '../types';

export class HhFloorPlan extends LitElement {
  static override properties = {
    lang: {},
    plan: { attribute: false },
    schematic: { type: Boolean },
    status: { attribute: false },
    offsets: { attribute: false },
  };
  declare lang: Lang;
  declare plan: FloorPlan | null;
  declare schematic: boolean;
  declare status: HhStatus | null;
  /** Room offsets: each room is tinted against its own target. */
  declare offsets: Partial<Record<Room, number>>;

  constructor() {
    super();
    this.lang = 'en';
    this.plan = null;
    this.schematic = false;
    this.status = null;
    this.offsets = {};
  }

  static override styles = [
    shared,
    css`
      svg {
        display: block;
        width: 100%;
        height: auto;
      }
      .wall {
        fill: var(--wall);
      }
      .glass {
        fill: var(--cold);
        opacity: 0.35;
      }
      .bay {
        fill: none;
        stroke: var(--cold);
        stroke-width: 70;
        opacity: 0.55;
        stroke-linejoin: round;
      }
      .neutral {
        fill: var(--line);
        fill-opacity: 0.45;
      }
      .room {
        transition: fill-opacity 0.4s;
      }
      .room-n {
        fill: var(--muted);
        font-size: 270px;
        font-family: var(--font-body);
      }
      .small-n {
        font-size: 230px;
      }
      .room-t {
        fill: var(--ink);
        font-size: 520px;
        font-family: var(--font-data);
        font-weight: 500;
      }
      .ac-unit {
        fill: var(--surface);
        stroke: var(--line-strong);
        stroke-width: 40;
      }
      .ac-unit.on {
        stroke: var(--ac);
        stroke-width: 60;
      }
      .ac-flow {
        fill: none;
        stroke: var(--ac);
        stroke-width: 55;
        stroke-linecap: round;
        stroke-dasharray: 170 230;
        opacity: 0;
      }
      .ac-flow.on {
        opacity: 0.9;
        animation: flow 1.4s linear infinite;
      }
      .rad {
        fill: var(--line-strong);
        transition: fill 0.3s;
      }
      .rad.on {
        fill: var(--heat);
      }
      .rad-glow {
        fill: var(--heat);
        opacity: 0;
      }
      .rad-glow.on {
        animation: glow 2.4s ease-in-out infinite;
      }
      .fh {
        fill: url(#fh);
        opacity: 0.12;
        transition: opacity 0.4s;
      }
      .fh.on {
        opacity: 0.45;
      }
      .fh-line {
        stroke: var(--heat);
        stroke-width: 45;
      }
      @keyframes flow {
        to {
          stroke-dashoffset: -400;
        }
      }
      @keyframes glow {
        0%,
        100% {
          opacity: 0.12;
        }
        50% {
          opacity: 0.32;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .ac-flow.on,
        .rad-glow.on {
          animation: none;
        }
        .rad-glow.on {
          opacity: 0.22;
        }
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
    `,
  ];

  private rect(r: PlanRect, cls: string, rx = 0) {
    return svg`<rect class=${cls} x=${r.x} y=${r.y} width=${r.w} height=${r.h} rx=${rx}></rect>`;
  }

  private ac(ac: PlanAc, on: boolean) {
    const state = on ? ' on' : '';
    return svg`${acFlowPaths(ac).map(d => svg`<path class=${`ac-flow${state}`} d=${d}></path>`)}
      ${this.rect(ac, `ac-unit${state}`, 60)}`;
  }

  override render() {
    const p = this.plan;
    const st = this.status;
    const L = this.lang;
    if (!p) return null;
    const { acOn, heatOn } = deviceStates(st);
    const heat = heatOn ? ' on' : '';
    return html`<section class="card" aria-labelledby="h-plan">
      <div class="card-head">
        <h2 id="h-plan">${t(L, 'section.plan')}</h2>
        <p class="note">${t(L, 'plan.note')}${this.schematic ? ` ${t(L, 'plan.schematic')}` : ''}</p>
      </div>
      <svg viewBox=${p.viewBox.join(' ')} role="img" aria-label=${t(L, 'plan.aria')}>
        <defs>
          <pattern id="fh" width="260" height="260" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line class="fh-line" x1="0" y1="0" x2="0" y2="260"></line>
          </pattern>
        </defs>
        ${p.neutral.map(n => svg`<polygon class="neutral" points=${pointsAttr(n)}></polygon>`)}
        ${ROOMS.map(room => {
          const temp = st?.rooms[room] ?? null;
          const tint = roomTint(temp === null || !st ? null : temp - (st.target + (this.offsets[room] ?? 0)));
          const fill = tint.tone ? `var(--${tint.tone})` : 'transparent';
          return p.rooms[room].polygons.map(
            poly => svg`<polygon class="room" data-room=${room} points=${pointsAttr(poly)} fill=${fill}
              fill-opacity=${tint.opacity}></polygon>`,
          );
        })}
        ${p.floor_heating.map(f => this.rect(f, `fh${heat}`))}
        ${p.radiators.map(r => svg`${this.rect(glowRect(r), `rad-glow${heat}`, 120)}${this.rect(r, `rad${heat}`, 30)}`)}
        ${p.glass.map(g => this.rect(g, 'glass'))}
        ${p.bays.map(b => svg`<polyline class="bay" points=${pointsAttr(b)}></polyline>`)}
        ${p.walls.map(w => svg`<polygon class="wall" points=${pointsAttr(w)}></polygon>`)}
        ${(Object.entries(p.acs) as [AcRoom, PlanAc][]).map(([room, ac]) => this.ac(ac, acOn[room]))}
        ${ROOMS.map(room => {
          const [x, y] = p.rooms[room].label;
          const temp = st?.rooms[room] ?? null;
          return svg`<text class="room-n" x=${x} y=${y - 560} text-anchor="middle">${t(L, `room.${room}`)}</text>
            <text class="room-t" x=${x} y=${y} text-anchor="middle">${temp === null ? DASH : `${fmt(temp, 1, L)}°`}</text>`;
        })}
        ${p.small_labels.map(
          s => svg`<text class="room-n small-n" x=${s.at[0]} y=${s.at[1]} text-anchor="middle">${t(L, `place.${s.key}`)}</text>`,
        )}
      </svg>
      <div class="legend">
        <i><b style="background:var(--cold);opacity:.5"></b>${t(L, 'legend.cold')}</i>
        <i><b style="background:var(--heat);opacity:.45"></b>${t(L, 'legend.heat')}</i>
        <i><b style="background:var(--ac)"></b>${t(L, 'legend.ac')}</i>
        <i><b style="background:var(--heat)"></b>${t(L, 'legend.rad')}</i>
      </div>
    </section>`;
  }
}

define('hh-floor-plan', HhFloorPlan);
