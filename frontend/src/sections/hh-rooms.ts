// "Rooms": the targets, each room against the target, "Cold"/"Hot" feedback and the ACs' night mode.
import { LitElement, css, html, nothing } from 'lit';
import '../components/hh-hint';
import { stepperField } from '../components/fields';
import '../components/hh-seg';
import { define, fire } from '../dom';
import { t, type Lang } from '../i18n/index';
import { DASH, fDev, fmt } from '../logic/format';
import { stepSetting, type StepperKey } from '../logic/steppers';
import '../components/hh-stepper';
import { shared } from '../styles/shared';
import { ROOMS, type AcRoom, type HhAction, type HhSettings, type HhStatus, type NightMode, type Room } from '../types';

const NIGHT: NightMode[] = ['quiet', 'off', 'day'];
const isAcRoom = (r: Room): r is AcRoom => r === 'living' || r === 'bedroom';
const hhmm = (time: string) => time.slice(0, 5);

export class HhRooms extends LitElement {
  static override properties = {
    lang: {},
    settings: { attribute: false },
    status: { attribute: false },
    learning: { type: Boolean },
    readOnly: { type: Boolean },
  };
  declare lang: Lang;
  declare settings: HhSettings | null;
  declare status: HhStatus | null;
  declare learning: boolean;
  declare readOnly: boolean;

  constructor() {
    super();
    this.lang = 'en';
    this.settings = null;
    this.status = null;
    this.learning = false;
    this.readOnly = false;
  }

  static override styles = [
    shared,
    css`
      .rooms {
        display: flex;
        flex-direction: column;
      }
      .roomrow {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 12px;
        padding: 9px 0;
        border-bottom: 1px solid var(--line);
        align-items: center;
      }
      .roomrow:last-child {
        border-bottom: 0;
      }
      .t {
        font-family: var(--font-data);
        font-variant-numeric: tabular-nums;
      }
      .by {
        font-size: 12.5px;
        color: var(--muted);
      }
      .fb {
        display: flex;
        gap: 6px;
        grid-column: 1/-1;
      }
      .fb button {
        font: inherit;
        font-size: 12px;
        border: 1px solid var(--line);
        background: transparent;
        color: var(--ink);
        border-radius: 999px;
        padding: 3px 10px;
        cursor: pointer;
      }
      .fb button.cold:hover {
        border-color: var(--cold);
        color: var(--cold);
      }
      .fb button.hot:hover {
        border-color: var(--heat);
        color: var(--heat);
      }
      .offset {
        grid-column: 1/-1;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .nightsel {
        grid-column: 1/-1;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 10px;
      }
    `,
  ];

  private target(key: StepperKey, label: string, value: number) {
    return stepperField(this, this.settings!, key, label, `${fmt(value, 1, this.lang)}°`, this.readOnly);
  }

  /** The room's target against the preset: the child sleeps cooler by default. */
  private offset(room: Room) {
    const s = this.settings!;
    const L = this.lang;
    const key = `room_offsets.${room}` as StepperKey;
    const label = t(L, 'rooms.offset', { room: t(L, `room.${room}`) });
    return html`<div class="offset">
      <span class="by">${t(L, 'rooms.offset_short')}</span>
      <hh-stepper
        .label=${label}
        .text=${`${fDev(s.room_offsets[room] ?? 0, L)}°`}
        .disabled=${this.readOnly}
        @hh-step=${(e: CustomEvent<{ dir: -1 | 1 }>) => fire(this, 'hh-edit', { next: stepSetting(s, key, e.detail.dir) })}
      ></hh-stepper>
    </div>`;
  }

  private row(room: Room) {
    const s = this.settings!;
    const L = this.lang;
    const temp = this.status?.rooms[room] ?? null;
    const target = this.status?.target ?? null;
    const feedback = (value: 'cold' | 'hot') =>
      fire<HhAction>(this, 'hh-action', { kind: 'feedback', room, value });
    return html`<div class="roomrow">
      <span><b>${t(L, `room.${room}`)}</b> <span class="by">· ${t(L, `room_by.${room}`)}</span></span>
      <span class="t"
        >${temp === null ? DASH : `${fmt(temp, 1, L)}°`}
        ${temp !== null && target !== null
          ? html`<span class="muted small">${fDev(temp - (target + (s.room_offsets[room] ?? 0)), L)}</span>`
          : nothing}</span
      >
      ${this.offset(room)}
      ${this.learning
        ? html`<div class="fb">
            <button type="button" class="cold" @click=${() => feedback('cold')}>${t(L, 'feedback.cold')}</button>
            <button type="button" class="hot" @click=${() => feedback('hot')}>${t(L, 'feedback.hot')}</button>
          </div>`
        : nothing}
      ${isAcRoom(room)
        ? html`<div class="nightsel">
            <span class="by">${t(L, 'rooms.ac_night')}</span>
            <hh-seg
              small
              .label=${t(L, 'rooms.ac_night')}
              .options=${NIGHT.map(m => ({ value: m, label: t(L, `night.${m}`) }))}
              .value=${s.ac.night[room]}
              .disabled=${this.readOnly}
              @hh-select=${(e: CustomEvent<{ value: NightMode }>) =>
                fire(this, 'hh-edit', {
                  next: { ...s, ac: { ...s.ac, night: { ...s.ac.night, [room]: e.detail.value } } },
                })}
            ></hh-seg>
          </div>`
        : nothing}
    </div>`;
  }

  override render() {
    const s = this.settings;
    if (!s) return nothing;
    const L = this.lang;
    const tg = s.targets;
    return html`<section class="card" aria-labelledby="h-rooms">
      <div class="card-head">
        <h2 id="h-rooms">${t(L, 'section.rooms')}</h2>
        <hh-hint .lang=${L} .text=${t(L, this.learning ? 'rooms.note' : 'rooms.note_plain')}></hh-hint>
      </div>
      <div class="pair">
        ${this.target('targets.comfort', t(L, 'preset.comfort'), tg.comfort)}
        ${this.target('targets.night', t(L, 'rooms.night', { start: hhmm(tg.night_start), end: hhmm(tg.night_end) }), tg.night)}
        ${this.target('targets.eco', t(L, 'preset.eco'), tg.eco)}
        ${this.target('targets.away', t(L, 'preset.away'), tg.away)}
      </div>
      ${s.boiler.mode === 'classic' // used only by the on/off mode
        ? this.target('boiler.classic_coldest_tolerance', t(L, 'rooms.tolerance'), s.boiler.classic_coldest_tolerance)
        : nothing}
      <div class="rooms">${ROOMS.map(r => this.row(r))}</div>
    </section>`;
  }
}

define('hh-rooms', HhRooms);
