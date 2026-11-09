import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { presets } from '../dist/core/presets.js'
import { springs } from '../dist/core/transition.js'
import { springPhysics } from '../dist/core/spring.js'
import { timingCurves } from '../dist/core/easing.js'

const names = [
  'fadeIn',
  'fadeInUp',
  'fadeInDown',
  'fadeInLeft',
  'fadeInRight',
  'zoomIn',
  'popIn',
  'fadeOut',
  'fadeOutUp',
  'fadeOutDown',
  'fadeOutLeft',
  'fadeOutRight',
  'zoomOut',
]
function transition(input) {
  if (input.type === 'spring') return { kind: 'spring', ...springPhysics(input) }
  const curve =
    typeof input.ease === 'string'
      ? timingCurves[input.ease]
      : (input.ease ?? timingCurves.easeOut)
  if (!Array.isArray(curve) || curve.length !== 4)
    throw Error('Unsupported SwiftUI preset easing')
  return { kind: 'tween', milliseconds: input.duration ?? 300, curve }
}
const data = {
  schema: 1,
  units: {
    translation: 'points on Apple / DIP native / CSS px Web',
    rotation: 'degrees',
    duration: 'milliseconds',
  },
  curves: timingCurves,
  springs: Object.fromEntries(
    Object.entries(springs).map(([name, value]) => [name, transition(value)]),
  ),
  presets: Object.fromEntries(
    names.map((name) => {
      const recipe = presets[name]
      return [
        name,
        Object.entries(recipe.keyframes).map(([property, frame]) => {
          if (
            !['x', 'y', 'scale', 'opacity'].includes(property) ||
            (Array.isArray(frame) && frame.length !== 2)
          )
            throw Error('Unsupported SwiftUI preset channel')
          return {
            property,
            from: Array.isArray(frame) ? frame[0] : null,
            to: Array.isArray(frame) ? frame[1] : frame,
            transition: transition(recipe.transition[property] ?? recipe.transition),
          }
        }),
      ]
    }),
  ),
}
const file = new URL(
  '../packages/swiftui/Sources/JoltCore/Resources/definitions.json',
  import.meta.url,
)
const encoded = JSON.stringify(data, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (readFileSync(file, 'utf8') !== encoded)
    throw Error(
      'SwiftUI definitions differ from shared Jolt recipes; regenerate and validate.',
    )
  console.log('SwiftUI definitions match shared Jolt presets, curves and spring physics.')
} else {
  mkdirSync(new URL('.', file), { recursive: true })
  writeFileSync(file, encoded)
}
