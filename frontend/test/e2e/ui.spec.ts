import { calls, expect, H, openTab, test } from './helpers';

test('phone: the presets fit one row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(H());
  const tops = await page
    .locator('hh-header')
    .getByRole('button', { name: /Comfort|Eco|Night|Away/ })
    .evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().top)));
  expect(tops).toHaveLength(4);
  expect(new Set(tops).size).toBe(1);
});

test('the version is in System, not in the header', async ({ page }) => {
  await page.goto(H());
  await expect(page.locator('hh-header')).not.toContainText('Hybrid Heating ·');
  await openTab(page, 'System');
  await expect(page.locator('hh-season')).toContainText('Hybrid Heating 0.3.0');
});

test('why starts with one plain line', async ({ page }) => {
  await page.goto(H());
  await expect(page.locator('hh-why .summary')).toHaveText('Would heat, flow 36° · ACs run by hand · load 1.3 of 8.0 kW');
});

test('tap a room on the plan for its details and Cold/Hot', async ({ page }) => {
  await page.goto(H());
  await page.locator('hh-floor-plan polygon[data-room="child"]').first().click();
  const card = page.locator('hh-floor-plan .room-card');
  const ring = page.locator('hh-floor-plan .ring');
  await expect(ring).toHaveCount(1); // the picked room is outlined above the walls
  await expect(ring).toHaveAttribute('data-room', 'child');
  await expect(card).toContainText("Child's room");
  await expect(card).toContainText('22.6°');
  await expect(card).toContainText('target 22.0°');
  await expect(card).toContainText('+0.6');
  await card.getByRole('button', { name: 'Cold', exact: true }).click();
  expect((await calls(page)).filter(c => c.type === 'hybrid_heating/feedback').at(-1)).toMatchObject({
    room: 'child',
    kind: 'cold',
  });
  await card.getByRole('button', { name: 'Close' }).click();
  await expect(card).toHaveCount(0);
  await expect(ring).toHaveCount(0);
  // the keyboard works too (the focused room is outlined), and an AC room says how its AC runs
  await page.locator('hh-floor-plan polygon[data-room="bedroom"]').first().focus();
  await expect(ring).toHaveAttribute('data-room', 'bedroom');
  await page.keyboard.press('Enter');
  await expect(card).toContainText('Bedroom');
  await expect(card).toContainText('AC: run by hand, set to 24°');
});

test('zones are picked on the strip under the chart; the list is gone', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  await expect(page.locator('hh-curve-card .zone-row')).toHaveCount(0);
  await page.locator('hh-curve-chart [data-zone="2"]').click();
  await expect(page.locator('hh-zone-editor').getByRole('heading')).toHaveText('Zone “Frost”');
  await expect(page.locator('hh-curve-chart [data-zone="2"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('hh-curve-chart [data-zone="1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('hh-zone-editor').getByRole('heading')).toHaveText('Zone “Cool”');
  await expect(page.locator('hh-zone-editor')).toContainText('both ACs · boiler main · 2 rods');
});

test('System warns before the boiler goes to Control with a different target', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'System');
  const warn = page.locator('hh-season .warn');
  await expect(warn).toContainText('Your thermostat holds 20.0°; the module’s target is 23.0°.');
  await page.locator('hh-season .layer').first().getByRole('button', { name: 'Control' }).click();
  await expect(warn).toContainText('In Control the module heats to 23.0°');
});
