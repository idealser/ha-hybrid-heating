// A segmented choice: <hh-seg .options=${[{value, label}]} .value .small .disabled> → hh-select {value}.
import { LitElement, css, html } from 'lit';
import { define, fire } from '../dom';
import { shared } from '../styles/shared';

export interface SegOption {
  value: string;
  label: string;
}

export class HhSeg extends LitElement {
  static override properties = {
    options: { attribute: false },
    value: {},
    label: {},
    small: { type: Boolean },
    disabled: { type: Boolean },
  };
  declare options: SegOption[];
  declare value: string;
  declare label: string;
  declare small: boolean;
  declare disabled: boolean;

  constructor() {
    super();
    this.options = [];
    this.value = '';
    this.label = '';
    this.small = false;
    this.disabled = false;
  }

  static override styles = [
    shared,
    css`
      :host {
        display: inline-flex;
      }
      .seg {
        display: inline-flex;
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 2px;
        gap: 2px;
        flex-wrap: wrap;
      }
      button {
        font: inherit;
        font-size: 13px;
        border: 0;
        background: transparent;
        color: var(--ink);
        padding: 6px 12px;
        border-radius: 8px;
        cursor: pointer;
      }
      .small button {
        padding: 3px 9px;
        font-size: 12px;
      }
      button[aria-pressed='true'] {
        background: var(--ink);
        color: var(--surface);
      }
      button:disabled {
        cursor: default;
      }
      button:disabled:not([aria-pressed='true']) {
        opacity: 0.45;
      }
    `,
  ];

  override render() {
    return html`<div class="seg ${this.small ? 'small' : ''}" role="group" aria-label=${this.label || this.ariaLabel || ''}>
      ${this.options.map(
        o => html`<button
          type="button"
          aria-pressed=${String(o.value === this.value)}
          ?disabled=${this.disabled}
          @click=${() => o.value !== this.value && fire(this, 'hh-select', { value: o.value })}
        >
          ${o.label}
        </button>`,
      )}
    </div>`;
  }
}

define('hh-seg', HhSeg);
