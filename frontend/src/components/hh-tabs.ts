// The card's tab bar: <hh-tabs .tabs=${[{key, label, dirty}]} .value .label .dirtyLabel> → hh-tab {key}.
import { LitElement, css, html, nothing } from 'lit';
import { define, fire } from '../dom';
import { shared } from '../styles/shared';

export interface TabItem {
  key: string;
  label: string;
  dirty: boolean;
}

export class HhTabs extends LitElement {
  static override properties = {
    tabs: { attribute: false },
    value: {},
    label: {},
    dirtyLabel: {},
  };
  declare tabs: TabItem[];
  declare value: string;
  declare label: string;
  declare dirtyLabel: string;
  private focusAfterUpdate: string | null = null;

  constructor() {
    super();
    this.tabs = [];
    this.value = '';
    this.label = '';
    this.dirtyLabel = '';
  }

  static override styles = [
    shared,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      [role='tablist'] {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--line);
        overflow-x: auto;
        scrollbar-width: none;
      }
      button {
        font: inherit;
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        border: 0;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        background: transparent;
        color: var(--muted);
        padding: 10px 14px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      button:hover {
        color: var(--ink);
      }
      button[aria-selected='true'] {
        color: var(--ink);
        border-bottom-color: var(--ink);
      }
      @container (max-width: 480px) {
        [role='tablist'] {
          gap: 0;
        }
        button {
          padding: 9px 8px;
          font-size: 13px;
        }
      }
      @container (max-width: 380px) {
        button {
          padding: 9px 6px;
        }
      }
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--heat);
      }
    `,
  ];

  private select(key: string, focus = false): void {
    if (focus) this.focusAfterUpdate = key;
    if (key !== this.value) fire(this, 'hh-tab', { key });
  }

  private onKey(e: KeyboardEvent): void {
    const i = this.tabs.findIndex(t => t.key === this.value);
    const last = this.tabs.length - 1;
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: last }[e.key];
    if (next === undefined || !this.tabs.length) return;
    e.preventDefault();
    this.select(this.tabs[(next + this.tabs.length) % this.tabs.length]!.key, true);
  }

  protected override updated(): void {
    if (this.focusAfterUpdate === this.value) {
      this.renderRoot.querySelector<HTMLElement>(`#tab-${this.value}`)?.focus();
      this.focusAfterUpdate = null;
    }
  }

  override render() {
    return html`<div role="tablist" aria-label=${this.label} @keydown=${this.onKey}>
      ${this.tabs.map(
        t => html`<button
          type="button"
          role="tab"
          id="tab-${t.key}"
          aria-selected=${String(t.key === this.value)}
          tabindex=${t.key === this.value ? 0 : -1}
          ?data-dirty=${t.dirty}
          @click=${() => this.select(t.key)}
        >
          ${t.label}${t.dirty ? html`<span class="dot" role="img" aria-label=${this.dirtyLabel}></span>` : nothing}
        </button>`,
      )}
    </div>`;
  }
}

define('hh-tabs', HhTabs);
