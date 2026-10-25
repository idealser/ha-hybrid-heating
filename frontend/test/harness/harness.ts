// The card on its own page against the fake Home Assistant. Query parameters:
// ?lang=ru&theme=dark&admin=0&status=frost|nulls&stage5=0&backend=0&hide=log,forecast&tariff=0.30&currency=¤
import '../../src/hybrid-heating-card';
import type { HybridHeatingCard } from '../../src/card';
import type { SectionKey } from '../../src/types';
import { createMockHass, type MockHass } from '../mock-hass';

declare global {
  interface Window {
    __hh: { hass: MockHass };
  }
}

const q = new URLSearchParams(location.search);
const dark = q.get('theme') === 'dark';
const hass = createMockHass({
  lang: q.get('lang') ?? 'en',
  dark,
  admin: q.get('admin') !== '0',
  status: (q.get('status') as 'frost' | 'nulls' | null) ?? 'now',
  stage5: q.get('stage5') !== '0',
  backend: q.get('backend') !== '0',
});

// Home Assistant's default theme colours, which the card reads.
const theme = dark
  ? ['#111111', '#1c1c1c', '#e1e1e1', '#9b9b9b', 'rgba(225,225,225,.12)']
  : ['#fafafa', '#fff', '#212121', '#727272', 'rgba(0,0,0,.12)'];
const vars = [
  '--primary-background-color',
  '--card-background-color',
  '--primary-text-color',
  '--secondary-text-color',
  '--divider-color',
];
vars.forEach((name, i) => document.body.style.setProperty(name, theme[i]!));

const card = document.createElement('hybrid-heating-card') as HybridHeatingCard;
const hide = q.get('hide');
card.setConfig({
  type: 'custom:hybrid-heating-card',
  ...(hide ? { hide_sections: hide.split(',') as SectionKey[] } : {}),
  ...(q.get('tariff') ? { tariff_per_kwh: Number(q.get('tariff')) } : {}),
  ...(q.get('currency') ? { currency: q.get('currency')! } : {}),
});

// Like Home Assistant: a new object whenever a state changes.
const push = () => (card.hass = { ...hass, states: { ...hass.states } });
const callService = hass.callService.bind(hass);
hass.callService = async (domain, service, data) => {
  const result = await callService(domain, service, data);
  push();
  return result;
};
push();
document.getElementById('root')!.append(card);
window.__hh = { hass };

const toast = document.getElementById('toast')!;
let hideToast: ReturnType<typeof setTimeout> | undefined;
window.addEventListener('hass-notification', e => {
  toast.textContent = (e as CustomEvent<{ message: string }>).detail.message;
  toast.hidden = false;
  clearTimeout(hideToast);
  hideToast = setTimeout(() => (toast.hidden = true), 4000);
});
