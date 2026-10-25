// "Decision log": what the module did and why, newest first.
import { LitElement, css, html } from 'lit';
import { define } from '../dom';
import { t, type Lang } from '../i18n/index';
import { logLines, logPip, logTime } from '../logic/log';
import { shared } from '../styles/shared';
import type { HhLogEntry } from '../types';

export class HhLog extends LitElement {
  static override properties = { lang: {}, entries: { attribute: false }, now: {}, tz: {} };
  declare lang: Lang;
  declare entries: HhLogEntry[];
  declare now: string;
  declare tz: string;

  constructor() {
    super();
    this.lang = 'en';
    this.entries = [];
    this.now = new Date().toISOString();
    this.tz = 'UTC';
  }

  static override styles = [
    shared,
    css`
      .log {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      li {
        display: grid;
        grid-template-columns: 44px 10px minmax(0, 1fr);
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid var(--line);
        align-items: start;
      }
      li:last-child {
        border-bottom: 0;
      }
      .tm {
        font-family: var(--font-data);
        font-size: 12px;
        color: var(--muted);
        padding-top: 1px;
      }
      .pip {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-top: 5px;
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
      .tx b {
        font-weight: 600;
      }
      .tx span {
        display: block;
        font-size: 12.5px;
        color: var(--muted);
      }
    `,
  ];

  override render() {
    const L = this.lang;
    return html`<section class="card" aria-labelledby="h-log">
      <div class="card-head">
        <h2 id="h-log">${t(L, 'section.log')}</h2>
        <p class="note">${t(L, 'log.note')}</p>
      </div>
      ${this.entries.length
        ? html`<ul class="log">
            ${this.entries.map(e => {
              const time = logTime(e.ts, this.now, this.tz, L);
              const { title, detail } = logLines(e);
              return html`<li>
                <span class="tm" title=${time.full}>${time.short}</span><span class="pip pip-${logPip(e)}"></span>
                <span class="tx"><b>${title}</b>${detail ? html`<span>${detail}</span>` : null}</span>
              </li>`;
            })}
          </ul>`
        : html`<p class="note">${t(L, 'log.empty')}</p>`}
    </section>`;
  }
}

define('hh-log', HhLog);
