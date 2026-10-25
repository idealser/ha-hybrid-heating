// The save bar: it slides up only while there are unsaved changes (admins only: settings are admin-only).
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
      :host {
        position: sticky;
        bottom: 12px;
        z-index: 3;
        display: block;
      }
      .foot {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: space-between;
        align-items: center;
        background: var(--surface);
        border: 1px solid var(--line-strong);
        border-radius: var(--r);
        padding: 10px 14px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
      }
      @media (prefers-reduced-motion: no-preference) {
        .foot {
          animation: up 0.18s ease-out;
        }
        @keyframes up {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
        }
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
    if (!this.admin || !this.dirty) return null;
    return html`<footer class="foot">
      <p class="small" role="status">${t(L, 'dirty')}</p>
      <div class="btns">
        <button class="btn" type="button" ?disabled=${this.saving} @click=${() => this.act({ kind: 'discard' })}>
          ${t(L, 'discard')}
        </button>
        <button class="btn primary" type="button" ?disabled=${this.saving} @click=${() => this.act({ kind: 'save' })}>
          ${t(L, 'save')}
        </button>
      </div>
    </footer>`;
  }
}

define('hh-footer', HhFooter);
