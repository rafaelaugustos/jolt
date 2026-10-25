import { portuguese } from './locales/pt-BR'
import { spanish } from './locales/es'
import { chinese } from './locales/zh-Hans'

export type Locale = 'en' | 'pt-BR' | 'es' | 'zh-Hans'
export type LanguagePreference = 'system' | Locale
export const languageNames: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Português',
  es: 'Español',
  'zh-Hans': '简体中文',
}
export function languagePreference(value: unknown): LanguagePreference {
  return typeof value === 'string' && Object.hasOwn(languageNames, value)
    ? (value as Locale)
    : 'system'
}
export function resolveLocale(
  preference: LanguagePreference,
  deviceLanguage: string,
): Locale {
  if (preference !== 'system') return preference
  if (/^pt(?:[-_]|$)/i.test(deviceLanguage)) return 'pt-BR'
  if (/^es(?:[-_]|$)/i.test(deviceLanguage)) return 'es'
  // The first Chinese translation is Simplified, including fallback for other zh variants.
  if (/^zh(?:[-_]|$)/i.test(deviceLanguage)) return 'zh-Hans'
  return 'en'
}
export function searchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
// API identifiers remain English. Resolve display text and accessibility labels only.
const dictionaries = { 'pt-BR': portuguese, es: spanish, 'zh-Hans': chinese }
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function index(dictionary: Record<string, string>) {
  return {
    dictionary,
    uppercase: new Map(
      Object.entries(dictionary).map(([key, value]) => [
        key.toUpperCase(),
        value.toUpperCase(),
      ]),
    ),
    patterns: Object.entries(dictionary)
      .filter(([key]) => /\{\d+\}/.test(key))
      .sort(
        ([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length,
      )
      .map(([key, value]) => ({
        expression: new RegExp(
          '^' +
            key
              .split(/\{\d+\}/)
              .map(escape)
              .join('([\\s\\S]*?)') +
            '$',
        ),
        indexes: [...key.matchAll(/\{(\d+)\}/g)].map((match) => match[1]!),
        value,
      })),
  }
}
const indexed = new Map<Locale, ReturnType<typeof index>>()
export function translate(source: unknown, locale: Locale, depth = 0): string {
  const text = String(source ?? '')
  if (locale === 'en') return text
  let messages = indexed.get(locale)
  if (!messages) {
    messages = index(dictionaries[locale])
    indexed.set(locale, messages)
  }
  const { dictionary, uppercase, patterns } = messages
  if (Object.hasOwn(dictionary, text)) return dictionary[text]!
  if (!/[a-z]/i.test(text)) return text
  if (text === text.toUpperCase() && uppercase.has(text)) return uppercase.get(text)!
  if (depth < 3) {
    for (const { expression, indexes, value } of patterns) {
      const match = expression.exec(text)
      if (!match) continue
      const parameters = Object.fromEntries(
        indexes.map((index, i) => [index, translate(match[i + 1], locale, depth + 1)]),
      )
      return value.replace(/\{(\d+)\}/g, (_, index) => parameters[index] ?? '')
    }
  }
  return text
}
