/** Numeric, opt-in development traces. No views, text, images or native handles. */
export interface TraceMetadata {
  platform: 'ios' | 'android' | 'test'
  os: string
  model: string
  refreshRate: number
  density: number
  width: number
  height: number
}
export interface TraceMotion {
  id: string
  kind: 'spring' | 'drag'
  axis: 'x' | 'y'
  initial: number
  stiffness: number
  damping: number
  mass: number
  min: number
  max: number
  snap: number[]
}
export type TraceInput =
  | { type: 'target'; id: string; value: number }
  | {
      type: 'gesture'
      id: string
      phase: 'begin' | 'move' | 'end' | 'cancel'
      x: number
      y: number
      velocityX: number
      velocityY: number
      pointers: number[]
    }
  | { type: 'layout'; id: string; x: number; y: number; width: number; height: number }
  | { type: 'scroll'; id: string; offset: number }
  | { type: 'keyboard'; inset: number }
  | { type: 'lifecycle'; state: 'suspend' | 'resume' | 'unload' | 'load' }
export interface TraceState {
  position: number
  velocity: number
  settled: boolean
}
export interface TraceTolerance {
  position: number
  velocity: number
}
export type TraceEntry =
  | { at: number; input: TraceInput }
  | { at: number; id: string; expected: TraceState; tolerance: TraceTolerance }
export interface InteractionTrace {
  version: 1
  seed: number
  settings: { timeScale: number; reducedMotion: boolean }
  metadata: TraceMetadata
  motions: TraceMotion[]
  entries: TraceEntry[]
}
const MAX_ENTRIES = 5_000
const MAX_TIME = 300_000
const MAX_BYTES = 2_000_000
type ObjectValue = Record<string, unknown>
function object(value: unknown, fields: string[]): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Expected a trace object.')
  const result = value as ObjectValue
  if (
    Object.keys(result).length !== fields.length ||
    Object.keys(result).some((key) => !fields.includes(key))
  )
    throw new TypeError(
      'Unknown or missing trace fields. Text and image payloads are not accepted.',
    )
  return result
}
function number(value: unknown, min = -1e9, max = 1e9): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new RangeError('Trace numbers must be finite and within their limits.')
  return value
}
function integer(value: unknown, min = 0, max = 0xffffffff) {
  const n = number(value, min, max)
  if (!Number.isInteger(n)) throw new TypeError('Expected a trace integer.')
  return n
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) throw new TypeError('Unknown trace enum value.')
  return value as T
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(value))
    throw new TypeError('Use a stable, non-personal ASCII view ID (1–64 characters).')
  return value
}
function label(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9 ._(),+-]{1,80}$/.test(value))
    throw new TypeError('Invalid OS/model metadata.')
  return value
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new TypeError('Invalid or oversized trace array.')
  return value
}
function state(value: unknown): TraceState {
  const v = object(value, ['position', 'velocity', 'settled'])
  if (typeof v.settled !== 'boolean') throw new TypeError('Expected a settled boolean.')
  return {
    position: number(v.position),
    velocity: number(v.velocity),
    settled: v.settled,
  }
}
function tolerance(value: unknown): TraceTolerance {
  const v = object(value, ['position', 'velocity'])
  return { position: number(v.position, 0, 100), velocity: number(v.velocity, 0, 1000) }
}
function input(value: unknown, ids: Set<string>): TraceInput {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid trace input.')
  const type = (value as ObjectValue).type
  const fields: Record<string, string[]> = {
    target: ['type', 'id', 'value'],
    gesture: ['type', 'id', 'phase', 'x', 'y', 'velocityX', 'velocityY', 'pointers'],
    layout: ['type', 'id', 'x', 'y', 'width', 'height'],
    scroll: ['type', 'id', 'offset'],
    keyboard: ['type', 'inset'],
    lifecycle: ['type', 'state'],
  }
  if (typeof type !== 'string' || !Object.hasOwn(fields, type))
    throw new TypeError('Unknown trace input type.')
  const v = object(value, fields[type]!)
  const target = type === 'keyboard' || type === 'lifecycle' ? '' : id(v.id)
  if (target && !ids.has(target))
    throw new TypeError('Trace input references an unknown view ID.')
  switch (type) {
    case 'target':
      return { type, id: target, value: number(v.value) }
    case 'gesture': {
      const pointers = list(v.pointers, 10).map((p) => integer(p, 0, 255))
      if (new Set(pointers).size !== pointers.length)
        throw new TypeError('Repeated pointer ID.')
      return {
        type,
        id: target,
        phase: choice(v.phase, ['begin', 'move', 'end', 'cancel']),
        x: number(v.x),
        y: number(v.y),
        velocityX: number(v.velocityX),
        velocityY: number(v.velocityY),
        pointers,
      }
    }
    case 'layout':
      return {
        type,
        id: target,
        x: number(v.x),
        y: number(v.y),
        width: number(v.width, 0, 100_000),
        height: number(v.height, 0, 100_000),
      }
    case 'scroll':
      return { type, id: target, offset: number(v.offset) }
    case 'keyboard':
      return { type, inset: number(v.inset, 0, 100_000) }
    default:
      return {
        type: 'lifecycle',
        state: choice(v.state, ['suspend', 'resume', 'unload', 'load']),
      }
  }
}

