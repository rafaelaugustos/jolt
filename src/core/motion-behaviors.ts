/** Platform execution is supplied by the native or browser scope adapter. */
export interface BehaviorScope {
  suspend(): void
  resume(): void
  dispose(): void
}
export interface BehaviorHost<S extends BehaviorScope> {
  scope(): S
  hidden(): boolean
  visibility(callback: () => void): () => void
  disposed?(): void
}

export type BehaviorStatus =
  'completed' | 'interrupted' | 'cancelled' | 'failed' | 'blocked'
export interface BehaviorResult {
  readonly status: BehaviorStatus
  readonly error?: unknown
}
export interface BehaviorRun {
  readonly id: number
  readonly name: string
  readonly finished: Promise<BehaviorResult>
  cancel(): void
}
export interface BehaviorContext<S extends BehaviorScope> {
  /** Private to this run; cancellation disposes it before the next run starts. */
  readonly scope: S
  readonly id: number
  readonly active: boolean
  /** Check after an external await, before starting work or changing application state. */
  checkpoint(): void
  /** Await work and check identity before continuing. False animation results cancel the run. */
  wait<T>(work: PromiseLike<T>): Promise<T>
  /** Guard a callback that may arrive after interruption (e.g. a service response). */
  guard<A extends unknown[]>(callback: (...args: A) => void): (...args: A) => void
}
export interface MotionBehavior<S extends BehaviorScope> {
  priority?: number
  /** Evaluated on each request. Domain state stays in the application. */
  when?: () => boolean
  /** Explicit exclusions, including higher-priority requests. Defaults to none. */
  blocks?: readonly string[]
  /** Equal-priority requests, including the same name, reject by default. */
  equal?: 'reject' | 'replace'
  run(context: BehaviorContext<S>): void | PromiseLike<unknown>
}
export interface MotionBehaviorsOptions<N extends string> {
  /** Restart this declared rest behavior after success, cancellation or failure. No implicit resume. */
  rest?: N
  /** Receive failure after cleanup. Throwing here does not strand another run. */
  onError?: (error: unknown, name: N) => void
}
export interface MotionBehaviors<N extends string = string> {
  readonly current: N | undefined
  readonly disposed: boolean
  readonly paused: boolean
  can(name: N): boolean
  request(name: N): BehaviorRun
  /** Cancel the active run and restore the declared rest behavior. */
  cancel(): void
  pause(): void
  play(): void
  /** Cancel without restoration; later requests may start again. */
  stop(): void
  dispose(): void
}

/** One exclusive interaction lane; other coordinators and unrelated input remain independent. */
export function createMotionBehaviors<
  S extends BehaviorScope,
  const D extends Record<string, MotionBehavior<S>>,
