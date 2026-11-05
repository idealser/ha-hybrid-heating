// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { HhApi } from '../../src/api';
import type { HybridHeatingPlanCard } from '../../src/plan-card';
import { normalizePlanConfig } from '../../src/plan-card';
import { CardStore } from '../../src/store';
import { createMockHass } from '../mock-hass';

afterEach(() => document.body.replaceChildren());

const count = (h: ReturnType<typeof createMockHass>, type: string) => h.calls.filter(c => c.type === type).length;

test('the lite store loads the plan and the status, but no log or forecast', async () => {
  vi.useFakeTimers();
  const h = createMockHass();
  const st = new CardStore(new HhApi(() => h), { lang: () => 'en', notify: () => {}, onChange: () => {}, lite: true });
  await st.start();
  expect(st.view.phase).toBe('ready');
  expect(st.view.status).not.toBeNull();
  expect(st.view.log).toEqual([]);
  expect(st.view.forecast).toBeNull();
  await st.poll(true);
  expect(count(h, 'hybrid_heating/get_log')).toBe(0);
  expect(count(h, 'hybrid_heating/get_forecast')).toBe(0);
  st.stop();
  vi.useRealTimers();
});

test('the plan card shows only the floor plan, with its own title', async () => {
  await import('../../src/hybrid-heating-card');
  expect(window.customCards!.map(c => c.type)).toContain('hybrid-heating-plan-card');
  const el = document.createElement('hybrid-heating-plan-card') as unknown as HybridHeatingPlanCard;
  el.setConfig({ type: 'custom:hybrid-heating-plan-card', title: 'Flat' });
  el.hass = createMockHass();
  document.body.append(el);
  await vi.waitFor(() => expect(el.shadowRoot!.querySelector('hh-floor-plan')).not.toBeNull());
  const root = el.shadowRoot!;
  expect(root.querySelector('hh-tabs, hh-header, hh-footer')).toBeNull();
  const plan = root.querySelector('hh-floor-plan')!;
  await (plan as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  expect(plan.shadowRoot!.querySelector('h2')!.textContent).toBe('Flat');
  expect(plan.shadowRoot!.querySelectorAll('polygon.room').length).toBeGreaterThan(0);
});

test('plan card config: a title must be text', () => {
  expect(() => normalizePlanConfig({ type: 'x', title: 3 })).toThrow('title must be text');
  expect(normalizePlanConfig({ type: 'x' })).toEqual({ type: 'x' });
});
