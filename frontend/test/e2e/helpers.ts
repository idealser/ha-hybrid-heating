import type { Locator, Page } from '@playwright/test';
import { chartGeom } from '../../src/logic/chart-geometry';
import type { MockHass } from '../mock-hass';

/** The harness URL with its query parameters. */
export const H = (q: Record<string, string> = {}): string => `/test/harness/index.html?${new URLSearchParams(q)}`;

type Hh = { __hh: { hass: MockHass } };

export const calls = (page: Page): Promise<MockHass['calls']> =>
  page.evaluate(() => (window as unknown as Hh).__hh.hass.calls);

export const services = (page: Page): Promise<MockHass['services']> =>
  page.evaluate(() => (window as unknown as Hh).__hh.hass.services);

/** Everything rendered inside the card's shadow roots, for checks like "no NaN anywhere". */
export const shadowHtml = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const walk = (root: Document | ShadowRoot): string => {
      let out = '';
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) out += el.shadowRoot.innerHTML + walk(el.shadowRoot);
      }
      return out;
    };
    return walk(document);
  });

/** Click the flow chart at an outdoor temperature and a flow, through its viewBox and geometry. */
export async function clickChartAt(page: Page, t: number, f: number): Promise<void> {
  const chart = page.locator('hh-curve-chart svg');
  await chart.scrollIntoViewIfNeeded(); // raw mouse events do not scroll
  const box = (await chart.boundingBox())!;
  const g = chartGeom(Number((await chart.getAttribute('viewBox'))!.split(' ')[2]));
  await page.mouse.click(box.x + (g.x(t) * box.width) / g.W, box.y + (g.y(f) * box.height) / g.H);
}

/** Press on the middle of an element, move by (dx, dy) in a few steps and release. */
export async function dragBy(page: Page, target: Locator, dx: number, dy: number): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const b = (await target.boundingBox())!;
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  await page.mouse.up();
}
