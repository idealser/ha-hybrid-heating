// "Why": the module's current decisions in words, with the key numbers as chips.
import { LitElement, css, html } from 'lit';
import { define } from '../dom';
import { t, type Lang } from '../i18n/index';
import type { WhyView } from '../logic/why';
import { shared } from '../styles/shared';

export class HhWhy extends LitElement {
  static override properties = { lang: {}, view: { attribute: false } };
  declare lang: Lang;
  declare view: WhyView | null;

  constructor() {
    super();
    this.lang = 'en';
    this.view = null;
  }

  static override styles = [
    shared,
    css`
      .summary {
        font-size: 15px;
        font-weight: 600;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 6px 11px;
        font-size: 13px;
        white-space: nowrap;
      }
      .why {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .why li {
        display: grid;
        grid-template-columns: 10px minmax(0, 1fr);
        gap: 10px;
        align-items: start;
      }
      .pip {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-top: 5px;
      }
      b {
        font-weight: 600;
      }
      .pip-ac {
        background: var(--ac);
      }
      .pip-heat {
        background: var(--heat);
      }
      .pip-idle {
        background: var(--line-strong);
      }
      .pip-cold {
        background: var(--cold);
      }
      .pip-ok {
        background: var(--ok);
      }
    `,
  ];

  override render() {
    const v = this.view;
    if (!v) return null;
    return html`<section class="card" aria-labelledby="h-why">
      <div class="card-head">
        <h2 id="h-why">${t(this.lang, 'section.why')}</h2>
        <p class="summary">${v.summary}</p>
        <p class="note">${v.sub}</p>
      </div>
      <div class="chips">
        ${v.chips.map(c => html`<span class="chip">${c.label} <span class="num">${c.value}</span></span>`)}
      </div>
      <ul class="why">
        ${v.items.map(
          i => html`<li>
            <span class="pip pip-${i.pip}"></span><span>${i.lead ? html`<b>${i.lead}</b> ` : null}${i.text}</span>
          </li>`,
        )}
      </ul>
    </section>`;
  }
}

define('hh-why', HhWhy);
