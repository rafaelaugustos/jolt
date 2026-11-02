import type { Property } from './types.js'

export type WebDiagnosticReason =
  | 'claimed'
  | 'completed'
  | 'interrupted'
  | 'stopped'
  | 'released'
  | 'reduced-motion'
  | 'disposed'
  | 'adopted'
  | 'suspended'
  | 'resumed'
export interface WebDiagnosticEvent {
  sequence: number
  time: number
  reason: WebDiagnosticReason
  owner?: number
  target?: number
  scope?: number
  property?: Property
  layer?: string
}
export interface WebDiagnosticTarget {
  id: number
  execution: string
  channels: {
    property: Property
    layer?: string
    kind: 'animation' | 'value' | 'rest'
    owner?: number
    paused?: boolean
  }[]
}
export interface WebDiagnosticSnapshot {
  disposed: boolean
  resources: Record<string, number | boolean>
  targets: WebDiagnosticTarget[]
  events: WebDiagnosticEvent[]
}
export interface WebDiagnostics {
  /** Pull-only snapshot: no timers, observers or frame callbacks are installed. */
  snapshot(): WebDiagnosticSnapshot
  clear(): void
  dispose(): void
}
export interface WebDiagnosticsOptions {
  development: true
  /** Ring-buffer capacity, 1–2000. Default 200. */
  maxEvents?: number
}

/** Stores numeric IDs only. Never keeps DOM, values or completed owners in history. */
export class DiagnosticCollector {
  private readonly ids = new WeakMap<object, number>()
  private nextId = 0
  private sequence = 0
  private events: WebDiagnosticEvent[] = []
  private final?: Omit<WebDiagnosticSnapshot, 'events'>
  private ended = false
  readonly capacity: number
  constructor(
    options: WebDiagnosticsOptions,
    private read?: () => Omit<WebDiagnosticSnapshot, 'events'>,
    private forget?: () => void,
  ) {
    if (options?.development !== true)
      throw new TypeError('Web diagnostics require development: true.')
    this.capacity = options.maxEvents ?? 200
    if (!Number.isInteger(this.capacity) || this.capacity < 1 || this.capacity > 2000)
      throw new RangeError('maxEvents must be an integer from 1 to 2000.')
  }
  id(value: object) {
    let id = this.ids.get(value)
    if (id === undefined) {
      id = ++this.nextId
      this.ids.set(value, id)
    }
    return id
  }
  record(event: Omit<WebDiagnosticEvent, 'sequence'>) {
    if (this.ended) return
    this.events.push({ sequence: ++this.sequence, ...event })
    if (this.events.length > this.capacity)
      this.events.splice(0, this.events.length - this.capacity)
  }
  snapshot(): WebDiagnosticSnapshot {
    const data = this.read?.() ??
      this.final ?? { disposed: true, resources: {}, targets: [] }
    return {
      ...data,
      resources: { ...data.resources },
      targets: data.targets.map((target) => ({
        ...target,
        channels: target.channels.map((channel) => ({ ...channel })),
      })),
      events: this.events.map((event) => ({ ...event })),
    }
  }
  end() {
    if (this.ended) return
    this.final = this.read?.()
    this.read = undefined
    this.ended = true
    const forget = this.forget
    this.forget = undefined
    forget?.()
  }
  handle(): WebDiagnostics {
    return {
      snapshot: () => this.snapshot(),
      clear: () => {
        this.events = []
      },
      dispose: () => {
        this.end()
        this.events = []
      },
    }
  }
}
