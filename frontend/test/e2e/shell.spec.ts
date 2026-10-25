import { expect, test } from '@playwright/test';
import { H, services } from './helpers';

test('header with presets from entities', async ({ page }) => {
  await page.goto(H());
  await expect(page.getByRole('heading', { name: 'Heating', exact: true })).toBeVisible();
  await expect(page.locator('hh-header').getByRole('button', { name: /Comfort/ })).toHaveAttribute('aria-pressed', 'true');
});

test('preset click calls the select service', async ({ page }) => {
  await page.goto(H());
  await page.locator('hh-header').getByRole('button', { name: /Eco/ }).click();
  expect((await services(page)).at(-1)).toEqual({
    domain: 'select',
    service: 'select_option',
    data: { entity_id: 'select.hybrid_heating_preset', option: 'eco' },
  });
  await expect(page.locator('hh-header').getByRole('button', { name: /Eco/ })).toHaveAttribute('aria-pressed', 'true');
});

test('hybrid switch calls switch.turn_off', async ({ page }) => {
  await page.goto(H());
  const sw = page.getByRole('switch', { name: 'Hybrid mode' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  expect((await services(page)).at(-1)).toEqual({
    domain: 'switch',
    service: 'turn_off',
    data: { entity_id: 'switch.hybrid_heating_hybrid_mode' },
  });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
});

test('language follows HA', async ({ page }) => {
  await page.goto(H({ lang: 'ru' }));
  await expect(page.getByRole('heading', { name: 'Отопление', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
});

test('save is disabled until something changes', async ({ page }) => {
  await page.goto(H());
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  await expect(page.getByText('All changes saved.')).toBeVisible();
});

test('non-admin: no Save, presets still work', async ({ page }) => {
  await page.goto(H({ admin: '0' }));
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await expect(page.getByText('Only an administrator can change settings.')).toBeVisible();
  await page.locator('hh-header').getByRole('button', { name: /Away/ }).click();
  expect((await services(page)).at(-1)?.data).toMatchObject({ option: 'away' });
});

test('no backend shows the setup hint', async ({ page }) => {
  await page.goto(H({ backend: '0' }));
  await expect(page.getByText(/Hybrid Heating is not set up/)).toBeVisible();
});

test('dark theme marks the card', async ({ page }) => {
  await page.goto(H({ theme: 'dark' }));
  await expect(page.locator('hybrid-heating-card')).toHaveAttribute('dark', '');
  await page.goto(H());
  await expect(page.getByRole('heading', { name: 'Heating', exact: true })).toBeVisible();
  await expect(page.locator('hybrid-heating-card')).not.toHaveAttribute('dark', '');
});

test('hidden sections are not drawn', async ({ page }) => {
  await page.goto(H({ hide: 'log,forecast' }));
  await expect(page.locator('hh-season')).toBeVisible();
  await expect(page.locator('hh-log')).toHaveCount(0);
  await expect(page.locator('hh-forecast')).toHaveCount(0);
});

test('the card keeps its own side padding (a panel view gives it none)', async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(H());
    await expect(page.locator('hh-footer')).toBeVisible();
    const card = (await page.locator('hybrid-heating-card').boundingBox())!;
    const header = (await page.locator('hh-header').boundingBox())!;
    const footer = (await page.locator('hh-footer').boundingBox())!;
    expect(header.x - card.x).toBeGreaterThanOrEqual(16);
    expect(card.x + card.width - (footer.x + footer.width)).toBeGreaterThanOrEqual(16);
    expect(header.y - card.y).toBeGreaterThanOrEqual(16);
  }
});
