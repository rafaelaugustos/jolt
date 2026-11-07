import type { RenderActivity } from './render-activity.js'

export type AdapterEventKind =
  | 'prepare'
  | 'write'
  | 'start'
  | 'replace'
  | 'bind'
  | 'pause'
  | 'play'
  | 'seek'
  | 'cancel'
  | 'complete'
  | 'dispose'
export interface AdapterObservation {
  alive: boolean
  values: readonly number[] | null
  owner?: object
  binding: boolean
  paused?: boolean
}
interface AdapterDefinition {
  name: string
  units: readonly string[]
  platform: 'ios' | 'android' | 'web'
  target: object
  read(): AdapterObservation
}
interface Hook {
  now(): number
  event(
    kind: AdapterEventKind,
    owner?: object,
    previous?: object,
    cost?: number,
    components?: number,
  ): void
}
const definitions = new WeakMap<object, AdapterDefinition>()
const hooks = new WeakMap<object, Set<Hook>>()
export function registerAdapterInspection(
  property: object,
  definition: AdapterDefinition,
) {
  definitions.set(property, definition)
}
export function adapterEvent(
  property: object,
  kind: AdapterEventKind,
  owner?: object,
  previous?: object,
) {
  const listeners = hooks.get(property)
  if (listeners) for (const listener of listeners) listener.event(kind, owner, previous)
  if (kind === 'dispose') {
    definitions.delete(property)
    hooks.delete(property)
  }
}
/** Disabled path performs one WeakMap lookup and allocates no timing/sample objects. */
export function adapterMeasure(property: object, kind: 'prepare' | 'write') {
  const listeners = hooks.get(property)
  if (!listeners?.size) return undefined
  const starts = [...listeners].map((listener) => [listener, listener.now()] as const)
  return (components = 0) => {
    for (const [listener, start] of starts)
      listener.event(
        kind,
        undefined,
        undefined,
        Math.max(0, listener.now() - start),
        components,
      )
  }
}
export interface AdapterInspectionEvent {
  sequence: number
  at: number
  target: string
  kind: AdapterEventKind
  owner?: number
  previous?: number
  ownerLabel?: string
  previousLabel?: string
  jsMs?: number
  preparedComponents?: number
}
export interface AdapterInspectionSnapshot {
  version: 1
  properties: {
    id: string
    name: string
    units: string[]
    platform: 'ios' | 'android' | 'web'
    target: number
    values: number[] | null
    observation: 'adapter-read' | 'unavailable'
    owner?: number
    ownerLabel?: string
    binding: boolean
    paused?: boolean
  }[]
  activities: { id: string; active: boolean; suspended: boolean; references: number }[]
  events: AdapterInspectionEvent[]
  cost: {
    reads: number
    readMs: number
    prepareMs: number
    updateMs: number
    writes: number
    preparedComponents: number
    droppedEvents: number
  }
  /** No renderer, native sampling, allocator or GPU measurements are inferred. */
  unavailable: readonly ['gpuTime', 'nativeSamplingTime', 'allocatedBytes']
}
export interface AdapterInspector {
  watch(property: object, id: string): () => void
  activity(activity: RenderActivity, id: string): () => void
  label(owner: object, label: string): void
  read(): AdapterInspectionSnapshot
  clear(): void
  dispose(): void
}
/** Explicit, bounded, pull-only registration. Weak references do not keep targets alive. */
export function createAdapterInspector(options: {
  development: true
  capacity?: number
  now(): number
}): AdapterInspector {
  if (options.development !== true)
    throw new TypeError('Adapter inspection requires development: true.')
  const capacity = options.capacity ?? 240
  if (!Number.isInteger(capacity) || capacity < 8 || capacity > 2000)
    throw new RangeError('Inspector capacity is 8–2000.')
  const properties = new Map<string, { ref: WeakRef<object>; off(): void }>()
  const activities = new Map<string, WeakRef<RenderActivity>>()
  const identities = new WeakMap<object, number>(),
    labels = new WeakMap<object, string>()
  let sequence = 0,
    next = 0,
    disposed = false
  const events: AdapterInspectionEvent[] = []
  const cost = {
    reads: 0,
    readMs: 0,
    prepareMs: 0,
    updateMs: 0,
    writes: 0,
    preparedComponents: 0,
    droppedEvents: 0,
  }
  const identity = (value: object) => {
    let id = identities.get(value)
    if (!id) {
      id = ++next
      identities.set(value, id)
    }
    return id
  }
  const validID = (id: string) => {
    if (disposed) throw new Error('Adapter inspector is disposed.')
    if (!/^[A-Za-z][\w.-]{0,63}$/.test(id) || properties.has(id) || activities.has(id))
      throw new TypeError('Use a unique non-personal ASCII inspector ID.')
    if (properties.size + activities.size >= 128)
      throw new RangeError('Inspect at most 128 explicit resources.')
  }
  const remove = (id: string) => {
    properties.get(id)?.off()
    properties.delete(id)
  }
  return {
    watch(property, id) {
      validID(id)
      const definition = definitions.get(property)
      if (!definition)
        throw new TypeError('This resource does not expose adapter inspection.')
      const ref = new WeakRef(property)
      const listener: Hook = {
        now: options.now,
        event(kind, owner, previous, jsMs, components) {
          if (disposed || !properties.has(id)) return
          events.push({
            sequence: ++sequence,
            at: options.now(),
            target: id,
            kind,
            ...(owner && { owner: identity(owner), ownerLabel: labels.get(owner) }),
            ...(previous && {
              previous: identity(previous),
              previousLabel: labels.get(previous),
            }),
            ...(jsMs !== undefined && { jsMs }),
            ...(components !== undefined && { preparedComponents: components }),
          })
          if (events.length > capacity) {
            events.shift()
            cost.droppedEvents++
          }
          if (kind === 'prepare') {
            cost.prepareMs += jsMs ?? 0
            cost.preparedComponents += components ?? 0
          }
          if (kind === 'write') {
            cost.updateMs += jsMs ?? 0
            cost.writes++
          }
          if (kind === 'dispose') remove(id)
        },
      }
      let listeners = hooks.get(property)
      if (!listeners) {
        listeners = new Set()
        hooks.set(property, listeners)
      }
      listeners.add(listener)
      const held = listeners
      properties.set(id, { ref, off: () => held.delete(listener) })
      return () => remove(id)
    },
    activity(activity, id) {
      validID(id)
      activities.set(id, new WeakRef(activity))
      return () => {
        activities.delete(id)
      }
    },
    label(owner, label) {
      if (typeof label !== 'string' || !label || label.length > 100)
        throw new TypeError('Use a short non-personal inspector label.')
      labels.set(owner, label)
      const id = identities.get(owner)
      if (id)
        for (const event of events) {
          if (event.owner === id) event.ownerLabel = label
          if (event.previous === id) event.previousLabel = label
        }
    },
    read() {
      const start = options.now()
      const result: AdapterInspectionSnapshot['properties'] = []
      for (const [id, entry] of properties) {
        const property = entry.ref.deref(),
          definition = property && definitions.get(property)
        if (!definition) {
          remove(id)
          continue
        }
        let observation: AdapterObservation
        try {
          observation = definition.read()
        } catch {
          remove(id)
          continue
        }
        if (!observation.alive) {
          remove(id)
          continue
        }
        result.push({
          id,
          name: definition.name,
          units: [...definition.units],
          platform: definition.platform,
          target: identity(definition.target),
          values: observation.values ? [...observation.values] : null,
          observation: observation.values ? 'adapter-read' : 'unavailable',
          binding: observation.binding,
          paused: observation.paused,
          ...(observation.owner && {
            owner: identity(observation.owner),
            ownerLabel: labels.get(observation.owner),
          }),
        })
      }
      const demand: AdapterInspectionSnapshot['activities'] = []
      for (const [id, ref] of activities) {
        const activity = ref.deref()
        if (!activity || activity.disposed) {
          activities.delete(id)
          continue
        }
        demand.push({
          id,
          active: activity.active,
          suspended: activity.suspended,
          references: activity.size,
        })
      }
      cost.reads++
      cost.readMs += Math.max(0, options.now() - start)
      return {
        version: 1,
        properties: result,
        activities: demand,
        events: events.map((e) => ({ ...e })),
        cost: { ...cost },
        unavailable: ['gpuTime', 'nativeSamplingTime', 'allocatedBytes'],
      }
    },
    clear() {
      events.length = 0
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const id of properties.keys()) remove(id)
      activities.clear()
      events.length = 0
    },
  }
}
