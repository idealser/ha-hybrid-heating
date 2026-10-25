// Colours and fonts. Surfaces, text and lines come from the Home Assistant theme; the signal colours
// (heat, cold, AC, warnings) are the card's own, with a darker-background variant.
import { css } from 'lit';

export const tokens = css`
  :host {
    --bg: var(--primary-background-color);
    --surface: var(--ha-card-background, var(--card-background-color));
    --ink: var(--primary-text-color);
    --muted: var(--secondary-text-color);
    --line: var(--divider-color);
    --r: var(--ha-card-border-radius, 14px);
    --font-body: var(--ha-font-family-body, system-ui, sans-serif);
    --font-data: var(--ha-font-family-code, ui-monospace, Consolas, monospace);
    --line-strong: #bfc9d2;
    --wall: #2a323b;
    --heat: #d4502a;
    --cold: #2c74c4;
    --ac: #11908a;
    --mix: #b9840f;
    --deep: #a3322a;
    --ok: #2e8a4e;
    --ac-fill: rgba(17, 144, 138, 0.1);
    --mix-fill: rgba(185, 132, 15, 0.11);
    --heat-fill: rgba(212, 80, 42, 0.1);
    --deep-fill: rgba(163, 50, 42, 0.13);
    --warn-bg: #fff3dc;
    --warn-ink: #7e5300;
  }
  :host([dark]) {
    --line-strong: #38434e;
    --wall: #c9d2db;
    --heat: #ff7a4c;
    --cold: #62a6f0;
    --ac: #36c4bb;
    --mix: #e4b03c;
    --deep: #f2675b;
    --ok: #5ccb82;
    --ac-fill: rgba(54, 196, 187, 0.13);
    --mix-fill: rgba(228, 176, 60, 0.13);
    --heat-fill: rgba(255, 122, 76, 0.13);
    --deep-fill: rgba(242, 103, 91, 0.15);
    --warn-bg: #3a2b0e;
    --warn-ink: #f2c86c;
    color-scheme: dark;
  }
`;
