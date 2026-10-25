import { expect, test } from '@playwright/test';
import { H, openTab, shadowHtml } from './helpers';

test('ACs blow and radiators glow when heating', async ({ page }) => {
  await page.goto(H());
  await expect(page.locator('hh-floor-plan .ac-flow.on')).toHaveCount(6);
  await expect(page.locator('hh-floor-plan .rad.on')).toHaveCount(4);
  await expect(page.locator('hh-floor-plan .room-t').first()).toHaveText('23.3°');
  await page.locator('hh-floor-plan hh-hint').getByRole('button', { name: 'More' }).click();
  await expect(page.getByText(/A sample layout/)).toBeVisible();
});

test('nulls render without NaN and without a temperature for the child room', async ({ page }) => {
  await page.goto(H({ status: 'nulls' }));
  await expect(page.locator('hh-floor-plan .ac-flow.on')).toHaveCount(3);
  expect(await shadowHtml(page)).not.toMatch(/NaN|undefined/);
  await expect(page.locator('hh-floor-plan')).toContainText('—');
  await expect(page.getByText('Outdoor temperature unavailable')).toBeVisible();
});

test('why explains the now scenario', async ({ page }) => {
  await page.goto(H({ lang: 'ru' }));
  await expect(page.getByRole('heading', { name: 'Почему так' })).toBeVisible();
  await expect(page.getByText('гостиная (23,3°, уставка 24°) и спальня (22,8°, уставка 24°).')).toBeVisible();
  await expect(page.locator('hh-header .status')).toHaveText('Наблюдение — ничего не меняется');
});

test('hidden sections are left out', async ({ page }) => {
  await page.goto(H({ hide: 'plan' }));
  await expect(page.getByRole('heading', { name: 'Why' })).toBeVisible();
  await expect(page.locator('hh-floor-plan')).toHaveCount(0);
});

test('the status line shows what the module runs with, not the unsaved draft', async ({ page }) => {
  await page.goto(H());
  const status = page.locator('hh-header .status');
  await expect(status).toHaveText('Observing — nothing is changed');
  await openTab(page, 'System');
  await page.locator('hh-season .layer').first().getByRole('button', { name: 'Control' }).click();
  await expect(status).toHaveText('Observing — nothing is changed');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(status).toHaveText('In control: boiler · observing: ACs, load');
});
