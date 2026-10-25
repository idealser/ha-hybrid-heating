// A value with − and + buttons: <hh-stepper .text .label .disabled> → hh-step {dir: -1 | 1}.
import { LitElement, css, html } from 'lit';
import { define, fire } from '../dom';
import { shared } from '../styles/shared';

export class HhStepper extends LitElement {
  static override properties = { text: {}, label: {}, disabled: { type: Boolean } };
  declare text: string;
  declare label: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.text = '';
    this.label = '';
    this.disabled = false;
  }

  static override styles = [
    shared,
    css`
      :host {
        display: inline-flex;
      }
      .stepper {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
        background: var(--surface);
      }
      button {
        font: inherit;
        border: 0;
        background: transparent;
        color: var(--ink);
        width: 32px;
        height: 32px;
        cursor: pointer;
        font-size: 16px;
      }
      button:hover:not(:disabled) {
        background: var(--bg);
      }
      button:disabled {
        opacity: 0.35;
        cursor: default;
      }
      .val {
        min-width: 64px;
        text-align: center;
        font-family: var(--font-data);
        font-size: 13px;
        padding: 0 4px;
      }
    `,
  ];

  private step(dir: -1 | 1) {
    fire(this, 'hh-step', { dir });
  }

  override render() {
    return html`<div class="stepper" role="group" aria-label=${this.label}>
      <button type="button" aria-label="${this.label} −" ?disabled=${this.disabled} @click=${() => this.step(-1)}>−</button>
      <span class="val" aria-live="polite">${this.text}</span>
      <button type="button" aria-label="${this.label} +" ?disabled=${this.disabled} @click=${() => this.step(1)}>+</button>
    </div>`;
  }
}

define('hh-stepper', HhStepper);
