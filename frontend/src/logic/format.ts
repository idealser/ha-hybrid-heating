import type { Lang } from '../i18n/index';

const MINUS = '−';

/** A number with `d` decimals, the language's decimal mark, a true minus and no negative zero. */
export function fmt(v: number, d: number, lang: Lang): string {
  const rounded = Math.round(v * 10 ** d) / 10 ** d;
  let s = (Object.is(rounded, -0) ? 0 : rounded).toFixed(d);
  if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
  if (lang === 'ru') s = s.replace('.', ',');
  return s.startsWith('-') ? MINUS + s.slice(1) : s;
}

/** Outdoor temperature: a sign for warm, one decimal only when it is not zero. */
export function fT(v: number, lang: Lang): string {
  const tenths = Math.round(v * 10) / 10;
  const text = fmt(tenths, Number.isInteger(tenths) ? 0 : 1, lang);
  return (tenths > 0 ? '+' : '') + text + '°';
}

/** Flow temperature: whole degrees when it is that, otherwise one decimal. */
export function fF(v: number, lang: Lang): string {
  return fmt(v, Math.abs(v - Math.round(v)) < 0.01 ? 0 : 1, lang) + '°';
}

export function fKw(v: number, lang: Lang): string {
  return fmt(v, 1, lang) + (lang === 'ru' ? ' кВт' : ' kW');
}

/** A deviation from the target, always signed. */
export function fDev(v: number, lang: Lang): string {
  const s = fmt(v, 1, lang);
  return s.startsWith(MINUS) ? s : '+' + s;
}

export const DASH = '—';

/** The formatted value, or a dash when it is unknown. */
export function orDash(v: number | null | undefined, f: (x: number) => string): string {
  return v === null || v === undefined || !Number.isFinite(v) ? DASH : f(v);
}
