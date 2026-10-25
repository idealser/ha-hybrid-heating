// Type, cards and buttons every section uses (each section has its own shadow root).
import { css } from 'lit';

export const shared = css`
  :host {
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.45;
  }
  * {
    box-sizing: border-box;
  }
  h1,
  h2,
  h3 {
    margin: 0;
    text-wrap: balance;
  }
  h1 {
    font-weight: 600;
    font-size: 28px;
    letter-spacing: -0.01em;
  }
  h2 {
    font-size: 16px;
    font-weight: 600;
  }
  h3 {
    font-size: 14px;
    font-weight: 600;
  }
  p {
    margin: 0;
  }
  .num {
    font-family: var(--font-data);
    font-variant-numeric: tabular-nums;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 12.5px;
  }
  .note {
    font-size: 12.5px;
    color: var(--muted);
  }
  .warn {
    background: var(--warn-bg);
    color: var(--warn-ink);
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 12.5px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }
  .card-head {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .head-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }
  .btn {
    font: inherit;
    font-weight: 500;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
    border-radius: 10px;
    padding: 8px 14px;
    cursor: pointer;
  }
  .btn.primary {
    background: var(--ink);
    color: var(--surface);
    border-color: var(--ink);
  }
  .btn.sm {
    padding: 5px 12px;
    font-size: 13px;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .field label,
  .field .lbl {
    font-size: 12px;
    color: var(--muted);
  }
  .field[hidden] {
    display: none;
  }
  .pair {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
  }
  button:focus-visible,
  input:focus-visible,
  [tabindex]:focus-visible {
    outline: 2px solid var(--cold);
    outline-offset: 2px;
  }
`;
