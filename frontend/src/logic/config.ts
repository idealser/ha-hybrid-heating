// The card's own options (the dashboard YAML), checked the way Home Assistant expects: throw on bad input.
import type { CardConfig, SectionKey } from '../types';

/** In layout order. */
export const SECTION_KEYS = [
  'plan',
  'why',
  'forecast',
  'curve',
  'probe',
  'zone',
  'rooms',
  'load',
  'season',
  'suggestions',
  'log',
] as const satisfies readonly SectionKey[];

export type NormalConfig = CardConfig & { hide_sections: SectionKey[] };

const isSection = (k: unknown): k is SectionKey => (SECTION_KEYS as readonly unknown[]).includes(k);

export function normalizeConfig(c: unknown): NormalConfig {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) throw new Error('Invalid configuration');
  const raw = c as Record<string, unknown>;
  const hide = raw.hide_sections ?? [];
  if (!Array.isArray(hide)) throw new Error('hide_sections must be a list');
  for (const k of hide) if (!isSection(k)) throw new Error(`Unknown section: ${String(k)}`);
  const tariff = raw.tariff_per_kwh;
  if (tariff !== undefined && (typeof tariff !== 'number' || !Number.isFinite(tariff) || tariff < 0))
    throw new Error('tariff_per_kwh must be a number of at least 0');
  const capacity = raw.capacity_kwh_per_k;
  if (capacity !== undefined && (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity <= 0))
    throw new Error('capacity_kwh_per_k must be a number above 0');
  if (raw.currency !== undefined && typeof raw.currency !== 'string') throw new Error('currency must be text');
  if (raw.title !== undefined && typeof raw.title !== 'string') throw new Error('title must be text');
  return { ...(raw as unknown as CardConfig), hide_sections: [...new Set(hide as SectionKey[])] };
}
