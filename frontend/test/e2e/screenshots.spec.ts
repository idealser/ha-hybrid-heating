import { expect, test } from '@playwright/test';
import { H } from './helpers';

// Baselines per platform (fonts differ): win32 from a Windows run, linux from the Playwright image CI uses.
for (const theme of ['light', 'dark'] as const) {
  test(`desktop ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(H({ theme }));
    await expect(page.locator('hh-floor-plan svg')).toBeVisible();
    await expect(page.locator('hh-log li')).toHaveCount(6);
    await expect(page).toHaveScreenshot(`card-desktop-${theme}.png`, { fullPage: true });
  });

  test(`phone ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(H({ theme }));
    await expect(page.locator('hh-log li')).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page).toHaveScreenshot(`card-phone-${theme}.png`, { fullPage: true });
  });
}
