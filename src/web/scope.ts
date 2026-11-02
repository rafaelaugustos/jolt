import type { WebRuntime } from './public.js'
import type { WebColorValue, WebMapOptions, WebReadableValue } from './value.js'

/** Only explicitly adopted resources are destroyed; borrowed inputs stay alive. */
export type WebMotionResource = (() => void) | { dispose(): void } | { stop(): void }
type Controlled = {
  pause?: () => void
  play?: () => void
  paused?: boolean
  suspend?: () => void
  resume?: () => void
  suspended?: boolean
  finished?: Promise<unknown>
}
type Factories = Pick<
  WebRuntime,
  | 'animate'
  | 'animateItems'
  | 'decay'
  | 'drawPath'
  | 'motionStates'
  | 'sequence'
  | 'timeline'
  | 'set'
  | 'animateSize'
  | 'animateLayout'
  | 'seekableTimeline'
  | 'playbackProgress'
  | 'motionValue'
  | 'springValue'
  | 'bind'
  | 'press'
  | 'drag'
  | 'observeGeometry'
  | 'scrollValue'
  | 'scrollLinked'
  | 'pointerFollow'
  | 'viewportEnter'
  | 'sharedLayout'
>
export interface WebMotionScope extends Factories {
  readonly disposed: boolean
  readonly suspended: boolean
  readonly size: number
  /** Idempotent adoption. Non-playable resources are disposed on suspension. */
  add<T extends WebMotionResource>(resource: T): T
  /** Document a borrowed resource. It is never paused, stopped or disposed here. */
  borrow<T extends WebMotionResource>(resource: T): T
  scope(setup?: (scope: WebMotionScope) => void): WebMotionScope
  /** Transactional setup, torn down on suspension and recreated on resume. */
  use(setup: (scope: WebMotionScope) => void | WebMotionResource): () => void
  map(
    source: WebReadableValue,
    input: readonly number[],
    output: readonly number[],
    options?: WebMapOptions,
  ): WebReadableValue
  map(
    source: WebReadableValue,
    input: readonly number[],
    output: readonly string[],
    options?: WebMapOptions,
  ): WebColorValue
  subscribe(source: WebReadableValue, listener: (value: number) => void): () => void
  suspend(): void
  resume(): void
  reset(): void
  dispose(): void
}
interface Entry {
  resource?: WebMotionResource
  setup?: (scope: WebMotionScope) => void | WebMotionResource
  restart?: () => void
  retain?: boolean
}

