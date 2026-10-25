// Whether there are unsaved changes, with Save and Discard (admins only: settings are admin-only).
import { LitElement, css, html } from 'lit';
import { define, fire } from '../dom';
import { t, type Lang } from '../i18n/index';
import { shared } from '../styles/shared';
import type { HhAction } from '../types';

export class HhFooter extends LitElement {
  static override properties = {
    lang: {},
    dirty: { type: Boolean },
    saving: { type: Boolean },
    admin: { type: Boolean },
  };
  declare lang: Lang;
  declare dirty: boolean;
  declare saving: boolean;
  declare admin: boolean;

  constructor() {
    super();
    this.lang = 'en';
    this.dirty = false;
    this.saving = false;
    this.admin = false;
  }

  static override styles = [
    shared,
    css`
      .foot {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: space-between;
        align-items: center;
      }
      .btns {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    `,
  ];

  private act(action: HhAction) {
    fire(this, 'hh-action', action);
  }

  override render() {
    const L = this.lang;
    const off = !this.dirty || this.saving;
    return html`<footer class="foot">
      <p class="small muted" role="status">
        ${this.admin ? t(L, this.dirty ? 'dirty' : 'clean') : t(L, 'read_only')}
      </p>
      ${this.admin
        ? html`<div class="btns">
            <button class="btn" type="button" ?disabled=${off} @click=${() => this.act({ kind: 'discard' })}>
              ${t(L, 'discard')}
            </button>
            <button class="btn primary" type="button" ?disabled=${off} @click=${() => this.act({ kind: 'save' })}>
              ${t(L, 'save')}
            </button>
          </div>`
        : null}
    </footer>`;
  }
}

define('hh-footer', HhFooter);
