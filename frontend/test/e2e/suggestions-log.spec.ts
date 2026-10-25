import { calls, expect, H, openTab, test } from './helpers';

test('apply a suggestion', async ({ page }) => {
  await page.goto(H({ lang: 'ru' }));
  await page.locator('hh-suggestions').getByRole('button', { name: 'Применить' }).click();
  expect((await calls(page)).some(c => c.type === 'hybrid_heating/apply_suggestion' && c.suggestion_id === 'curve10')).toBe(true);
  await expect(page.locator('#toast')).toHaveText('Применено: Поднять точку +10° с 39,5° до 41°');
  await expect(page.locator('hh-suggestions')).toHaveCount(0); // nothing new is left on Now
  await openTab(page, 'Система');
  await expect(page.locator('hh-suggestions')).toContainText('Применено.');
  await openTab(page, 'Кривая');
  await expect(page.locator('[data-k="p2"]')).toHaveAttribute('aria-valuetext', '41°');
});

test('dismiss a suggestion', async ({ page }) => {
  await page.goto(H({ lang: 'ru' }));
  await page.locator('hh-suggestions').getByRole('button', { name: 'Не надо' }).click();
  expect((await calls(page)).filter(c => c.type === 'hybrid_heating/dismiss_suggestion').at(-1)).toEqual({
    type: 'hybrid_heating/dismiss_suggestion',
    suggestion_id: 'curve10',
  });
  await openTab(page, 'Система');
  await expect(page.locator('hh-suggestions')).toContainText(
    'Отклонено. Модуль больше не предложит это при похожей погоде.',
  );
});

test('tags come from the kind; info suggestions have no buttons', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'System');
  const s = page.locator('hh-suggestions .sg');
  await expect(s.nth(0).locator('.tag')).toHaveText('Curve');
  await expect(s.nth(1).locator('.tag')).toHaveText('Model');
  await expect(s.nth(1).getByRole('button')).toHaveCount(0);
});

test('non-admin sees suggestions without buttons', async ({ page }) => {
  await page.goto(H({ admin: '0' }));
  await expect(page.locator('hh-suggestions .sg')).toHaveCount(1); // the new one, on Now
  await expect(page.locator('hh-suggestions').getByRole('button', { name: /Apply|Not now/ })).toHaveCount(0);
  await openTab(page, 'System');
  await expect(page.locator('hh-suggestions .sg')).toHaveCount(2);
  await expect(page.locator('hh-suggestions').getByRole('button', { name: /Apply|Not now/ })).toHaveCount(0);
});

test('no stage 5: suggestions note', async ({ page }) => {
  await page.goto(H({ stage5: '0' }));
  await openTab(page, 'System');
  await expect(page.locator('hh-suggestions')).toContainText('Suggestions arrive');
});

test('log shows six entries with pips and local times', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'System');
  await expect(page.locator('hh-log li')).toHaveCount(6);
  await expect(page.locator('hh-log li .pip-cold')).toHaveCount(1);
  await expect(page.locator('hh-log li').first().locator('.tm')).toHaveText('15:02');
  await expect(page.locator('hh-log li').first()).toContainText('Bedroom: AC setpoint down to 24°');
});