>(
  definitions: D,
  options: MotionBehaviorsOptions<Extract<keyof D, string>>,
  host: BehaviorHost<S>,
): MotionBehaviors<Extract<keyof D, string>> {
  type Name = Extract<keyof D, string>
  // Copy policy so changing the caller's object cannot silently change an active run.
  const policies = new Map<Name, MotionBehavior<S>>()
  for (const [name, definition] of Object.entries(definitions)) {
    if (
      !definition ||
      typeof definition.run !== 'function' ||
      !Number.isFinite(definition.priority ?? 0) ||
      (definition.when !== undefined && typeof definition.when !== 'function') ||
      (definition.equal !== undefined &&
        !['reject', 'replace'].includes(definition.equal)) ||
      (definition.blocks !== undefined &&
        (!Array.isArray(definition.blocks) ||
          definition.blocks.some((n) => !Object.hasOwn(definitions, n))))
    )
      throw new TypeError(`Invalid motion behavior "${name}".`)
    policies.set(name as Name, { ...definition, blocks: [...(definition.blocks ?? [])] })
  }
  if (options.rest !== undefined && !policies.has(options.rest))
    throw new TypeError('The rest behavior must be declared.')
  const cancelled = Symbol('cancelled behavior')
  let serial = 0,
    disposed = false,
    paused = false,
    changing = false,
    restPending = false
  let background = host.hidden()
  let unlisten = () => {}
  const isPaused = () => paused || background
  interface Active {
    id: number
    name: Name
    scope: S
    done: boolean
    resolve(result: BehaviorResult): void
    wake?: () => void
  }
  let active: Active | undefined
  const policy = (name: Name) => {
    const definition = policies.get(name)
    if (!definition) throw new TypeError(`Unknown motion behavior "${name}".`)
    return definition
  }
  const report = (error: unknown, name: Name) => {
    try {
      options.onError?.(error, name)
    } catch {
      /* Reporters cannot replace ownership. */
    }
  }
  const finish = (run: Active, status: BehaviorStatus, error?: unknown) => {
    if (run.done) return
    run.done = true
    run.wake?.()
    if (active === run) active = undefined
    try {
      run.scope.dispose()
    } catch (cleanup) {
      error =
        error === undefined
          ? cleanup
          : new AggregateError([error, cleanup], 'Behavior cleanup failed.')
      status = 'failed'
    }
    run.resolve({ status, ...(error === undefined ? {} : { error }) })
    if (error !== undefined) report(error, run.name)
  }
  const restore = (previous?: Name) => {
    if (!disposed && !active && options.rest !== undefined && previous !== options.rest) {
      restPending = isPaused()
      if (!isPaused()) {
        try {
          controller.request(options.rest)
        } catch (error) {
          report(error, options.rest)
        }
      }
    }
  }
  const allowed = (name: Name) => {
    const candidate = policy(name)
    if (disposed || isPaused() || changing) return false
    let permitted: boolean
    changing = true
    try {
      permitted = candidate.when?.() !== false
    } finally {
      changing = false
    }
    if (!permitted || disposed || isPaused()) return false
    if (!active) return true
    const current = policy(active.name)
    if (current.blocks?.includes(name)) return false
    const delta = (candidate.priority ?? 0) - (current.priority ?? 0)
    return delta > 0 || (delta === 0 && candidate.equal === 'replace')
  }
  const cancel = (restoreRest: boolean) => {
    if (changing) return
    restPending = false
    const previous = active?.name
    changing = true
    try {
      if (active) finish(active, 'cancelled')
    } finally {
      changing = false
    }
    if (restoreRest) restore(previous)
  }
  const controller: MotionBehaviors<Name> = {
    get current() {
      return active?.name
    },
    get disposed() {
      return disposed
    },
    get paused() {
      return isPaused()
    },
    can: allowed,
    request(name) {
      const id = ++serial
      if (!allowed(name))
        return { id, name, finished: Promise.resolve({ status: 'blocked' }), cancel() {} }
      // Guard/exclusion callbacks may have changed ownership; evaluate them before mutation.
      const definition = policy(name)
      changing = true
      try {
        if (active) finish(active, 'interrupted')
      } finally {
        changing = false
      }
      if (disposed || isPaused())
        return {
          id,
          name,
          finished: Promise.resolve({ status: 'cancelled' }),
          cancel() {},
        }
      restPending = false
      let resolve!: (result: BehaviorResult) => void
      const finished = new Promise<BehaviorResult>((r) => {
        resolve = r
      })
      const run: Active = { id, name, scope: host.scope(), done: false, resolve }
      active = run
      const checkpoint = () => {
        if (disposed || run.done || active !== run) throw cancelled
      }
      const context: BehaviorContext<S> = {
        id,
        scope: run.scope,
        get active() {
          return !disposed && !run.done && active === run
        },
        checkpoint,
        async wait(work) {
          checkpoint()
          const result = await work
          checkpoint()
          while (isPaused()) {
            await new Promise<void>((resolve) => {
              const previous = run.wake
              run.wake = () => {
                previous?.()
                resolve()
              }
            })
            checkpoint()
          }
          if (result === false) throw cancelled
          return result
        },
        guard(callback) {
          return (...args) => {
            if (context.active) callback(...args)
          }
        },
      }
      const settle = (status: BehaviorStatus, error?: unknown) => {
        if (run.done) return
        changing = true
        try {
          finish(run, status, error)
        } finally {
          changing = false
        }
        restore(name)
      }
      try {
        const work = definition.run(context)
        void Promise.resolve(work).then(
          () => settle('completed'),
          (error) =>
            error === cancelled ? settle('cancelled') : settle('failed', error),
        )
      } catch (error) {
        settle(
          error === cancelled ? 'cancelled' : 'failed',
          error === cancelled ? undefined : error,
        )
      }
      return {
        id,
        name,
        finished,
        cancel() {
          if (active === run) cancel(true)
        },
      }
    },
    cancel() {
      cancel(true)
    },
    pause() {
      if (paused || disposed) return
      paused = true
      active?.scope.suspend()
    },
    play() {
      if (!paused || disposed) return
      paused = false
      if (!background) active?.scope.resume()
      wake()
    },
    stop() {
      cancel(false)
    },
    dispose() {
      if (disposed) return
      disposed = true
      unlisten()
      restPending = false
      // Guards and cleanup may dispose reentrantly. Invalidate the current run too.
      const wasChanging = changing
      changing = true
      try {
        if (active) finish(active, 'cancelled')
      } finally {
        changing = wasChanging
        host.disposed?.()
      }
    },
  }
  const wake = () => {
    if (disposed || isPaused()) return
    active?.wake?.()
    if (active) active.wake = undefined
    if (restPending) {
      restPending = false
      restore()
    }
  }
  unlisten = host.visibility(() => {
    background = host.hidden()
    if (background) active?.scope.suspend()
    else if (!paused) active?.scope.resume()
    wake()
  })
  return controller
}
