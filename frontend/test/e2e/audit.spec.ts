import { calls, expect, H, openTab, patchStatus, test } from './helpers';

test('a module that is off says so and offers no Cold/Hot', async ({ page }) => {
  await page.goto(H());
  await patchStatus(page, 's => ({ ...s, enabled: false, decided: false })');
  await expect(page.locator('hh-why')).toContainText('The module is off:');
  await expect(page.locator('hh-why')).not.toContainText('Starting');
  await openTab(page, 'Rooms & power');
  await expect(page.locator('hh-rooms').getByRole('button', { name: 'Cold' })).toHaveCount(0);
});

test('the room card names an AC mode in words', async ({ page }) => {
  await page.goto(H());
  await patchStatus(page, "s => ({ ...s, acs: { ...s.acs, bedroom: { ...s.acs.bedroom, hvac: 'cool', owned: false } } })");
  await page.locator('hh-floor-plan polygon[data-room=\"bedroom\"]').first().click();
  await expect(page.locator('hh-floor-plan .room-card')).toContainText('cooling');
  await expect(page.locator('hh-floor-plan .room-card')).not.toContainText('cool»');
});

test('the load section speaks of what the module runs with, not the unsaved draft', async ({ page }) => {
  await page.goto(H());
  await patchStatus(page, 's => ({ ...s, load: { ...s.load, shedding: true, water_heater_shed: true } })');
  await openTab(page, 'Rooms & power');
  const text = () => page.locator('hh-load').evaluate(el => el.shadowRoot!.textContent!.replace(/\s+/g, ' '));
  const observed = await text();
  expect(observed).toContain('water heater');
  await openTab(page, 'System');
  await page.locator('hh-season .layer').nth(2).getByRole('button', { name: 'Control' }).click(); // not saved
  await openTab(page, 'Rooms & power');
  expect(await text()).toBe(observed);
});

test('phone: picking a zone on the strip brings its editor into view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(H());
  await openTab(page, 'Curve & zones');
  await page.locator('hh-curve-chart [data-zone=\"2\"]').click();
  await expect(page.locator('hh-zone-editor')).toBeInViewport();
});

test('phone: the Russian tab bar fits 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(H({ lang: 'ru' }));
  const fits = await page.locator('hh-tabs').evaluate(el => {
    const list = el.shadowRoot!.querySelector('[role=\"tablist\"]')!.getBoundingClientRect();
    return [...el.shadowRoot!.querySelectorAll('[role=\"tab\"]')].every(t => t.getBoundingClientRect().right <= list.right + 0.5);
  });
  expect(fits).toBe(true);
});

test('each room has its own target against the preset', async ({ page }) => {
  await page.goto(H());
  await openTab(page, 'Rooms & power');
  const rooms = page.locator('hh-rooms');
  const child = rooms.getByRole('group', { name: "Child's room vs preset" });
  await expect(child).toContainText('−1.0°');
  await rooms.getByRole('button', { name: "Child's room vs preset +" }).click();
  await expect(child).toContainText('−0.9°');
  await page.getByRole('button', { name: 'Save' }).click();
  const save = (await calls(page)).filter(c => c.type === 'hybrid_heating/set_config').at(-1) as {
    settings: { room_offsets: Record<string, number> };
  };
  expect(save.settings.room_offsets.child).toBeCloseTo(-0.9, 9);
});

test('a tapped hour stays on its time when the forecast moves on', async ({ page }) => {
  await page.goto(H());
  await page.locator('hh-forecast .fc-bar').nth(36).click();
  await page.evaluate(() => {
    (window as unknown as { __hh: { hass: { forecastPatch: unknown } } }).__hh.hass.forecastPatch = (f: {
      hours: unknown[];
    }) => ({ ...f, hours: f.hours.slice(1) });
  });
  await page.clock.setFixedTime(new Date('2026-10-25T14:40:00Z')); // over 30 minutes later: read again
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('hh-forecast .fc-bar')).toHaveCount(47);
  await expect(page.locator('hh-forecast .hour')).toContainText('Tue 27, 03:00');
});