export function createWebScope(
  runtime: WebRuntime,
  owners: WeakMap<WebMotionResource, object>,
  forget: () => void,
  trace?: (
    reason: 'adopted' | 'suspended' | 'resumed' | 'disposed',
    resource?: WebMotionResource,
  ) => void,
): WebMotionScope {
  const entries = new Set<Entry>()
  const adopted = new Map<WebMotionResource, Entry>()
  const identity = {}
  let disposed = false,
    suspended = false,
    clearing = false
  const assert = (active = false) => {
    if (disposed || clearing)
      throw new Error('Web motion scope is disposed or resetting.')
    if (active && suspended)
      throw new Error('Resume the Web motion scope before adding work.')
  }
  const validate = (resource: WebMotionResource) => {
    if (
      typeof resource !== 'function' &&
      (!resource ||
        (typeof (resource as { dispose?: unknown }).dispose !== 'function' &&
          typeof (resource as { stop?: unknown }).stop !== 'function'))
    )
      throw new TypeError('Expected a cleanup function or stop()/dispose() resource.')
    if (owners.has(resource) && owners.get(resource) !== identity)
      throw new Error('The resource already belongs to another Web motion scope.')
    const finished = (resource as Controlled).finished
    if (finished !== undefined && typeof finished?.then !== 'function')
      throw new TypeError('Resource finished must be a promise.')
  }
  const destroy = (resource: WebMotionResource) => {
    if (typeof resource === 'function') resource()
    else if ('dispose' in resource) resource.dispose()
    else resource.stop()
  }
  const detach = (entry: Entry) => {
    const resource = entry.resource
    entry.resource = undefined
    entry.restart = undefined
    if (resource) {
      adopted.delete(resource)
      owners.delete(resource)
    }
    return resource
  }
  const release = (entry: Entry) => {
    const resource = detach(entry)
    if (resource) destroy(resource)
  }
  const remove = (entry: Entry) => {
    entries.delete(entry)
    release(entry)
  }
  const visit = (action: (entry: Entry) => void, reverse = false) => {
    const errors: unknown[] = []
    const batch = [...entries]
    if (reverse) batch.reverse()
    for (const entry of batch) {
      if (!entries.has(entry)) continue
      try {
        action(entry)
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length)
      throw new AggregateError(errors, 'Web motion scope lifecycle failed.')
  }
  const adopt = <T extends WebMotionResource>(resource: T, retain = false): T => {
    assert(true)
    validate(resource)
    if (adopted.has(resource)) return resource
    const entry: Entry = { resource, retain }
    adopted.set(resource, entry)
    owners.set(resource, identity)
    entries.add(entry)
    trace?.('adopted', resource)
    const finished = (resource as Controlled).finished
    if (finished) {
      const settled = () => {
        if (entry.resource !== resource) return
        detach(entry)
        entries.delete(entry)
      }
      void finished.then(settled, settled)
    }
    return resource
  }
  const start = <T extends WebMotionResource>(factory: () => T, retain = false): T => {
    assert(true)
    const resource = factory()
    try {
      return adopt(resource, retain)
    } catch (error) {
      if (!owners.has(resource)) destroy(resource)
      throw error
    }
  }
  const activate = (entry: Entry) => {
    const child = runtime.scope()
    entry.resource = child
    try {
      const result = entry.setup!(child)
      if (result !== undefined) {
        if (result && typeof (result as { then?: unknown }).then === 'function')
          throw new TypeError('Web motion setup must be synchronous.')
        if (!child.disposed) child.add(result)
        else if (!owners.has(result)) destroy(result)
      }
      // Setup can synchronously dispose/suspend its parent.
      if (disposed || suspended || !entries.has(entry)) {
        entry.resource = undefined
        child.dispose()
      }
    } catch (error) {
      entry.resource = undefined
      entries.delete(entry)
      try {
        child.dispose()
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Web motion setup and cleanup failed.')
      }
      throw error
    }
  }
  const ownPlayback = <K extends 'animate' | 'set'>(method: K): WebRuntime[K] =>
    ((...args: unknown[]) => {
      assert(true)
      const resource = (
        runtime[method] as (...args: unknown[]) => WebMotionResource | void
      ).apply(runtime, args)
      if (resource === undefined) return
      try {
        return adopt(resource)
      } catch (error) {
        if (!owners.has(resource)) destroy(resource)
        throw error
      }
    }) as WebRuntime[K]
  const scope: WebMotionScope = {
    get disposed() {
      return disposed
    },
    get suspended() {
      return suspended
    },
    get size() {
      return entries.size
    },
    add: (resource) => adopt(resource),
    borrow(resource) {
      assert()
      validateBorrow(resource)
      return resource
    },
    scope: (setup) => start(() => runtime.scope(setup)),
    animate: ownPlayback('animate'),
    animateItems: (...args) => start(() => runtime.animateItems(...args)),
    drawPath: (...args) => start(() => runtime.drawPath(...args)),
    motionStates: (targets, definitions, options) =>
      start(() => runtime.motionStates(targets, definitions, options)),
    sequence: (...args) => start(() => runtime.sequence(...args)),
    timeline: (...args) => start(() => runtime.timeline(...args)),
    decay: (...args) => start(() => runtime.decay(...args)),
    set: ownPlayback('set'),
    animateSize: (...args) => start(() => runtime.animateSize(...args)),
    animateLayout: (...args) => start(() => runtime.animateLayout(...args)),
    seekableTimeline: (...args) => start(() => runtime.seekableTimeline(...args)),
    // Source/mapping data survives a temporary suspension. Followers pause;
    // bindings/observers belong in use() when they need to be recreated.
    playbackProgress: (...args) => start(() => runtime.playbackProgress(...args), true),
    motionValue: (...args) => start(() => runtime.motionValue(...args), true),
    springValue: (...args) => start(() => runtime.springValue(...args)),
    bind: (...args) => start(() => runtime.bind(...args)),
    press: (...args) => start(() => runtime.press(...args)),
    drag: (...args) => start(() => runtime.drag(...args)),
    observeGeometry: (...args) => start(() => runtime.observeGeometry(...args)),
    scrollValue: (...args) => start(() => runtime.scrollValue(...args)),
    scrollLinked: (...args) => start(() => runtime.scrollLinked(...args)),
    pointerFollow: (...args) => start(() => runtime.pointerFollow(...args)),
    viewportEnter: (...args) => start(() => runtime.viewportEnter(...args)),
    sharedLayout: (...args) => start(() => runtime.sharedLayout(...args)),
    map: ((
      source: WebReadableValue,
      input: readonly number[],
      output: readonly number[],
      options?: WebMapOptions,
    ) => start(() => source.to(input, output, options), true)) as WebMotionScope['map'],
    subscribe(source, listener) {
      return scope.use((child) => child.add(source.subscribe(listener)))
    },
    use(setup) {
      assert()
      if (typeof setup !== 'function') throw new TypeError('Expected a setup function.')
      const entry: Entry = { setup }
      entries.add(entry)
      if (!suspended) activate(entry)
      return () => remove(entry)
    },
    suspend() {
      if (disposed || suspended) return
      suspended = true
      trace?.('suspended')
      visit((entry) => {
        if (entry.setup) {
          release(entry)
          return
        }
        const resource = entry.resource as Controlled | undefined
        if (resource?.suspend && resource.resume) {
          if (!resource.suspended) {
            entry.restart = () => resource.resume!()
            resource.suspend()
          }
        } else if (resource?.pause && resource.play) {
          if (!resource.paused) {
            entry.restart = () => resource.play!()
            resource.pause()
          }
        } else if (!entry.retain) remove(entry)
      })
    },
    resume() {
      if (disposed || !suspended) return
      suspended = false
      trace?.('resumed')
      visit((entry) => {
        if (disposed || suspended) return
        if (entry.setup) activate(entry)
        else {
          const restart = entry.restart
          entry.restart = undefined
          restart?.()
        }
      })
    },
    reset() {
      if (disposed || clearing) return
      clearing = true
      try {
        visit(remove, true)
      } finally {
        clearing = false
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      trace?.('disposed')
      try {
        visit(remove, true)
      } finally {
        forget()
      }
    },
  }
  return scope
}

function validateBorrow(resource: WebMotionResource) {
  if (!resource || (typeof resource !== 'function' && typeof resource !== 'object'))
    throw new TypeError('Expected a borrowed resource.')
}
