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

// Differential fixtures are test-only resources: Apple's scalar engine must match portable math.
const { solveSpring } = await import('../dist/core/spring.js')
const { createPreset } = await import('../dist/core/preset-recipe.js')
const fixtures = {
  springs: [
    { mass: 1, stiffness: 170, damping: 26 },
    { mass: 1, stiffness: 100, damping: 20 },
    { mass: 1, stiffness: 100, damping: 8 },
    { mass: 2, stiffness: 100, damping: 50 },
  ].flatMap((physics) =>
    [0, 120].map((velocity) => {
      const from = -20,
        to = 80,
        precision = 0.001
      const solved = solveSpring(physics, from, to, velocity, precision)
      return {
        physics,
        from,
        to,
        velocity,
        precision,
        duration: solved.duration,
        samples: [0, 16, 100, 250, 500, 1000, 5000, 11000].map((at) => ({
          at,
          position: solved.position(at),
          velocity: solved.velocity(at),
        })),
      }
    }),
  ),
  recipes: names.flatMap((name) =>
    [
      {},
      { distance: 0 },
      { distance: 48, scale: 0.7 },
      ...['up', 'down', 'left', 'right'].map((direction) => ({
        direction,
        distance: 36,
        duration: 180,
      })),
    ].map((parameters) => {
      const recipe = createPreset(name, parameters)
      const from = { x: 0, y: 0, scale: 1, opacity: 1 },
        to = { ...from }
      for (const [key, value] of Object.entries(recipe.keyframes)) {
        if (Array.isArray(value)) {
          from[key] = value[0]
          to[key] = value.at(-1)
        } else to[key] = value
      }
      return { name, parameters, from, to }
    }),
  ),
}
const fixtureFile = new URL(
  '../packages/swiftui/Tests/JoltCoreTests/Fixtures/portable.json',
  import.meta.url,
)
const fixtureData = JSON.stringify(fixtures, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (readFileSync(fixtureFile, 'utf8') !== fixtureData)
    throw Error('Swift portable numerical fixtures are stale.')
} else {
  mkdirSync(new URL('.', fixtureFile), { recursive: true })
  writeFileSync(fixtureFile, fixtureData)
}
