// "Apartment now": rooms tinted by how far they are from the target, with the devices that are running.
import { LitElement, css, html, nothing, svg } from 'lit';
import '../components/hh-hint';
import { define, fire } from '../dom';
import { t, type Lang } from '../i18n/index';
import { DASH, fDev, fmt } from '../logic/format';
import { acFlowPaths, deviceStates, glowRect, pointsAttr, roomTint } from '../logic/plan-render';
import type { FloorPlan, PlanAc, PlanRect } from '../plan/types';
import { shared } from '../styles/shared';
import { ROOMS, type AcRoom, type HhAction, type HhSettings, type HhStatus, type Room } from '../types';

export class HhFloorPlan extends LitElement {
  static override properties = {
    lang: {},
    plan: { attribute: false },
    schematic: { type: Boolean },
    status: { attribute: false },
    offsets: { attribute: false },
    settings: { attribute: false },
    learning: { type: Boolean },
    picked: { state: true },
    focused: { state: true },
  };
  declare lang: Lang;
  declare plan: FloorPlan | null;
  declare schematic: boolean;
  declare status: HhStatus | null;
  /** Room offsets: each room is tinted against its own target. */
  declare offsets: Partial<Record<Room, number>>;
  /** The saved settings (who runs the ACs), and whether Cold/Hot is offered. */
  declare settings: HhSettings | null;
  declare learning: boolean;
  declare picked: Room | null;
  declare focused: Room | null;

