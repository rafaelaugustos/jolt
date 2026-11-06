import type { WebSymbolEffect } from '../../../../../src/web/public'
import { type Experiment, element, action } from './types'

export const typeExperiments: Experiment[] = [
  {
    id: 'text',
    family: 'type',
    title: ['Text entrance', 'Entrada de texto', 'Entrada de texto', '文字入场'],
    hint: [
      'Every word has its moment. Every letter too.',
      'Cada palavra tem sua vez. Cada letra também.',
      'Cada palabra tiene su momento. Cada letra también.',
      '每个词都有登场时刻，每个字也一样。',
    ],
    guide: 'web-effects#text',
    apis: ['animateText'],
    code: `scope.animateText(label, {\n  by: 'word', y: 18, duration: 500, stagger: 80\n})\n// Use 'letter' for grapheme-aware animation.`,
    mount(ctx) {
      const text = element(
        ctx.host,
        'div',
        'lab-type-line',
        ctx.t(['Make it move.', 'Faça acontecer.', 'Haz que se mueva.', '让它动起来。']),
      )
      let by: 'word' | 'letter' = 'word'
      const run = () =>
        ctx.scope.animateText(text, { by, y: 18, duration: 500, stagger: 80 })
      return {
        run,
        actions: [
          action('words', ['Words', 'Palavras', 'Palabras', '词'], () => {
            by = 'word'
            return run()
          }),
          action('letters', ['Letters', 'Letras', 'Letras', '字'], () => {
            by = 'letter'
            return run()
          }),
        ],
      }
    },
  },
  {
    id: 'rolling',
    family: 'type',
    title: ['Rolling numbers', 'Números rolantes', 'Números rodantes', '滚动数字'],
    hint: [
      'Let the value change with a little personality.',
      'Deixe o valor mudar com personalidade.',
      'Deja que el valor cambie con personalidad.',
      '让数值变化更有个性。',
    ],
    guide: 'web-effects#text',
    apis: ['rollTo'],
    code: `scope.rollTo(amount, 1280, {\n  duration: 700, bounce: .2, stagger: 30, tabular: true\n})`,
    mount(ctx) {
      const amount = element(ctx.host, 'div', 'lab-number', '480')
      const values = [1280, 96, 2048, 480]
      let index = 0
      return {
        run() {
          const value = values[index++ % values.length]!
          return ctx.scope.rollTo(amount, value, {
            duration: 700,
            bounce: 0.2,
            stagger: 30,
            tabular: true,
          })
        },
      }
    },
  },
  {
    id: 'symbols',
    family: 'type',
    title: ['Symbol effects', 'Efeitos de símbolos', 'Efectos de símbolos', '符号效果'],
    hint: [
      'Bounce, pulse, scale, replace. Your own artwork.',
      'Quique, pulso, escala, troca. Com seu próprio desenho.',
      'Rebote, pulso, escala, cambio. Con tu propio dibujo.',
      '弹跳、脉冲、缩放、替换，使用你自己的图形。',
    ],
    guide: 'web-platforms#symbols',
    apis: ['symbolEffect'],
    code: `scope.symbolEffect(icon, 'bounce')\n// Also 'pulse', 'scale', 'variableColor'.\n// For replacement: { replace: detachedIconElement }.\n// Mark opacity layers with data-jolt-symbol-layer.`,
    mount(ctx) {
      const icon = element(ctx.host, 'div', 'lab-symbol')
      icon.setAttribute('aria-hidden', 'true')
      for (const glyph of ['✳︎', '✳︎', '✳︎'])
        element(icon, 'span', '', glyph).dataset.joltSymbolLayer = ''
      let effect: WebSymbolEffect | undefined
      const play = (name: 'bounce' | 'pulse' | 'scale' | 'variableColor') => {
        effect?.dispose()
        effect = ctx.scope.symbolEffect(icon, name)
      }
      return {
        run: () => play('bounce'),
        actions: [
          action('pulse', ['Pulse', 'Pulso', 'Pulso', '脉冲'], () => play('pulse')),
          action('scale', ['Scale', 'Escala', 'Escala', '缩放'], () => play('scale')),
          action('layers', ['Layers', 'Camadas', 'Capas', '图层'], () =>
            play('variableColor'),
          ),
          action('replace', ['Replace', 'Trocar', 'Cambiar', '替换'], () => {
            const replacement = ctx.host.ownerDocument.createElement('span')
            replacement.textContent = icon.textContent === '↗' ? '✳︎' : '↗'
            replacement.dataset.joltSymbolLayer = ''
            effect?.dispose()
            effect = ctx.scope.symbolEffect(icon, { replace: replacement })
          }),
        ],
      }
    },
  },
]
