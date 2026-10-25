import { expect, test } from '@playwright/test';
import { H } from './helpers';

test('forecast totals and summary with the card tariff', async ({ page }) => {
  await page.goto(H({ lang: 'ru', tariff: '0.30', currency: '¤' }));
  const big = page.locator('hh-forecast .big');
  await expect(big.nth(0)).toHaveText('65');
  await expect(big.nth(1)).toHaveText('20');
  await expect(page.locator('hh-forecast')).toContainText('¤ за 48 ч');
  await expect(page.locator('hh-forecast')).toContainText('Холоднее всего вт 27 в 03:00, −4,6°: зона «Мороз».');
});

test('neutral tariff by default', async ({ page }) => {
  await page.goto(H());
  await expect(page.locator('hh-forecast .big').nth(1)).toHaveText('16');
  await expect(page.locator('hh-forecast')).toContainText('€ in 48 h');
});

test('hour labels use the HA time zone, not the browser', async ({ page }) => {
  await page.goto(H());
  await expect(page.locator('hh-forecast .fc-t').filter({ hasText: ':00' }).first()).toHaveText('15:00');
});

test('clicking an hour moves the probe', async ({ page }) => {
  await page.goto(H());
  await page.locator('hh-forecast .fc-bar').nth(36).click();
  await expect(page.locator('hh-probe .probe-big .num')).toHaveText('−4.6°');
  await expect(page.locator('hh-forecast .fc-sel')).toHaveCount(1);
  await expect(page.locator('hh-curve-chart .probe-t')).toHaveText('−4.6° → 54°');
});

test('probe readout at +13.8 (ru)', async ({ page }) => {
  await page.goto(H({ lang: 'ru', tariff: '0.30', currency: '¤' }));
  const r = page.locator('hh-probe .readout');
  await expect(r).toContainText('Подача котла32°, фон');
  await expect(r).toContainText('Нужно тепла1,1 кВт');
  await expect(r).toContainText('Электричество за сутки13 кВт·ч');
  await expect(r).toContainText('Стоимость за сутки4 ¤');
  await expect(r).toContainText('Против одного котла−49%');
});

test('probe at −20 warns about the shortage', async ({ page }) => {
  await page.goto(H({ lang: 'ru' }));
  await page.locator('hh-probe input[type=range]').fill('-20');
  await expect(page.locator('hh-probe .warn')).toContainText('Не хватает 0,2 кВт');
  await page.locator('hh-probe #probe-now').click();
  await expect(page.locator('hh-probe .probe-big .num')).toHaveText('+13,8°');
});

test('zone editor: AC toggle edits the draft and the summary', async ({ page }) => {
  await page.goto(H());
  await page.locator('hh-zone-editor').getByRole('switch', { name: 'Bedroom' }).click();
  await expect(page.locator('hh-curve-card .zone-row').first()).toContainText('living room AC');
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('zone editor follows the selected zone; boiler and rods', async ({ page }) => {
  await page.goto(H());
  await page.locator('hh-curve-card .zone-row').nth(1).click();
  const ed = page.locator('hh-zone-editor');
  await expect(ed.getByRole('heading')).toHaveText('Zone “Cool”');
  await ed.getByRole('button', { name: 'Backup' }).click();
  await ed.getByRole('button', { name: '3', exact: true }).click();
  await expect(page.locator('hh-curve-card .zone-row').nth(1)).toContainText('boiler backup · 3 rods');
  await expect(ed).toContainText('Up to 6.0 kW.');
});

test('warn for ACs in a zone below −15°', async ({ page }) => {
  await page.goto(H());
  await page.locator('hh-curve-card .zone-row').nth(3).click();
  await page.locator('hh-zone-editor').getByRole('switch', { name: 'Living room' }).click();
  await expect(page.locator('hh-zone-editor .warn')).toBeVisible();
});

test('without stage 5: forecast note, probe still works', async ({ page }) => {
  await page.goto(H({ stage5: '0' }));
  await expect(page.locator('hh-forecast')).toContainText('Suggestions and forecast');
  await expect(page.locator('hh-probe .probe-big .num')).toHaveText('+13.8°');
});

test('nulls: no now-line, "as now" disabled', async ({ page }) => {
  await page.goto(H({ status: 'nulls' }));
  await expect(page.locator('hh-curve-chart .now-l')).toHaveCount(0);
  await expect(page.locator('hh-probe #probe-now')).toBeDisabled();
  await expect(page.locator('hh-probe .probe-big .num')).toHaveText('+10°');
});

test('read-only: the zone editor cannot change anything', async ({ page }) => {
  await page.goto(H({ admin: '0' }));
  await expect(page.locator('hh-zone-editor').getByRole('switch', { name: 'Bedroom' })).toBeDisabled();
});
