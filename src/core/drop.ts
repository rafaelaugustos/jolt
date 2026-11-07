export interface DropRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}
export interface DropEvent<T> {
  readonly id: string
  readonly source: T
  readonly target: T
  readonly method: 'drag' | 'request'
}
export type DropEffect = (() => void) | { dispose(): void } | { stop(): void }
export interface DropTarget<T> {
  readonly id: string
  readonly target: T
  /** Larger values win; declaration order resolves ties. */
  readonly priority?: number
  /** Synchronous acceptance, evaluated again at the final release. */
  readonly accept?: (event: DropEvent<T>) => boolean
}
export interface DropOptions<T> {
  readonly targets: readonly DropTarget<T>[]
  /** Axis-aligned visual bounds; overlap requires positive intersection area. */
  hitTest?: 'center' | 'overlap'
  onEnter?: (event: DropEvent<T>) => void
  onLeave?: (event: DropEvent<T>) => void
  onDrop?: (event: DropEvent<T>) => DropEffect | void
  onReject?: (event: DropEvent<T> | undefined) => void
}
export interface DropZones {
  readonly hovered: string | undefined
  readonly accepted: string | undefined
  readonly dragging: boolean
  readonly paused: boolean
  readonly disposed: boolean
  /** Accessible button/keyboard alternative. No geometric hit is required. */
  request(id: string): boolean
  /** Recheck geometry/availability after an application layout change. */
  refresh(): void
  cancel(): void
  pause(): void
  play(): void
  dispose(): void
}
export interface DropHost<T> {
  bounds(target: T): DropRect | undefined
  enabled(): boolean
  cancelDrag(): void
  error?(error: unknown): void
}

export function dropHits(
  source: DropRect,
  target: DropRect,
  policy: 'center' | 'overlap',
) {
  if (
    ![source, target].every(
      (r) => Object.values(r).every(Number.isFinite) && r.width > 0 && r.height > 0,
    )
  )
    return false
  if (policy === 'overlap')
    return (
      Math.min(source.x + source.width, target.x + target.width) >
        Math.max(source.x, target.x) &&
      Math.min(source.y + source.height, target.y + target.height) >
        Math.max(source.y, target.y)
    )
  const x = source.x + source.width / 2,
    y = source.y + source.height / 2
  return (
    x >= target.x &&
    x <= target.x + target.width &&
    y >= target.y &&
    y <= target.y + target.height
  )
}

