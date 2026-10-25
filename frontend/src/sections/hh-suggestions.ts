// "Suggestions": what the module proposes to change. It never changes anything until an admin applies it.
import { LitElement, css, html, nothing } from 'lit';
import '../components/hh-hint';
import { define, fire } from '../dom';
import { t, type I18nKey, type Lang } from '../i18n/index';
import { shared } from '../styles/shared';
import type { HhAction, HhSuggestion } from '../types';

const KINDS = new Set(['curve', 'heat_loss', 'feedback']);

export class HhSuggestions extends LitElement {
  static override properties = { lang: {}, suggestions: { attribute: false }, canAct: { type: Boolean } };
  declare lang: Lang;
  declare suggestions: HhSuggestion[] | null | undefined;
  declare canAct: boolean;

  constructor() {
    super();
    this.lang = 'en';
    this.suggestions = undefined;
    this.canAct = false;
  }

  static override styles = [
    shared,
    css`
      .sugg {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .sg {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .sg-h {
        display: flex;
        gap: 8px;
        align-items: baseline;
        flex-wrap: wrap;
      }
      .tag {
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .act {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .sg.done {
        opacity: 0.6;
      }
    `,
  ];

  private act(action: HhAction): void {
    fire(this, 'hh-action', action);
  }

  private item(s: HhSuggestion) {
    const L = this.lang;
    const tag = KINDS.has(s.kind) ? t(L, `suggestion.kind.${s.kind}` as I18nKey) : s.kind;
    const done = s.state === 'applied' || s.state === 'dismissed';
    return html`<div class="sg ${done ? 'done' : ''}">
      <div class="sg-h"><span class="tag">${tag}</span><b>${s.title}</b></div>
      <p class="note">${s.detail}</p>
      ${s.state === 'new' && this.canAct
        ? html`<div class="act">
            <button class="btn sm primary" type="button" @click=${() => this.act({ kind: 'apply', id: s.id })}>
              ${t(L, 'suggestion.apply')}
            </button>
            <button class="btn sm" type="button" @click=${() => this.act({ kind: 'dismiss', id: s.id })}>
              ${t(L, 'suggestion.dismiss')}
            </button>
          </div>`
        : s.state === 'applied'
          ? html`<p class="small muted">${t(L, 'suggestion.applied')}</p>`
          : s.state === 'dismissed'
            ? html`<p class="small muted">${t(L, 'suggestion.dismissed')}</p>`
            : nothing}
    </div>`;
  }

  override render() {
    const L = this.lang;
    const list = this.suggestions;
    return html`<section class="card" aria-labelledby="h-sugg">
      <div class="card-head">
        <h2 id="h-sugg">${t(L, 'section.suggestions')}</h2>
        <hh-hint .lang=${L} .text=${t(L, 'suggestions.note')}></hh-hint>
      </div>
      ${list === undefined
        ? html`<p class="note">…</p>`
        : list === null
          ? html`<p class="note">${t(L, 'stage5.suggestions')}</p>`
          : list.length
            ? html`<div class="sugg">${list.map(s => this.item(s))}</div>`
            : html`<p class="note">${t(L, 'suggestions.empty')}</p>`}
    </section>`;
  }
}

define('hh-suggestions', HhSuggestions);
