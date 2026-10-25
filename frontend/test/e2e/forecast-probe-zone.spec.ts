import { expect, H, openTab, test } from './helpers';

test('forecast totals and summary with the card tariff', async ({ page }) => {
  await page.goto(H({ lang: 'ru', tariff: '0.30', currency: '¤' }));
  const big = page.locator('hh-forecast .big');
  await expect(big.nth(0)).toHaveText('66'); // hour by hour: setbacks coast, mornings warm up
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
  await expect(page.locator('hh-forecast .fc-sel')).toHaveCount(1);
  await openTab(page, 'Curve & zones');
  await expect(page.locator('hh-probe .probe-big .num')).toHaveText('−4.6°');
  await expect(page.locator('hh-curve-chart .probe-t')).toHaveText('−4.6° → 54°');
});

test('probe readout at +13.8 (ru)', async ({ page }) => {
  await page.goto(H({ lang: 'ru', tariff: '0.30', currency: '¤' }));
  await openTab(page, 'Кривая');
  const r = page.locator('hh-probe .readout');
  await expect(r).toContainText('Подача котла35°Нужно') // the warm zone backs up the ACs: the full curve;
  await expect(r).toContainText('Нужно тепла1,1 кВт');
  await expect(r).toContainText('Электричество за сутки13 кВт·ч');
  await expect(r).toContainText('Стоимость за сутки4 ¤');
  await expect(r).toContainText('Против одного котла−49%');
});

test('probe at −20 warns about the shortage', async ({ page }) => {
  await page.goto(H({ lang: 'ru' }));
  await openTab(page, 'Кривая');
  await page.locator('hh-probe input[type=range]').fill('-20');
  await expect(page.locator('hh-probe .warn')).toContainText('Не хватает 0,2 кВт');
  await page.locator('hh-probe #probe-now').click();
  await expect(page.locator('hh-probe .probe-big .num')).toHaveText('+13,8°');
});

test('zone editor: AC toggle edits the draft and the summary', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  await page.locator('hh-zone-editor').getByRole('switch', { name: 'Bedroom' }).click();
  await expect(page.locator('hh-zone-editor')).toContainText('living room AC');
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('zone editor follows the selected zone; boiler and rods', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  await page.locator('hh-curve-chart [data-zone="1"]').click();
  const ed = page.locator('hh-zone-editor');
  await expect(ed.getByRole('heading')).toHaveText('Zone “Cool”');
  await ed.getByRole('button', { name: 'Backup' }).click();
  await ed.getByRole('button', { name: '3', exact: true }).click();
  await expect(page.locator('hh-zone-editor')).toContainText('boiler backup · 3 rods');
  await expect(ed).toContainText('Up to 6.0 kW.');
});

test('warn for ACs in a zone below −15°', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  await page.locator('hh-curve-chart [data-zone="3"]').click();
  await page.locator('hh-zone-editor').getByRole('switch', { name: 'Living room' }).click();
  await expect(page.locator('hh-zone-editor .warn')).toBeVisible();
});

test('without stage 5: forecast note, probe still works', async ({ page }) => {
  await page.goto(H({ stage5: '0' }));
  await expect(page.locator('hh-forecast')).toContainText('Suggestions and forecast');
  await openTab(page, 'Curve & zones');
  await expect(page.locator('hh-probe .probe-big .num')).toHaveText('+13.8°');
});

test('nulls: no now-line, "as now" disabled', async ({ page }) => {
  await page.goto(H({ status: 'nulls' }));
  await openTab(page, 'Curve & zones');
  await expect(page.locator('hh-curve-chart')).toBeVisible();
  await expect(page.locator('hh-curve-chart .now-l')).toHaveCount(0);
  await expect(page.locator('hh-probe #probe-now')).toBeDisabled();
  await expect(page.locator('hh-probe .probe-big .num')).toHaveText('+10°');
});

test('read-only: the zone editor cannot change anything', async ({ page }) => {
  await page.goto(H({ admin: '0' }));
  await openTab(page, 'Curve & zones');
  await expect(page.locator('hh-zone-editor').getByRole('switch', { name: 'Bedroom' })).toBeDisabled();
});

test('a tapped hour says what runs then; tapping it again clears it', async ({ page }) => {
  await page.goto(H());
  const bar = page.locator('hh-forecast .fc-bar').nth(36);
  const line = page.locator('hh-forecast .hour');
  await bar.click();
  await expect(line).toHaveText(
    /^Tue 27, 03:00, −4\.6°: zone “Frost”: both ACs · boiler main · 3 rods · flow \d+(\.\d)?° · about \d+\.\d kW · inside \d+\.\d°\.$/,
  );
  await bar.click();
  await expect(line).toHaveCount(0);
  await expect(page.locator('hh-forecast .fc-sel')).toHaveCount(0);
});

test('the hours work from the keyboard', async ({ page }) => {
  await page.goto(H());
  const line = page.locator('hh-forecast .hour');
  await page.locator('hh-forecast svg').focus();
  await page.keyboard.press('ArrowRight'); // nothing picked yet: the first hour
  await expect(line).toContainText('Sun 25, 15:00');
  await page.keyboard.press('ArrowRight');
  await expect(line).toContainText('Sun 25, 16:00');
  await page.keyboard.press('End');
  await expect(line).toContainText('Tue 27, 14:00');
  await page.keyboard.press('Escape');
  await expect(line).toHaveCount(0);
});

test('out of the heating season the forecast costs nothing', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'System');
  await page.locator('hh-season').getByRole('button', { name: 'Always off' }).click();
  await openTab(page, 'Now');
  await expect(page.locator('hh-forecast')).toContainText('Out of the heating season: no heating in these 48 h.');
  await page.locator('hh-forecast .fc-bar').nth(3).click();
  await expect(page.locator('hh-forecast .hour')).toContainText('out of the heating season, no heating.');
});

test('the forecast shows the flat inside and the electricity per hour, under the outdoor line', async ({ page }) => {
  await page.goto(H());
  const fc = page.locator('hh-forecast');
  await expect(fc.locator('.fc-out')).toHaveCount(1); // outside
  await expect(fc.locator('.fc-in')).toHaveCount(1); // the flat, modelled
  await expect(fc.locator('.fc-target')).toHaveCount(1); // against its target
  expect(await fc.locator('.fc-kwh-ac').count()).toBeGreaterThan(0); // the ACs run in the warm zone
  expect(await fc.locator('.fc-kwh-boiler').count()).toBeGreaterThan(0);
  for (const label of ['Outside', 'Inside (model)', 'target', 'Electricity, kWh per hour', 'boiler', 'ACs'])
    await expect(fc.locator('svg')).toContainText(label);
  // a tapped hour is marked across all three panels and its line says how warm the flat is then
  await fc.locator('.fc-bar').nth(36).click();
  await expect(fc.locator('.fc-sel')).toHaveCount(1);
  await expect(fc.locator('.hour')).toContainText(/inside \d+\.\d°/);
});

test('away: the flat cools inside, and no electricity until it reaches its target', async ({ page }) => {
  await page.goto(H());
  await page.locator('hh-header').getByRole('button', { name: /Away/ }).click();
  const fc = page.locator('hh-forecast');
  await fc.locator('.fc-bar').first().click();
  await expect(fc.locator('.hour')).toContainText('the flat cools to');
  await expect(fc.locator('.fc-kwh-ac')).toHaveCount(0); // no ACs in Away
});