  constructor() {
    super();
    this.lang = 'en';
    this.plan = null;
    this.schematic = false;
    this.status = null;
    this.offsets = {};
    this.settings = null;
    this.learning = false;
    this.picked = null;
    this.focused = null;
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
        cursor: pointer;
      }
      .room:focus {
        outline: none;
      }
      /* Twice as wide as it shows: clipped to the room, so the walls on its edges do not hide it. */
      .ring {
        fill: none;
        stroke: var(--cold);
        stroke-width: 240;
        pointer-events: none;
      }
      .room-n,
      .room-t,
      .fh,
      .rad,
      .rad-glow,
      .ac-flow,
      .neutral {
        pointer-events: none;
      }
      .room-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .rc-head {
        display: flex;
        align-items: baseline;
        gap: 10px;
        flex-wrap: wrap;
      }
      .rc-head .close {
        margin-left: auto;
        font: inherit;
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
      }
      .fb {
        display: flex;
        gap: 6px;
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

  /** The picked or focused room, outlined from the inside above the walls. */
  private ring(p: FloorPlan, room: Room) {
    return p.rooms[room].polygons.map((poly, i) => {
      const id = `ring-${room}-${i}`;
      return svg`<clipPath id=${id}><polygon points=${pointsAttr(poly)}></polygon></clipPath>
        <polygon class="ring" data-room=${room} points=${pointsAttr(poly)} clip-path=${`url(#${id})`}></polygon>`;
    });
  }

  private offset(room: Room): number {
    return this.settings?.room_offsets[room] ?? this.offsets[room] ?? 0;
  }

  /** The picked room: its reading against its own target, what heats it, and Cold/Hot. */
  private roomCard(heatOn: boolean) {
    const room = this.picked;
    const st = this.status;
    if (!room || !st) return nothing;
    const L = this.lang;
    const temp = st.rooms[room];
    const target = st.target + this.offset(room);
    const acLine = room === 'living' || room === 'bedroom' ? this.acLine(room) : null;
    const heat = t(L, room === 'bath' ? (heatOn ? 'room.floor_on' : 'room.floor_off') : heatOn ? 'room.rads_on' : 'room.rads_off');
    const feedback = (value: 'cold' | 'hot') => fire<HhAction>(this, 'hh-action', { kind: 'feedback', room, value });
    return html`<div class="room-card" role="region" aria-label=${t(L, `room.${room}`)}>
      <div class="rc-head">
        <b>${t(L, `room.${room}`)}</b>
        <span class="num">${temp === null ? DASH : `${fmt(temp, 1, L)}°`}</span>
        <span class="muted small">
          ${t(L, 'room.target', { t: fmt(target, 1, L) })}${temp === null ? '' : ` (${fDev(temp - target, L)})`}
        </span>
        <button class="close" type="button" aria-label=${t(L, 'close')} @click=${() => (this.picked = null)}>×</button>
      </div>
      <p class="small">${heat}</p>
      ${acLine ? html`<p class="small">${acLine}</p>` : nothing}
      ${this.learning
        ? html`<div class="fb">
            <button class="btn sm" type="button" @click=${() => feedback('cold')}>${t(L, 'feedback.cold')}</button>
            <button class="btn sm" type="button" @click=${() => feedback('hot')}>${t(L, 'feedback.hot')}</button>
          </div>`
        : nothing}
    </div>`;
  }

  private acLine(room: AcRoom): string {
    const L = this.lang;
    const ac = this.status!.acs[room];
    if (!ac.available) return t(L, 'room.ac_unavailable');
    if (!ac.hvac || ac.hvac === 'off') return t(L, 'room.ac_off');
    const sp = ac.setpoint === null ? DASH : fmt(ac.setpoint, 0, L);
    const byModule = ac.hvac === 'heat' && this.settings?.layers.ac === 'active' && ac.owned;
    if (byModule) return t(L, 'room.ac_module', { sp });
    return ac.hvac === 'heat' ? t(L, 'room.ac_hand', { sp }) : t(L, 'room.ac_mode', { mode: ac.hvac });
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
        <hh-hint .lang=${L} .text=${t(L, 'plan.note') + (this.schematic ? ` ${t(L, 'plan.schematic')}` : '')}></hh-hint>
      </div>
      <svg viewBox=${p.viewBox.join(' ')} role="group" aria-label=${t(L, 'plan.aria')}>
        <defs>
          <pattern id="fh" width="260" height="260" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line class="fh-line" x1="0" y1="0" x2="0" y2="260"></line>
          </pattern>
        </defs>
        ${p.neutral.map(n => svg`<polygon class="neutral" points=${pointsAttr(n)}></polygon>`)}
        ${ROOMS.map(room => {
          const temp = st?.rooms[room] ?? null;
          const tint = roomTint(temp === null || !st ? null : temp - (st.target + this.offset(room)));
          const fill = tint.tone ? `var(--${tint.tone})` : 'transparent';
          const pick = () => (this.picked = this.picked === room ? null : room);
          return p.rooms[room].polygons.map(
            poly => svg`<polygon class="room" data-room=${room}
              points=${pointsAttr(poly)} fill=${fill} fill-opacity=${tint.opacity}
              tabindex="0" role="button" aria-label=${t(L, `room.${room}`)} aria-pressed=${String(this.picked === room)}
              @click=${pick}
              @focus=${() => (this.focused = room)}
              @blur=${() => (this.focused = null)}
              @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick())}
            ></polygon>`,
          );
        })}
        ${p.floor_heating.map(f => this.rect(f, `fh${heat}`))}
        ${p.radiators.map(r => svg`${this.rect(glowRect(r), `rad-glow${heat}`, 120)}${this.rect(r, `rad${heat}`, 30)}`)}
        ${p.glass.map(g => this.rect(g, 'glass'))}
        ${p.bays.map(b => svg`<polyline class="bay" points=${pointsAttr(b)}></polyline>`)}
        ${p.walls.map(w => svg`<polygon class="wall" points=${pointsAttr(w)}></polygon>`)}
        ${(Object.entries(p.acs) as [AcRoom, PlanAc][]).map(([room, ac]) => this.ac(ac, acOn[room]))}
        ${[...new Set([this.picked, this.focused])].map(room => (room ? this.ring(p, room) : nothing))}
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
      ${this.roomCard(heatOn)}
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
