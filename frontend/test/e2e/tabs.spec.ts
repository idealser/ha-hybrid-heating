import { expect, test } from '@playwright/test';
import { H, openTab } from './helpers';

test('opens on Now: the flat, why and the forecast, nothing to tune', async ({ page }) => {
  await page.goto(H());
  await expect(page.getByRole('tab', { name: 'Now' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('hh-floor-plan')).toBeVisible();
  await expect(page.locator('hh-why')).toBeVisible();
  await expect(page.locator('hh-forecast')).toBeVisible();
  for (const tag of ['hh-curve-card', 'hh-rooms', 'hh-load', 'hh-season', 'hh-log'])
    await expect(page.locator(tag)).toHaveCount(0);
  // the new suggestion is on Now; the info one is not
  await expect(page.locator('hh-suggestions .sg')).toHaveCount(1);
});

test('each tab shows its own sections', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  await expect(page.locator('hh-curve-card')).toBeVisible();
  await expect(page.locator('hh-zone-editor')).toBeVisible();
  await expect(page.locator('hh-probe')).toBeVisible();
  await expect(page.locator('hh-floor-plan')).toHaveCount(0);
  await openTab(page, 'Rooms & power');
  await expect(page.locator('hh-rooms')).toBeVisible();
  await expect(page.locator('hh-load')).toBeVisible();
  await openTab(page, 'System');
  await expect(page.locator('hh-season')).toBeVisible();
  await expect(page.locator('hh-log')).toBeVisible();
  await expect(page.locator('hh-suggestions .sg')).toHaveCount(2);
});

test('the last tab is remembered on this device', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'System');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'System' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('hh-season')).toBeVisible();
});

test('arrow keys move between tabs', async ({ page }) => {
  await page.goto(H());
  await page.getByRole('tab', { name: 'Now' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Curve & zones' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Curve & zones' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Now' })).toHaveAttribute('aria-selected', 'true');
});

test('the line under the title says who is in control; no intro sentence', async ({ page }) => {
  await page.goto(H());
  await expect(page.locator('hh-header .status')).toHaveText('Observing — nothing is changed');
  await expect(page.locator('hh-why .warn')).toHaveCount(0);
  await expect(page.getByText('ACs, boiler and load on one screen')).toHaveCount(0);
});

test('save bar only while something is unsaved; the edited tab gets a dot', async ({ page }) => {
  await page.goto(H());
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await openTab(page, 'Rooms & power');
  await page.locator('hh-load').getByRole('button', { name: 'Limit −' }).click();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(page.getByText('Unsaved changes.')).toBeVisible();
  await expect(page.getByRole('tab', { name: /Rooms & power/ })).toHaveAttribute('data-dirty', '');
  await expect(page.getByRole('tab', { name: 'Now' })).not.toHaveAttribute('data-dirty', '');
  await openTab(page, 'Now');
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible(); // from any tab
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Rooms & power/ })).not.toHaveAttribute('data-dirty', '');
});

test('long explanations show one sentence, the rest behind ⓘ', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  const hint = page.locator('hh-curve-card hh-hint').first();
  await expect(hint).toContainText('The boiler heats the water to this temperature depending on the weather.');
  await expect(hint).not.toContainText('switch hybrid mode off');
  await hint.getByRole('button', { name: 'More' }).click();
  await expect(hint).toContainText('switch hybrid mode off');
});

test('a tab whose sections are all hidden disappears', async ({ page }) => {
  await page.goto(H({ hide: 'rooms,load' }));
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('tab', { name: 'Rooms & power' })).toHaveCount(0);
});

test('a remembered tab that is now hidden falls back to the first one', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Rooms & power');
  await page.goto(H({ hide: 'rooms,load' }));
  await expect(page.getByRole('tab', { name: 'Now' })).toHaveAttribute('aria-selected', 'true');
});

test('all tabs fit a phone screen in both languages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  for (const lang of ['en', 'ru']) {
    await page.goto(H({ lang }));
    const fits = await page
      .locator('hh-tabs')
      .evaluate(el => {
        const bar = el.shadowRoot!.querySelector('[role="tablist"]')!;
        return bar.scrollWidth <= bar.clientWidth;
      });
    expect(fits, lang).toBe(true);
  }
});
