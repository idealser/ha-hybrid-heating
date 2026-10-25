import { expect, H, openTab, test } from './helpers';

// Baselines per platform (fonts differ): win32 from a Windows run, linux from the Playwright image CI uses.
for (const theme of ['light', 'dark'] as const) {
  test(`desktop ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(H({ theme }));
    await expect(page.locator('hh-floor-plan svg')).toBeVisible();
    await expect(page.locator('hh-forecast .fc-bar').first()).toBeVisible();
    await expect(page).toHaveScreenshot(`card-desktop-${theme}.png`, { fullPage: true });
  });

  test(`phone ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(H({ theme }));
    await expect(page.locator('hh-forecast .fc-bar').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page).toHaveScreenshot(`card-phone-${theme}.png`, { fullPage: true });
  });
}

for (const [tab, ready] of [
  ['Curve & zones', 'hh-curve-chart svg'],
  ['Rooms & power', 'hh-load'],
  ['System', 'hh-log li'],
] as const) {
  test(`desktop light, ${tab}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(H());
    await openTab(page, tab);
    await expect(page.locator(ready).first()).toBeVisible();
    const name = tab.toLowerCase().replace(/[^a-z]+/g, '-');
    await expect(page).toHaveScreenshot(`card-desktop-light-${name}.png`, { fullPage: true });
  });
}
