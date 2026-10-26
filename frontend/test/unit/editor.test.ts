// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import type { HybridHeatingCardEditor } from '../../src/editor';
import type { CardConfig } from '../../src/types';
import { createMockHass } from '../mock-hass';

async function mount(config: CardConfig = { type: 'custom:hybrid-heating-card' }) {
  await import('../../src/hybrid-heating-card');
  const el = document.createElement('hybrid-heating-card-editor') as unknown as HybridHeatingCardEditor;
  const hass = createMockHass();
  el.hass = hass;
  el.setConfig(config);
  document.body.append(el);
  await el.updateComplete;
  const next = () =>
    new Promise<CustomEvent>(r => el.addEventListener('config-changed', e => r(e as CustomEvent), { once: true }));
  const input = (name: string) => el.shadowRoot!.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  return { el, hass, next, input };
}

test('editor emits config-changed when a section is hidden', async () => {
  const { next, input } = await mount();
  const got = next();
  input('log').click();
  const e = await got;
  expect(e.detail.config.hide_sections).toEqual(['log']);
  expect(e.bubbles && e.composed).toBe(true);
});

test('showing a section again drops it from hide_sections', async () => {
  const { next, input } = await mount({ type: 'custom:hybrid-heating-card', hide_sections: ['log', 'plan'] });
  expect(input('log').checked).toBe(false);
  const got = next();
  input('log').click();
  expect((await got).detail.config.hide_sections).toEqual(['plan']);
});

test('title, tariff and currency', async () => {
  const { next, input } = await mount();
  let got = next();
  input('title').value = 'Flat';
  input('title').dispatchEvent(new Event('change'));
  expect((await got).detail.config.title).toBe('Flat');
  got = next();
  input('tariff_per_kwh').value = '0.3';
  input('tariff_per_kwh').dispatchEvent(new Event('change'));
  expect((await got).detail.config.tariff_per_kwh).toBe(0.3);
  got = next();
  input('tariff_per_kwh').value = '';
  input('tariff_per_kwh').dispatchEvent(new Event('change'));
  expect((await got).detail.config).not.toHaveProperty('tariff_per_kwh');
});

test('a heat capacity set by hand, and left to the module again', async () => {
  const { next, input } = await mount({ type: 'custom:hybrid-heating-card', capacity_kwh_per_k: 20 });
  expect(input('capacity_kwh_per_k').value).toBe('20');
  let got = next();
  input('capacity_kwh_per_k').value = '23.3';
  input('capacity_kwh_per_k').dispatchEvent(new Event('change'));
  expect((await got).detail.config.capacity_kwh_per_k).toBe(23.3);
  for (const typed of ['', '0']) {
    got = next();
    input('capacity_kwh_per_k').value = typed;
    input('capacity_kwh_per_k').dispatchEvent(new Event('change'));
    expect((await got).detail.config).not.toHaveProperty('capacity_kwh_per_k');
  }
});

test('a floor plan file is uploaded to Home Assistant', async () => {
  const { el, hass, input } = await mount();
  const plan = { version: 1, viewBox: [0, 0, 1, 1] };
  const file = new File([JSON.stringify(plan)], 'plan.json', { type: 'application/json' });
  const field = input('plan_file');
  Object.defineProperty(field, 'files', { value: [file] });
  field.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 20));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[role="status"]')?.textContent).toBe('Plan uploaded.');
  expect(hass.calls.at(-1)).toEqual({ type: 'hybrid_heating/set_plan', plan });
  expect(el.shadowRoot!.textContent).toContain('Plan uploaded.');
});

test('entry registers the card for the picker', async () => {
  await import('../../src/hybrid-heating-card');
  expect(customElements.get('hybrid-heating-card')).toBeDefined();
  expect(customElements.get('hybrid-heating-card-editor')).toBeDefined();
  expect(window.customCards).toContainEqual(expect.objectContaining({ type: 'hybrid-heating-card' }));
  const Card = customElements.get('hybrid-heating-card') as unknown as {
    getStubConfig(): unknown;
    getConfigElement(): HTMLElement;
  };
  expect(Card.getStubConfig()).toEqual({ type: 'custom:hybrid-heating-card' });
  expect(Card.getConfigElement().tagName.toLowerCase()).toBe('hybrid-heating-card-editor');
});
