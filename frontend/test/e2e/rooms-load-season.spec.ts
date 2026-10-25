import { expect, test } from '@playwright/test';
import { calls, H } from './helpers';

const lastSet = async (page: Parameters<typeof calls>[0]) =>
  (await calls(page)).filter(c => c.type === 'hybrid_heating/set_config').at(-1);

test('cold feedback calls the backend and toasts', async ({ page }) => {
  await page.goto(H({ lang: 'ru' }));
  await page.locator('hh-rooms .roomrow').nth(2).getByRole('button', { name: 'Холодно', exact: true }).click();
  expect((await calls(page)).filter(c => c.type === 'hybrid_heating/feedback').at(-1)).toEqual({
    type: 'hybrid_heating/feedback',
    room: 'child',
    kind: 'cold',
    language: 'ru',
  });
  await expect(page.locator('#toast')).toHaveText('Учту: детская, холодно');
});

test('rooms show temperature and deviation', async ({ page }) => {
  await page.goto(H());
  // the child's room has its own target 1° lower (room offset): 22.6° is 0.6 above it
  await expect(page.locator('hh-rooms .roomrow').nth(2)).toContainText('22.6°');
  await expect(page.locator('hh-rooms .roomrow').nth(2)).toContainText('+0.6');
  await expect(page.locator('hh-floor-plan polygon[data-room="child"]')).toHaveAttribute('fill', 'var(--heat)');
  await expect(page.locator('hh-floor-plan polygon[data-room="bedroom"]')).toHaveAttribute('fill', 'var(--cold)');
  await expect(page.locator('hh-rooms')).toContainText('Night, 22:00–07:00');
});

test('night mode for an AC is a draft edit', async ({ page }) => {
  await page.goto(H({ lang: 'ru' }));
  await page.locator('hh-rooms .roomrow').nth(1).getByRole('button', { name: 'выкл' }).click();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  expect(await lastSet(page)).toEqual({
    type: 'hybrid_heating/set_config',
    settings: { ac: { night: { bedroom: 'off' } } },
  });
});

test('limit stepper pushes restore down', async ({ page }) => {
  await page.goto(H());
  const minus = page.locator('hh-load').getByRole('button', { name: 'Limit −' });
  for (let i = 0; i < 4; i++) await minus.click();
  await expect(page.locator('hh-load hh-stepper').nth(0)).toContainText('6.0 kW');
  await expect(page.locator('hh-load hh-stepper').nth(1)).toContainText('5.5 kW');
  await expect(page.locator('hh-load')).toContainText('Now 1.3 kW of 6.0 kW.');
});

test('season mode "Always off" disables the threshold steppers', async ({ page }) => {
  await page.goto(H());
  const season = page.locator('hh-season');
  await expect(season.getByRole('button', { name: /^Heating while .* \+$/ })).toBeEnabled();
  await season.getByRole('button', { name: 'Always off' }).click();
  await expect(season.getByRole('button', { name: /^Heating while .* \+$/ })).toBeDisabled();
  await expect(season.getByRole('button', { name: 'Hysteresis +' })).toBeDisabled();
  await expect(season).toContainText('Season on. 12 h average: +10.0°.');
});

test('switching the boiler layer to Control is a draft edit', async ({ page }) => {
  await page.goto(H());
  await page.locator('hh-season .layer').first().getByRole('button', { name: 'Control' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  expect(await lastSet(page)).toEqual({ type: 'hybrid_heating/set_config', settings: { layers: { boiler: 'active' } } });
});

test('feedback buttons hidden without stage 5', async ({ page }) => {
  await page.goto(H({ stage5: '0' }));
  await expect(page.locator('hh-rooms .roomrow')).toHaveCount(4);
  await expect(page.locator('hh-rooms').getByRole('button', { name: 'Cold', exact: true })).toHaveCount(0);
});

test('read-only: steppers and modes are locked, feedback still works', async ({ page }) => {
  await page.goto(H({ admin: '0' }));
  await expect(page.locator('hh-load').getByRole('button', { name: 'Limit −' })).toBeDisabled();
  await expect(page.locator('hh-season .layer').first().getByRole('button', { name: 'Control' })).toBeDisabled();
  await expect(page.locator('hh-rooms').getByRole('button', { name: 'Cold', exact: true }).first()).toBeEnabled();
});
