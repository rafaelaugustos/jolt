import { describe, expect, it } from 'vitest'
import catalogSource from '../demo/src/showcase/catalog.ts?raw'
import {
  languagePreference,
  resolveLocale,
  searchText,
  translate,
} from '../demo/src/showcase/locale'
import { portuguese } from '../demo/src/showcase/locales/pt-BR'

describe('preview language', () => {
  it('uses the phone by default, supports Portuguese variants, and falls back to English', () => {
    for (const value of [undefined, '', 'invalid', 'pt', null])
      expect(languagePreference(value)).toBe('system')
    for (const value of ['pt', 'pt-BR', 'pt-PT', 'pt_BR', 'PT-br'])
      expect(resolveLocale('system', value)).toBe('pt-BR')
    for (const value of ['en-US', 'es', 'fr-FR', '', 'ptolemy'])
      expect(resolveLocale('system', value)).toBe('en')
    expect(resolveLocale('en', 'pt-BR')).toBe('en')
    expect(resolveLocale('pt-BR', 'en-US')).toBe('pt-BR')
  })

  it('translates dynamic labels and nested choices without changing native/API values', () => {
    expect(translate('Filter Motion', 'pt-BR')).toBe('Filtrar Movimento')
    expect(translate('Open Camera lens', 'pt-BR')).toBe('Abrir Lente da câmera')
    expect(translate('54 EXPERIMENTS TO EXPLORE', 'pt-BR')).toBe(
      '54 EXPERIMENTOS PARA EXPLORAR',
    )
    expect(translate('48° / PORTRAIT', 'pt-BR')).toBe('48° / RETRATO')
    expect(translate('Paused at 37%', 'pt-BR')).toBe('Pausado em 37%')
    expect(translate('Settled on 1.251,00', 'pt-BR')).toBe('Parou em 1.251,00')
    expect(translate('Play popIn', 'pt-BR')).toBe('Reproduzir popIn')
    expect(translate('popIn', 'pt-BR')).toBe('popIn')
    expect(translate('Pause', 'en')).toBe('Pause')
    expect(translate('+ 1.10', 'pt-BR')).toBe('+ 1,10')
    expect(translate(0, 'pt-BR')).toBe('0')
    expect(translate(undefined, 'pt-BR')).toBe('')
  })

  it('keeps all interpolated parameters and newlines in translated messages', () => {
    const parameters = (value: string) =>
      [...value.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort()
    for (const [source, translation] of Object.entries(portuguese)) {
      expect(translation.trim(), source).not.toBe('')
      expect(parameters(translation), source).toEqual(parameters(source))
    }
    expect(translate('Small details.\nBig feelings.', 'pt-BR')).toBe(
      'Pequenos detalhes.\nGrandes sensações.',
    )
  })

  it('covers every catalog title, category and description', () => {
    const messages = [
      ...catalogSource.matchAll(/(?:title|category|description): '([^']*)'/g),
    ].map((match) => match[1]!)
    expect(messages.length).toBe(57 * 3)
    for (const message of messages) expect(portuguese[message], message).toBeDefined()
  })

  it('supports accent-insensitive search in both the translated and English catalog', () => {
    const index = searchText(`Camera lens ${translate('Camera lens', 'pt-BR')}`)
    expect(index.includes(searchText('CAMERA'))).toBe(true)
    expect(index.includes(searchText('câmera'))).toBe(true)
    expect(searchText('  Háptica  ')).toBe('haptica')
    expect(searchText('Animações')).toBe('animacoes')
  })
})
