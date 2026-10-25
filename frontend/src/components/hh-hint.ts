// A section's explanation: its first sentence, the rest behind "ⓘ". <hh-hint .text .lang>
import { LitElement, css, html, nothing } from 'lit';
import { define } from '../dom';
import { t, type Lang } from '../i18n/index';
import { firstSentence } from '../logic/tabs';
import { shared } from '../styles/shared';

export class HhHint extends LitElement {
  static override properties = { text: {}, lang: {}, open: { state: true } };
  declare text: string;
  declare lang: Lang;
  declare open: boolean;

  constructor() {
    super();
    this.text = '';
    this.lang = 'en';
    this.open = false;
  }

  static override styles = [
    shared,
    css`
      :host {
        display: block;
      }
      .more {
        font: inherit;
        border: 0;
        background: transparent;
        color: var(--muted);
        padding: 0 2px;
        cursor: pointer;
      }
      .more:hover {
        color: var(--ink);
      }
    `,
  ];

  override render() {
    const { first, rest } = firstSentence(this.text);
    return html`<p class="note">
      ${this.open || !rest ? this.text : first}
      ${rest
        ? html`<button
            class="more"
            type="button"
            aria-expanded=${String(this.open)}
            aria-label=${t(this.lang, this.open ? 'hint.less' : 'hint.more')}
            @click=${() => (this.open = !this.open)}
          >
            ${this.open ? '−' : 'ⓘ'}
          </button>`
        : nothing}
    </p>`;
  }
}

define('hh-hint', HhHint);
