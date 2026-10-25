// "Zone settings": which ACs run in the selected weather zone, the boiler's role and its rods.
import { LitElement, css, html, nothing } from 'lit';
import '../components/hh-hint';
import '../components/hh-seg';
import '../components/hh-switch';
import { define, fire } from '../dom';
import { t, type Lang } from '../i18n/index';
import { fKw, fT } from '../logic/format';
import {
  setZoneBoiler,
  setZoneRods,
  toggleZoneAc,
  zoneLowerBound,
  zoneName,
  zoneRange,
  zoneSummary,
} from '../logic/zones';
import { shared } from '../styles/shared';
import { AC_ROOMS, type BoilerZoneMode, type HhModelParams, type HhSettings, type ZoneIndex } from '../types';

const BOILER_MODES: BoilerZoneMode[] = ['off', 'backup', 'main'];

export class HhZoneEditor extends LitElement {
  static override properties = {
    lang: {},
    settings: { attribute: false },
    model: { attribute: false },
    sel: { attribute: false },
    readOnly: { type: Boolean },
  };
  declare lang: Lang;
  declare settings: HhSettings | null;
  declare model: HhModelParams | null;
  declare sel: ZoneIndex;
  declare readOnly: boolean;

  constructor() {
    super();
    this.lang = 'en';
    this.settings = null;
    this.model = null;
    this.sel = 0;
    this.readOnly = false;
  }

  static override styles = [
    shared,
    css`
      .warn {
        display: block;
      }
    `,
  ];

  private edit(next: HhSettings): void {
    fire(this, 'hh-edit', { next });
  }

  override render() {
    const s = this.settings;
    if (!s) return nothing;
    const L = this.lang;
    const i = this.sel;
    const z = s.zones;
    const p = z.policies[i];
    const rodKw = this.model?.rod_kw ?? 2;
    const coldAcs = p.ac_rooms.length > 0 && zoneLowerBound(z.bounds, i) < s.ac.min_outdoor;
    return html`<section class="card" aria-labelledby="h-zone">
      <div class="card-head">
        <h2 id="h-zone">${t(L, 'zone.title', { name: zoneName(i, L) })}</h2>
        <p class="note">${t(L, 'zone_editor.range', { range: zoneRange(i, z.bounds, L) })}</p>
        <p class="small">${zoneSummary(p, L)}${!s.hybrid && p.ac_rooms.length ? t(L, 'zones.hybrid_off') : ''}</p>
      </div>
      <div class="field">
        <span class="lbl">${t(L, 'zone_editor.acs')}</span>
        <div class="pair">
          ${AC_ROOMS.map(
            room => html`<hh-switch
              .checked=${p.ac_rooms.includes(room)}
              .label=${t(L, `room.${room}`)}
              .disabled=${this.readOnly}
              @hh-toggle=${() => this.edit({ ...s, zones: toggleZoneAc(z, i, room) })}
            ></hh-switch>`,
          )}
        </div>
        ${coldAcs
          ? html`<p class="warn">${t(L, 'zone_editor.ac_cold', { t: fT(s.ac.min_outdoor, L) })}</p>`
          : html`<p class="note">${t(L, 'zone_editor.ac_note')}</p>`}
      </div>
      <div class="field">
        <span class="lbl">${t(L, 'zone_editor.boiler')}</span>
        <hh-seg
          .label=${t(L, 'zone_editor.boiler')}
          .options=${BOILER_MODES.map(m => ({ value: m, label: t(L, `boiler.${m}`) }))}
          .value=${p.boiler}
          .disabled=${this.readOnly}
          @hh-select=${(e: CustomEvent<{ value: BoilerZoneMode }>) =>
            this.edit({ ...s, zones: setZoneBoiler(z, i, e.detail.value) })}
        ></hh-seg>
        <hh-hint .lang=${L} .text=${t(L, `boiler_note.${p.boiler}`)}></hh-hint>
      </div>
      <div class="field">
        <span class="lbl">${t(L, 'zone_editor.rods')}</span>
        <hh-seg
          .label=${t(L, 'zone_editor.rods')}
          .options=${[1, 2, 3].map(n => ({ value: String(n), label: String(n) }))}
          .value=${String(p.max_rods)}
          .disabled=${this.readOnly}
          @hh-select=${(e: CustomEvent<{ value: string }>) =>
            this.edit({ ...s, zones: setZoneRods(z, i, Number(e.detail.value) as 1 | 2 | 3) })}
        ></hh-seg>
        <hh-hint .lang=${L} .text=${t(L, 'zone_editor.rods_note', { kw: fKw(p.max_rods * rodKw, L) })}></hh-hint>
      </div>
    </section>`;
  }
}

define('hh-zone-editor', HhZoneEditor);
