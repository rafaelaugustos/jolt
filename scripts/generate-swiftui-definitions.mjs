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

const { numericMap } = await import('../dist/core/numeric-map.js')
const { colorMixer } = await import('../dist/core/color.js')
const { solveDecay } = await import('../dist/core/decay.js')
const { parsePath } = await import('../dist/core/svg-path.js')
const math = {
  maps: [
    { input: [0, 1], output: [-100, 100] },
    { input: [1, 0.5, 0], output: [20, -10, 5] },
    { input: [-10, 0, 10], output: [4, 9, -3] },
  ].flatMap((data) =>
    [true, false].map((clamp) => ({
      ...data,
      clamp,
      samples: [-20, -1, 0, 0.25, 0.5, 0.75, 1, 10, 20].map((input) => ({
        input,
        ...numericMap(data.input, data.output, { clamp }).sample(input),
      })),
    })),
  ),
  colors: [
    [0xffff0000, 0xff0000ff],
    [0x00ff0000, 0xff00ff00],
    [0x800044ff, 0x4000ff44],
    [0x00000000, 0x00ffffff],
  ].map(([from, to]) => ({
    from,
    to,
    samples: [-0.1, 0, 0.25, 0.5, 0.75, 1, 1.1].map((progress) => ({
      progress,
      argb: colorMixer(from, to)(progress),
    })),
  })),
  decays: [-800, 0, 800].flatMap((velocity) =>
    [0.995, 0.998].map((friction) => {
      const from = 30,
        precision = 0.001,
        motion = solveDecay(from, velocity, friction, precision)
      return {
        from,
        velocity,
        friction,
        precision,
        to: motion.to,
        duration: motion.duration,
        samples: [0, 16, 100, 500, 1000, 5000, 10000].map((at) => ({
          at,
          position: motion.position(at),
          velocity: motion.velocity(at),
        })),
      }
    }),
  ),
  paths: [
    [
      [0, 0],
      [100, 0],
      [100, 100],
    ],
    [
      [20, 30],
      [20, 30],
    ],
    [
      [0, 0],
      [-30, 20],
      [-30, -20],
      [0, 0],
    ],
  ].map((points) => {
    const path = parsePath(
      points.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join(' '),
    )
    return {
      points,
      length: path.length,
      samples: [-0.1, 0, 0.25, 0.5, 0.75, 1, 1.1].map((progress) => ({
        progress,
        ...path.at(progress),
      })),
    }
  }),
}
const mathFile = new URL(
  '../packages/swiftui/Tests/JoltCoreTests/Fixtures/math.json',
  import.meta.url,
)
const mathData = JSON.stringify(math, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (readFileSync(mathFile, 'utf8') !== mathData)
    throw Error('Swift mapping/color/decay/path fixtures are stale.')
} else writeFileSync(mathFile, mathData)
