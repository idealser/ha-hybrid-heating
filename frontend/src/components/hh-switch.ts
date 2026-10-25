// An on/off switch with its label inside: <hh-switch .checked .label .disabled> → hh-toggle {checked}.
import { LitElement, css, html } from 'lit';
import { define, fire } from '../dom';
import { shared } from '../styles/shared';

export class HhSwitch extends LitElement {
  static override properties = { checked: { type: Boolean }, label: {}, disabled: { type: Boolean } };
  declare checked: boolean;
  declare label: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.checked = false;
    this.label = '';
    this.disabled = false;
  }

  static override styles = [
    shared,
    css`
      :host {
        display: inline-flex;
      }
      .switch {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--line);
        background: var(--surface);
        border-radius: 999px;
        padding: 5px 12px 5px 6px;
        font: inherit;
        font-size: 13px;
        color: var(--ink);
        cursor: pointer;
      }
      .switch:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .knob {
        width: 34px;
        height: 20px;
        border-radius: 999px;
        background: var(--line-strong);
        position: relative;
        flex: none;
        transition: background 0.15s;
      }
      .knob::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--surface);
        transition: transform 0.15s;
      }
      .switch[aria-checked='true'] .knob {
        background: var(--ac);
      }
      .switch[aria-checked='true'] .knob::after {
        transform: translateX(14px);
      }
    `,
  ];

  override render() {
    return html`<button
      class="switch"
      type="button"
      role="switch"
      aria-checked=${String(this.checked)}
      ?disabled=${this.disabled}
      @click=${() => fire(this, 'hh-toggle', { checked: !this.checked })}
    >
      <span class="knob"></span>${this.label}
    </button>`;
  }
}

define('hh-switch', HhSwitch);