/** Shared selection/ownership policy; input and geometry belong to each adapter. */
export function createDropPolicy<T>(
  source: T,
  options: DropOptions<T>,
  host: DropHost<T>,
) {
  if (
    !options ||
    !Array.isArray(options.targets) ||
    !options.targets.length ||
    options.targets.length > 64
  )
    throw new RangeError('Drop zones need 1–64 targets.')
  const ids = new Set<string>()
  const targets = options.targets
    .map((target) => {
      if (
        !target ||
        typeof target.id !== 'string' ||
        !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(target.id) ||
        ids.has(target.id) ||
        !target.target ||
        target.target === source
      )
        throw new TypeError(
          'Drop targets need unique stable IDs and a target distinct from the source.',
        )
      if (target.priority !== undefined && !Number.isFinite(target.priority))
        throw new TypeError('Drop priority must be finite.')
      if (target.accept !== undefined && typeof target.accept !== 'function')
        throw new TypeError('Drop acceptance must be a synchronous function.')
      ids.add(target.id)
      return { ...target }
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  const policy = options.hitTest ?? 'center'
  if (!['center', 'overlap'].includes(policy))
    throw new TypeError('Unknown drop hit-test policy.')
  for (const callback of [
    options.onEnter,
    options.onLeave,
    options.onDrop,
    options.onReject,
  ])
    if (callback !== undefined && typeof callback !== 'function')
      throw new TypeError('Drop callbacks must be functions.')
  let active = false,
    paused = false,
    disposed = false,
    generation = 0
  let hovered: DropTarget<T> | undefined, accepted: DropTarget<T> | undefined
  let effect: DropEffect | undefined
  const available = () => !disposed && !paused && host.enabled() && !!host.bounds(source)
  const event = (
    target: DropTarget<T>,
    method: DropEvent<T>['method'] = 'drag',
  ): DropEvent<T> => ({ id: target.id, source, target: target.target, method })
  const destroy = (value: DropEffect) => {
    if (typeof value === 'function') value()
    else if ('dispose' in value) value.dispose()
    else value.stop()
  }
  const stopEffect = () => {
    const previous = effect
    effect = undefined
    accepted = undefined
    if (previous) destroy(previous)
  }
  const hover = (next: DropTarget<T> | undefined) => {
    if (next === hovered) return
    const previous = hovered,
      epoch = generation
    hovered = next
    if (previous) options.onLeave?.(event(previous))
    if (epoch === generation && next && hovered === next && available())
      options.onEnter?.(event(next))
  }
  const find = () => {
    if (!available()) return undefined
    const rect = host.bounds(source)!
    return targets.find((target) => {
      const bounds = host.bounds(target.target)
      return !!bounds && dropHits(rect, bounds, policy)
    })
  }
  const cancel = () => {
    generation++
    active = false
    try {
      stopEffect()
    } finally {
      hover(undefined)
    }
  }
  const commit = (target: DropTarget<T> | undefined, method: DropEvent<T>['method']) => {
    const epoch = generation
    active = false
    hover(undefined)
    if (epoch !== generation || !available()) return false
    if (!target || !host.bounds(target.target)) {
      options.onReject?.(undefined)
      return false
    }
    const detail = event(target, method),
      allowed = target.accept?.(detail) ?? true
    if (typeof allowed !== 'boolean')
      throw new TypeError('Drop acceptance must return a boolean, not a promise.')
    if (epoch !== generation || !available() || !host.bounds(target.target)) return false
    if (!allowed) {
      options.onReject?.(detail)
      return false
    }
    // Detach the return animation before application effects claim the channels.
    host.cancelDrag()
    if (epoch !== generation || !available()) return false
    accepted = target
    const resource = options.onDrop?.(detail)
    if (resource) {
      if (
        typeof resource !== 'function' &&
        (typeof resource !== 'object' ||
          (typeof (resource as { dispose?: unknown }).dispose !== 'function' &&
            typeof (resource as { stop?: unknown }).stop !== 'function'))
      )
        throw new TypeError('A drop effect must return an owned stop/dispose resource.')
      if (epoch !== generation || !available()) destroy(resource)
      else {
        effect = resource
        const finished = (resource as { finished?: Promise<unknown> }).finished
        const release = () => {
          if (effect !== resource) return
          effect = undefined
          try {
            destroy(resource)
          } catch (error) {
            host.error?.(error)
          }
        }
        if (finished && typeof finished.then === 'function')
          void finished.then(release, release).catch((error) => {
            try {
              host.error?.(error)
            } catch {
              /* An async cleanup cannot reject its completed effect. */
            }
          })
      }
    }
    return epoch === generation && available()
  }
  const guard = <R>(action: () => R): R => {
    try {
      return action()
    } catch (error) {
      try {
        cancel()
      } finally {
        host.cancelDrag()
      }
      throw error
    }
  }
  const handle: DropZones = {
    get hovered() {
      return hovered?.id
    },
    get accepted() {
      return accepted?.id
    },
    get dragging() {
      return active
    },
    get paused() {
      return paused
    },
    get disposed() {
      return disposed
    },
    request(id) {
      if (!ids.has(id)) throw new TypeError('Unknown drop target ID.')
      if (!available()) return false
      return guard(() => {
        cancel()
        host.cancelDrag()
        return commit(
          targets.find((target) => target.id === id),
          'request',
        )
      })
    },
    refresh() {
      guard(() => {
        if (!available() || (accepted && !host.bounds(accepted.target))) cancel()
        else if (active) hover(find())
      })
    },
    cancel,
    pause() {
      if (!disposed && !paused) {
        paused = true
        cancel()
      }
    },
    play() {
      if (!disposed) paused = false
    },
    dispose() {
      if (disposed) return
      disposed = true
      try {
        cancel()
      } finally {
        targets.length = 0
      }
    },
  }
  return {
    handle,
    begin: () =>
      guard(() => {
        cancel()
        if (available()) active = true
      }),
    move: () =>
      guard(() => {
        if (active) handle.refresh()
      }),
    release: () => guard(() => (active ? commit(find(), 'drag') : false)),
  }
}
