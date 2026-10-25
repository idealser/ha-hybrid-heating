import { calls, clickChartAt, dragBy, expect, H, openTab, test } from './helpers';

test('nine draggable points', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  await expect(page.locator('hh-curve-chart [role="slider"][data-k^="p"]')).toHaveCount(9);
  await expect(page.locator('[data-k="p1"]')).toHaveAttribute('aria-label', 'Flow at +15°');
  await expect(page.locator('[data-k="p2"]')).toHaveAttribute('aria-valuetext', '39.5°');
});

test('dragging a point changes it and enables Save', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  const p = page.locator('hh-curve-chart [data-k="p2"]');
  await dragBy(page, p, 0, -30);
  await expect(p).not.toHaveAttribute('aria-valuetext', '39.5°');
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
  await expect(page.getByText('Unsaved changes.')).toBeVisible();
});

test('keyboard on a point and on a boundary', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  await page.locator('[data-k="p2"]').focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-k="p2"]')).toHaveAttribute('aria-valuetext', '40°');
  await expect(page.locator('[data-k="p2"]')).toBeFocused();
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.locator('[data-k="p2"]')).toHaveAttribute('aria-valuetext', '38°');
  await page.locator('[data-k="b0"]').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('hh-zone-editor')).toContainText('above +9°');
});

test('click in the plot sets the probe', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  await clickChartAt(page, 5, 50);
  await expect(page.locator('hh-curve-chart .probe-t')).toHaveText('+5° → 45°');
});

test('strip click selects a zone', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  await expect(page.locator('hh-curve-chart [data-zone="0"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('hh-curve-chart [data-zone="2"]').click();
  await expect(page.locator('hh-curve-chart [data-zone="2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('hh-curve-chart [data-zone="0"]')).toHaveAttribute('aria-pressed', 'false');
});

test('hybrid off hides the background curve and its stepper', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  await expect(page.locator('hh-curve-chart .curve-bg')).toHaveCount(1);
  await page.getByRole('switch', { name: 'Hybrid mode' }).click();
  await expect(page.locator('hh-curve-chart .curve-bg')).toHaveCount(0);
  await expect(page.locator('#bg-field')).toBeHidden();
  await expect(page.locator('hh-zone-editor')).toContainText('(hybrid mode off)');
});

test('save after a boundary change sends only zones.bounds', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  await page.locator('[data-k="b0"]').focus();
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', { name: 'Save' }).click();
  expect((await calls(page)).filter(c => c.type === 'hybrid_heating/set_config').at(-1)).toEqual({
    type: 'hybrid_heating/set_config',
    settings: { zones: { bounds: [9, -3, -15] } },
  });
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
});

test('read-only: points cannot be focused or moved', async ({ page }) => {
  await page.goto(H({ admin: '0' }));
  await openTab(page, 'Curve & zones');
  const p = page.locator('hh-curve-chart [data-k="p2"]');
  await expect(p).toHaveAttribute('tabindex', '-1');
  await dragBy(page, p, 0, -30);
  await expect(p).toHaveAttribute('aria-valuetext', '39.5°');
});

test('the chart lets the page scroll on a phone; points and grips still drag', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  const touch = (sel: string) =>
    page.locator(sel).first().evaluate(el => getComputedStyle(el).touchAction);
  expect(await touch('hh-curve-chart')).toBe('pan-y');
  expect(await touch('hh-curve-chart .pt-hit')).toBe('none');
  expect(await touch('hh-curve-chart .grip-hit')).toBe('none');
});
