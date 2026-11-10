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

// Numerical contracts consumed by the Swift adapter and existing browser runtime.
const { dropHits } = await import('../dist/core/drop.js')
const { moveAt } = await import('../dist/core/reorder.js')
const { rigDestination } = await import('../dist/core/rig.js')
const { sampleParticle } = await import('../dist/core/particle-motion.js')
const interactions = {
  drops: [-20, 0, 15, 20, 30].flatMap((x) =>
    ['center', 'overlap'].map((policy) => {
      const source = { x, y: 0, width: 20, height: 20 },
        target = { x: 20, y: 5, width: 10, height: 10 }
      return {
        source,
        target,
        overlap: policy === 'overlap',
        hit: dropHits(source, target, policy),
      }
    }),
  ),
  moves: [0, 1, 2, 3].flatMap((from) =>
    [0, 1, 2, 3].map((to) => ({
      from,
      to,
      result: moveAt(['a', 'b', 'c', 'd'], from, to) ?? null,
    })),
  ),
  particles: [false, true].flatMap((fadeOut) =>
    [0, 16, 500, 1500, 2000].map((at) => ({
      at,
      fadeOut,
      ...sampleParticle(20, 30, 40, -100, 420, Math.PI, 1500, at, fadeOut),
    })),
  ),
  rigs: [false, true].flatMap((bounded) =>
    [0, 0.25, 1, 2].map((weight) => {
      const part = bounded ? { rotation: [-90, 90] } : {},
        rest = 170,
        current = -160
      const raw = rigDestination(part, 'arm', 'rotate', rest, current, [
        { pose: { arm: { rotate: -170 } }, weight },
        { pose: { arm: { rotate: 20 } }, weight: 0.4 },
      ])
      return {
        bounded,
        weight,
        rest,
        current,
        value: bounded ? Math.max(-90, Math.min(90, raw)) : raw,
      }
    }),
  ),
}
const interactionsFile = new URL(
  '../packages/swiftui/Tests/JoltCoreTests/Fixtures/interactions.json',
  import.meta.url,
)
const interactionsData = JSON.stringify(interactions, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (readFileSync(interactionsFile, 'utf8') !== interactionsData)
    throw Error('Swift interaction/character fixtures are stale.')
} else writeFileSync(interactionsFile, interactionsData)

const { sheetGeometry, releaseStop } = await import('../dist/core/sheet-geometry.js')
const { reorderDestination } = await import('../dist/core/reorder.js')
const curveRecipes = [
  {
    start: [0, 0],
    segments: [
      {
        kind: 'quadratic',
        points: [
          [50, 100],
          [100, 0],
        ],
      },
    ],
  },
  {
    start: [0, 0],
    segments: [
      {
        kind: 'cubic',
        points: [
          [30, -120],
          [100, 120],
          [180, 0],
        ],
      },
    ],
  },
  {
    start: [0, 0],
    segments: [
      {
        kind: 'cubic',
        points: [
          [200, 200],
          [-200, 200],
          [0, 0],
        ],
      },
    ],
  },
  {
    start: [0, 0],
    segments: [
      {
        kind: 'cubic',
        points: [
          [1, 0],
          [99, 0],
          [100, 0],
        ],
      },
    ],
  },
  {
    start: [3, 4],
    segments: [
      {
        kind: 'quadratic',
        points: [
          [3, 4],
          [3, 4],
        ],
      },
    ],
  },
  {
    start: [0, 0],
    segments: [
      { kind: 'line', points: [[40, 20]] },
      {
        kind: 'quadratic',
        points: [
          [80, -40],
          [120, 30],
        ],
      },
      {
        kind: 'cubic',
        points: [
          [140, 100],
          [60, 180],
          [-20, 80],
        ],
      },
    ],
  },
]
const geometryFixtures = {
  sheets: [
    [800, 900, 1000, 0, 24, 34, 420, true],
    [800, 900, 1000, 300, 24, 34, 420, true],
    [500, 700, 1000, 300, 24, 34, 800, true],
    [600, 600, 600, 100, 0, 34, 300, false],
    [100, 100, 100, 100, 30, 34, 300, true],
  ].map(
    ([
      hostHeight,
      hostBottom,
      windowHeight,
      keyboardHeight,
      safeTop,
      safeBottom,
      contentHeight,
      extendable,
    ]) => {
      const snaps = [120, '50%', 'content']
      const geometry = sheetGeometry(
        snaps,
        hostHeight,
        hostBottom,
        windowHeight,
        keyboardHeight,
        safeTop,
        safeBottom,
        contentHeight,
        extendable,
      )
      return {
        snaps,
        hostHeight,
        safeTop,
        safeBottom,
        contentHeight,
        extendable,
        keyboardOverlap: Math.max(
          0,
          Math.min(hostHeight, hostBottom - (windowHeight - keyboardHeight)),
        ),
        geometry,
        releases: [false, true].flatMap((dismissible) =>
          [0, 200, 650].flatMap((y) =>
            [-6000, 0, 1800].map((velocity) => ({
              y,
              velocity,
              dismissible,
              index: geometry.stops.indexOf(
                releaseStop(geometry, y, velocity, dismissible),
              ),
            })),
          ),
        ),
      }
    },
  ),
  reorder: [0, 1, 2, 3].flatMap((from) =>
    [-10, 0, 22, 80, 150, 300, 600].map((center) => {
      const heights = [44, 130, 72, 210],
        spacing = 8
      let start = 0
      const rows = heights.map((size) => {
        const row = { start, size }
        start += size + spacing
        return row
      })
      return {
        heights,
        spacing,
        from,
        center,
        destination: reorderDestination(rows, from, center),
      }
    }),
  ),
  curves: curveRecipes.map((recipe) => {
    const data =
      'M' +
      recipe.start.join(' ') +
      recipe.segments
        .map(
          (segment) =>
            ({ line: 'L', quadratic: 'Q', cubic: 'C' })[segment.kind] +
            segment.points.flat().join(' '),
        )
        .join(' ')
    const path = parsePath(data)
    return {
      ...recipe,
      length: path.length,
      samples: [-0.1, 0, 0.001, 0.1, 0.25, 0.5, 0.75, 0.9, 0.999, 1, 1.1].map(
        (progress) => ({ progress, ...path.at(progress) }),
      ),
    }
  }),
}
const geometryFile = new URL(
  '../packages/swiftui/Tests/JoltCoreTests/Fixtures/geometry.json',
  import.meta.url,
)
const geometryData = JSON.stringify(geometryFixtures, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (readFileSync(geometryFile, 'utf8') !== geometryData)
    throw Error('Swift panel/measured geometry fixtures are stale.')
} else writeFileSync(geometryFile, geometryData)
