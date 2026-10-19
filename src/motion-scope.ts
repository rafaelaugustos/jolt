import { animate, decay } from './animate.js'
import { press } from './press.js'
import { sequence } from './sequence.js'
import {
  motionStates,
  type MotionState,
  type MotionDefinitions,
  type MotionStates,
  type MotionStatesOptions,
} from './motion-states.js'
import type { Target } from './types.js'

/** A cleanup function or a handle owned exclusively by one scope. */
export type MotionResource = (() => void) | { stop(): void } | { dispose(): void }
type Controlled = {
  pause?: () => void
  play?: () => void
  readonly paused?: boolean
  readonly finished?: Promise<unknown>
}
interface Entry {
  resource?: MotionResource
  setup?: () => MotionResource
  resume: boolean
}
const owners = new WeakMap<object, object>()

export interface MotionScope {
  readonly disposed: boolean
  readonly suspended: boolean
  /** Owned handles/subscriptions, including suspended subscription factories. */
  readonly size: number
  animate: typeof animate
  decay: typeof decay
  sequence: typeof sequence
  press: typeof press
  states<
    T extends Record<string, Target>,
    const S extends Record<string, MotionState<keyof T>>,
  >(
    targets: T,
    definitions: MotionDefinitions<T, S>,
    options?: Omit<MotionStatesOptions, 'scope'>,
  ): MotionStates<Extract<keyof S, string>>
  /** Adopt an existing handle. Completed animations are released automatically. */
  add<T extends MotionResource>(resource: T): T
  /** Attach a subscription, detach on suspension, and recreate on resume. */
  use(setup: () => MotionResource): () => void
  /** Pause playable handles; cancel non-playable ones; detach subscriptions. */
  suspend(): void
  resume(): void
  /** Cancel all owned work without destroying the scope, e.g. when recycling a cell. */
  reset(): void
  dispose(): void
}

/** Framework-independent ownership. Native unload never permanently destroys a scope. */
export function motionScope(): MotionScope {
  const entries = new Set<Entry>()
  const adopted = new Map<MotionResource, Entry>()
  const identity = {}
  let disposed = false
  let suspended = false
  let clearing = false
  const assertAlive = () => {
    if (disposed) throw new Error('Motion scope is disposed.')
    if (clearing) throw new Error('Motion scope is resetting.')
  }
  const assertActive = () => {
    assertAlive()
    if (suspended)
      throw new Error('Motion scope is suspended; resume it before starting work.')
  }
  const validate = (resource: MotionResource) => {
    if (
      typeof resource !== 'function' &&
      (!resource ||
        (typeof (resource as { dispose?: unknown }).dispose !== 'function' &&
          typeof (resource as { stop?: unknown }).stop !== 'function'))
    )
      throw new TypeError(
        'A motion resource must be a cleanup function or expose stop()/dispose().',
      )
    const finished = (resource as Controlled).finished
    if (finished && typeof finished.then !== 'function')
      throw new TypeError('Resource finished must be a promise.')
    if (owners.has(resource) && owners.get(resource) !== identity)
      throw new Error('Motion resource already belongs to another scope.')
  }
  const forget = (entry: Entry) => {
    const resource = entry.resource
    if (resource) {
      owners.delete(resource)
      adopted.delete(resource)
      entry.resource = undefined
    }
    entry.resume = false
  }
  const disposeResource = (resource: MotionResource) => {
    if (typeof resource === 'function') resource()
    else if (typeof (resource as { dispose?: unknown }).dispose === 'function')
      (resource as { dispose(): void }).dispose()
    else (resource as { stop(): void }).stop()
  }
  const release = (entry: Entry) => {
    const resource = entry.resource
    forget(entry)
    if (!resource) return
    disposeResource(resource)
  }
  const remove = (entry: Entry) => {
    entries.delete(entry)
    release(entry)
  }
  const attach = (entry: Entry, resource: MotionResource) => {
    validate(resource)
    if (adopted.has(resource))
      throw new Error('Subscription factory returned an already owned resource.')
    entry.resource = resource
    adopted.set(resource, entry)
    owners.set(resource, identity)
    const finished = (resource as Controlled).finished
    if (!entry.setup && finished) {
      const settled = () => {
        if (entry.resource !== resource) return
        forget(entry)
        entries.delete(entry)
      }
      void finished.then(settled, settled)
    }
  }
  const startSubscription = (entry: Entry) => {
    const resource = entry.setup!()
    validate(resource)
    // Setup may synchronously navigate away, suspend or remove its own scope.
    if (disposed || suspended || !entries.has(entry)) {
      if (!owners.has(resource)) disposeResource(resource)
      return
    }
    attach(entry, resource)
  }
  // One bad cleanup must not strand the other subscriptions.
  const visit = (action: (entry: Entry) => void) => {
    const errors: unknown[] = []
    for (const entry of [...entries]) {
      if (!entries.has(entry)) continue
      try {
        action(entry)
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length)
      throw new AggregateError(errors, 'Motion scope cleanup/lifecycle failed.')
  }
  const startOwned = <T extends MotionResource>(factory: () => T): T => {
    assertActive()
    const resource = factory()
    try {
      return scope.add(resource)
    } catch (error) {
      if (!owners.has(resource)) disposeResource(resource)
      throw error
    }
  }
  const scope: MotionScope = {
    get disposed() {
      return disposed
    },
    get suspended() {
      return suspended
    },
    get size() {
      return entries.size
    },
    animate(...args) {
      return startOwned(() => animate(...args))
    },
    decay(...args) {
      return startOwned(() => decay(...args))
    },
    sequence(...args) {
      return startOwned(() => sequence(...args))
    },
    press(...args) {
      return scope.use(() => press(...args))
    },
    states(targets, definitions, options) {
      return startOwned(() => motionStates(targets, definitions, options))
    },
    add(resource) {
      assertActive()
      validate(resource)
      if (adopted.has(resource)) return resource
      const entry: Entry = { resume: false }
      attach(entry, resource)
      entries.add(entry)
      return resource
    },
    use(setup) {
      assertAlive()
      if (typeof setup !== 'function')
        throw new TypeError('Motion subscription needs a factory.')
      const entry: Entry = { setup, resume: false }
      entries.add(entry)
      try {
        if (!suspended) startSubscription(entry)
      } catch (error) {
        remove(entry)
        throw error
      }
      return () => remove(entry)
    },
    suspend() {
      if (disposed || suspended) return
      suspended = true
      visit((entry) => {
        if (entry.setup) {
          release(entry)
          return
        }
        const resource = entry.resource as Controlled | undefined
        if (
          typeof resource?.pause === 'function' &&
          typeof resource.play === 'function'
        ) {
          entry.resume = resource.paused !== true
          if (entry.resume) resource.pause()
        } else remove(entry)
      })
    },
    resume() {
      if (disposed || !suspended) return
      suspended = false
      visit((entry) => {
        if (disposed || suspended) return
        if (entry.setup) startSubscription(entry)
        else if (entry.resume) {
          entry.resume = false
          ;(entry.resource as Controlled).play?.()
        }
      })
    },
    reset() {
      if (disposed || clearing) return
      clearing = true
      try {
        visit(remove)
      } finally {
        clearing = false
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      visit(remove)
    },
  }
  return scope
}
