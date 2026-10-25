import { en } from './en';
import { ru } from './ru';

export type Lang = 'en' | 'ru';
export type I18nKey = keyof typeof en;
type PluralKey = 'rods' | 'hours';

const DICTS: Record<Lang, Record<I18nKey, string>> = { en, ru };

export function pickLang(code?: string | null): Lang {
  return code && code.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function t(lang: Lang, key: I18nKey, vars?: Record<string, string | number>): string {
  const text = DICTS[lang][key];
  return vars ? text.replace(/{(\w+)}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text;
}

const RULES: Record<Lang, Intl.PluralRules> = { en: new Intl.PluralRules('en'), ru: new Intl.PluralRules('ru') };

export function plural(lang: Lang, key: PluralKey, n: number): string {
  const form = RULES[lang].select(n) as 'one' | 'few' | 'many' | 'other';
  return t(lang, `${key}.${form}` as I18nKey, { n });
}
