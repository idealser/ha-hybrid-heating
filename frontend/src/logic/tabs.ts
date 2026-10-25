// The card's tabs: what each one shows, which ones have unsaved edits, and the line under the title.
import { t, type I18nKey, type Lang } from '../i18n/index';
import { LAYERS, type DeepPartial, type HhSettings, type HhStatus, type SectionKey } from '../types';

export type TabKey = 'now' | 'curve' | 'rooms' | 'system';

/** A row of columns; a column holds one section or a stack of them. */
export interface TabRow {
  cls: 'two' | 'pair' | 'one';
  cols: SectionKey[][];
}

export const TABS: { key: TabKey; rows: TabRow[] }[] = [
  {
    key: 'now',
    rows: [
      { cls: 'two', cols: [['plan'], ['why']] },
      { cls: 'one', cols: [['forecast']] },
    ],
  },
  { key: 'curve', rows: [{ cls: 'two', cols: [['curve'], ['zone', 'probe']] }] },
  { key: 'rooms', rows: [{ cls: 'pair', cols: [['rooms'], ['load']] }] },
  { key: 'system', rows: [{ cls: 'pair', cols: [['season', 'suggestions'], ['log']] }] },
];

const sectionsOf = (tab: (typeof TABS)[number]): SectionKey[] => tab.rows.flatMap(r => r.cols.flat());

/** Tabs with at least one section left after the card's hide_sections option. */
export function visibleTabs(hidden: readonly SectionKey[]): TabKey[] {
  return TABS.filter(tab => sectionsOf(tab).some(k => !hidden.includes(k))).map(tab => tab.key);
}

/** Where each setting is edited, so a tab can show that it holds unsaved changes. */
function tabOf(group: string, field: string): TabKey {
  if (group === 'curve' || group === 'zones') return 'curve';
  if (group === 'boiler') return field === 'mode' ? 'curve' : field === 'classic_coldest_tolerance' ? 'rooms' : 'system';
  if (group === 'targets' || group === 'ac' || group === 'load' || group === 'room_offsets') return 'rooms';
  return 'system';
}

export function dirtyTabs(diff: DeepPartial<HhSettings>): Set<TabKey> {
  const out = new Set<TabKey>();
  for (const [group, value] of Object.entries(diff)) {
    const fields = value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [''];
    for (const field of fields) out.add(tabOf(group, field));
  }
  return out;
}

export type Tone = 'warn' | 'ok' | 'idle';

/** Who is in control, in one line: shown under the title on every tab. */
export function statusLine(st: HhStatus | null, s: HhSettings, L: Lang): { text: string; tone: Tone } {
  if (st && !st.enabled) return { text: t(L, 'banner.disabled'), tone: 'warn' };
  if (st && !st.season_active) return { text: t(L, 'banner.season'), tone: 'idle' };
  const names = (mode: string) =>
    LAYERS.filter(l => s.layers[l] === mode).map(l => t(L, `layer.${l}` as I18nKey));
  const active = names('active');
  const observed = names('observe');
  if (active.length) {
    const also = observed.length ? t(L, 'status.observing_also', { layers: observed.join(', ') }) : '';
    return { text: t(L, 'status.in_control', { layers: active.join(', ') }) + also, tone: 'ok' };
  }
  if (observed.length) return { text: t(L, 'status.observing'), tone: 'warn' };
  return { text: t(L, 'status.all_off'), tone: 'idle' };
}

/** The first sentence of an explanation, and whether there is more to show behind "ⓘ". */
export function firstSentence(text: string): { first: string; rest: boolean } {
  const m = /^(.+?[.!?])\s+(?=\S)/u.exec(text);
  return m ? { first: m[1]!, rest: true } : { first: text, rest: false };
}
