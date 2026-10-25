import { expect, test } from '@playwright/test';
import { H, shadowHtml } from './helpers';

test('ACs blow and radiators glow when heating', async ({ page }) => {
  await page.goto(H());
  await expect(page.locator('hh-floor-plan .ac-flow.on')).toHaveCount(6);
  await expect(page.locator('hh-floor-plan .rad.on')).toHaveCount(4);
  await expect(page.locator('hh-floor-plan .room-t').first()).toHaveText('23.3°');
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
  await expect(page.getByText('гостиную (23,3°) и спальню (22,8°) до 23,0°.')).toBeVisible();
  await expect(page.getByText(/Только наблюдение: котёл, кондиционеры, нагрузка/)).toBeVisible();
});

test('hidden sections are left out', async ({ page }) => {
  await page.goto(H({ hide: 'plan' }));
  await expect(page.getByRole('heading', { name: 'Why' })).toBeVisible();
  await expect(page.locator('hh-floor-plan')).toHaveCount(0);
});

test('why shows what the module runs with, not the unsaved draft', async ({ page }) => {
  await page.goto(H());
  const why = page.locator('hh-why');
  await expect(why).toContainText('Observe only: boiler, ACs, load.');
  await page.locator('hh-season .layer').first().getByRole('button', { name: 'Control' }).click();
  await expect(why).toContainText('Observe only: boiler, ACs, load.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(why).toContainText('Observe only: ACs, load.');
});