/** Strictly validates and copies a v1 trace. Unknown fields fail instead of leaking content. */
export function parseTrace(value: string | unknown): InteractionTrace {
  if (typeof value === 'string') {
    if (value.length > MAX_BYTES) throw new RangeError('Trace exceeds 2 MB.')
    value = JSON.parse(value)
  }
  const v = object(value, [
    'version',
    'seed',
    'settings',
    'metadata',
    'motions',
    'entries',
  ])
  if (v.version !== 1) throw new TypeError('Unsupported interaction trace version.')
  const settings = object(v.settings, ['timeScale', 'reducedMotion'])
  if (typeof settings.reducedMotion !== 'boolean')
    throw new TypeError('Invalid Reduced Motion setting.')
  const m = object(v.metadata, [
    'platform',
    'os',
    'model',
    'refreshRate',
    'density',
    'width',
    'height',
  ])
  const metadata: TraceMetadata = {
    platform: choice(m.platform, ['ios', 'android', 'test']),
    os: label(m.os),
    model: label(m.model),
    refreshRate: number(m.refreshRate, 1, 1000),
    density: number(m.density, 0.1, 20),
    width: number(m.width, 1, 100_000),
    height: number(m.height, 1, 100_000),
  }
  const motions = list(v.motions, 32).map((raw): TraceMotion => {
    const p = object(raw, [
      'id',
      'kind',
      'axis',
      'initial',
      'stiffness',
      'damping',
      'mass',
      'min',
      'max',
      'snap',
    ])
    const min = number(p.min),
      max = number(p.max, min)
    return {
      id: id(p.id),
      kind: choice(p.kind, ['spring', 'drag']),
      axis: choice(p.axis, ['x', 'y']),
      initial: number(p.initial, min, max),
      stiffness: number(p.stiffness, 0.001, 100_000),
      damping: number(p.damping, 0, 10_000),
      mass: number(p.mass, 0.001, 1000),
      min,
      max,
      snap: list(p.snap, 64).map((s) => number(s, min, max)),
    }
  })
  const ids = new Set(motions.map((motion) => motion.id))
  if (!motions.length || ids.size !== motions.length)
    throw new TypeError('Trace needs unique view identities.')
  let previous = 0
  const entries = list(v.entries, MAX_ENTRIES).map((raw): TraceEntry => {
    const sample = raw && typeof raw === 'object' && Object.hasOwn(raw, 'expected')
    const e = object(
      raw,
      sample ? ['at', 'id', 'expected', 'tolerance'] : ['at', 'input'],
    )
    const at = number(e.at, previous, MAX_TIME)
    previous = at
    if (!sample) return { at, input: input(e.input, ids) }
    const target = id(e.id)
    if (!ids.has(target)) throw new TypeError('Checkpoint references an unknown view ID.')
    return {
      at,
      id: target,
      expected: state(e.expected),
      tolerance: tolerance(e.tolerance),
    }
  })
  return {
    version: 1,
    seed: integer(v.seed),
    settings: {
      timeScale: number(settings.timeScale, 0.001, 100),
      reducedMotion: settings.reducedMotion,
    },
    metadata,
    motions,
    entries,
  }
}

export interface TraceRecorder {
  input(event: TraceInput): void
  checkpoint(id: string, value: TraceState, tolerance?: TraceTolerance): void
  stop(): InteractionTrace
  readonly size: number
}
/** Caller supplies a monotonic clock and explicitly chooses which semantic inputs to record. */
export function recordInteraction(options: {
  now: () => number
  metadata: TraceMetadata
  motions: TraceMotion[]
  seed: number
  settings: InteractionTrace['settings']
}): TraceRecorder {
  const trace = parseTrace({
    version: 1,
    seed: options.seed,
    settings: options.settings,
    metadata: options.metadata,
    motions: options.motions,
    entries: [],
  })
  const start = number(options.now(), -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
  let stopped = false
  const append = (
    entry:
      | Omit<Extract<TraceEntry, { input: TraceInput }>, 'at'>
      | Omit<Extract<TraceEntry, { expected: TraceState }>, 'at'>,
  ) => {
    if (stopped) throw new Error('Trace recording has stopped.')
    // Validate before retaining anything; never retain arbitrary input objects.
    const candidate = {
      ...trace,
      entries: [
        {
          ...entry,
          at: number(options.now() - start, trace.entries.at(-1)?.at ?? 0, MAX_TIME),
        },
      ],
    }
    if (trace.entries.length === MAX_ENTRIES)
      throw new RangeError('Trace entry limit reached.')
    trace.entries.push(parseTrace(candidate).entries[0]!)
  }
  return {
    input: (event) => append({ input: event }),
    checkpoint: (id, expected, tolerance = { position: 3, velocity: 30 }) =>
      append({ id, expected, tolerance }),
    get size() {
      return trace.entries.length
    },
    stop() {
      stopped = true
      return parseTrace(trace)
    },
  }
}

/** A local PRNG: replay never changes Math.random or the application's global seed. */
export function traceRandom(seed: number): () => number {
  let value = integer(seed)
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let n = Math.imul(value ^ (value >>> 15), value | 1)
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}
