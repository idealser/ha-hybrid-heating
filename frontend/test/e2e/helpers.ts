import { test as base, type Locator, type Page } from '@playwright/test';
import { chartGeom } from '../../src/logic/chart-geometry';
import type { MockHass } from '../mock-hass';

export { expect } from '@playwright/test';

/** A minute after the fixtures were taken ("now" in status-now.json): the card compares their time with the clock. */
const FIXTURES_NOW = new Date('2026-10-25T14:06:00Z');

/** Every page runs at the fixtures' moment; timers keep running. */
export const test = base.extend<{ fixturesClock: void }>({
  fixturesClock: [
    async ({ page }, use) => {
      await page.clock.setFixedTime(FIXTURES_NOW);
      await use();
    },
    { auto: true },
  ],
});

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

/** Change what the fake status says, then let the card poll it at once. */
export async function patchStatus(page: Page, patch: string): Promise<void> {
  await page.evaluate(src => {
    (window as unknown as Hh).__hh.hass.statusPatch = new Function('s', `return (${src})(s)`) as never;
    document.dispatchEvent(new Event('visibilitychange'));
  }, patch);
}

/** Switch the card to one of its tabs by name. */
export async function openTab(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
}
