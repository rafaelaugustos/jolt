import { portuguese } from './locales/pt-BR'

export type Locale = 'en' | 'pt-BR'
export type LanguagePreference = 'system' | Locale

export function languagePreference(value: unknown): LanguagePreference {
  return value === 'en' || value === 'pt-BR' ? value : 'system'
}

export function resolveLocale(
  preference: LanguagePreference,
  deviceLanguage: string,
): Locale {
  if (preference !== 'system') return preference
  return /^pt(?:[-_]|$)/i.test(deviceLanguage) ? 'pt-BR' : 'en'
}

export function searchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// English is the source language. Render-time lookup keeps status messages and
// accessibility labels reactive without translating animation/API identifiers.
const uppercase = new Map(
  Object.entries(portuguese).map(([key, value]) => [
    key.toUpperCase(),
    value.toUpperCase(),
  ]),
)
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const patterns = Object.entries(portuguese)
  .filter(([key]) => /\{\d+\}/.test(key))
  .sort(([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length)
  .map(([key, value]) => {
    const indexes = [...key.matchAll(/\{(\d+)\}/g)].map((match) => match[1]!)
    const parts = key.split(/\{\d+\}/).map(escape)
    return {
      expression: new RegExp('^' + parts.join('([\\s\\S]*?)') + '$'),
      indexes,
      value,
    }
  })

export function translate(source: unknown, locale: Locale, depth = 0): string {
  const text = String(source ?? '')
  if (locale === 'en') return text
  if (Object.prototype.hasOwnProperty.call(portuguese, text)) return portuguese[text]!
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
