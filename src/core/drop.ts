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
export interface DropMoveEvent<T> {
  /** The hovered target after this move's hit test. */
  readonly id: string | undefined
  readonly source: T
  /** The source's current visual bounds, in the same coordinates as the targets. */
  readonly bounds: DropRect
  readonly method: 'drag'
}
export interface DropPadding {
  readonly top?: number
  readonly right?: number
  readonly bottom?: number
  readonly left?: number
}
export type DropEffect = (() => void) | { dispose(): void } | { stop(): void }
export interface DropTarget<T> {
  readonly id: string
  readonly target: T
  /** Larger values win; declaration order resolves ties. */
  readonly priority?: number
  /** Synchronous acceptance, evaluated again at the final release. */
  readonly accept?: (event: DropEvent<T>) => boolean
  /** Extra hit area outside the visual bounds: one value or per edge, 0–1,000. */
  readonly padding?: number | DropPadding
}
export interface DropOptions<T> {
  readonly targets: readonly DropTarget<T>[]
  /** Axis-aligned visual bounds; overlap requires positive intersection area. */
  hitTest?: 'center' | 'overlap'
  /** Every drag move, after hit testing; never after cancellation or disposal. */
  onMove?: (event: DropMoveEvent<T>) => void
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
  /** The source's current drag translation, to tell layout changes from movement. */
  translation?(): { readonly x: number; readonly y: number }
  /** Offset the drag translation so the source stays under the pointer. */
  shift?(x: number, y: number): void
}

export const MAX_DROP_PADDING = 1000

export function dropPadding(padding: number | DropPadding | undefined) {
  const edges =
    padding === undefined || typeof padding === 'number'
      ? {
          top: padding ?? 0,
          right: padding ?? 0,
          bottom: padding ?? 0,
          left: padding ?? 0,
        }
      : padding && typeof padding === 'object' && !Array.isArray(padding)
        ? {
            top: padding.top ?? 0,
            right: padding.right ?? 0,
            bottom: padding.bottom ?? 0,
            left: padding.left ?? 0,
          }
        : undefined
  if (
    !edges ||
    (typeof padding === 'object' &&
      Object.keys(padding).some(
        (key) => !['top', 'right', 'bottom', 'left'].includes(key),
      )) ||
    !Object.values(edges).every(
      (value) =>
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= MAX_DROP_PADDING,
    )
  )
    throw new RangeError(
      `Drop padding must be finite and 0–${MAX_DROP_PADDING} on each top/right/bottom/left edge.`,
    )
  return edges
}

/** Padding extends the target before either policy; an empty target never hits. */
export function dropHits(
  source: DropRect,
  target: DropRect,
  policy: 'center' | 'overlap',
  padding?: number | DropPadding,
) {
  const edges = dropPadding(padding)
  if (
    ![source, target].every(
      (r) => Object.values(r).every(Number.isFinite) && r.width > 0 && r.height > 0,
    )
  )
    return false
  target = {
    x: target.x - edges.left,
    y: target.y - edges.top,
    width: target.width + edges.left + edges.right,
    height: target.height + edges.top + edges.bottom,
  }
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
      const padding = dropPadding(target.padding)
      ids.add(target.id)
      return { ...target, padding }
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  const policy = options.hitTest ?? 'center'
  if (!['center', 'overlap'].includes(policy))
    throw new TypeError('Unknown drop hit-test policy.')
  for (const callback of [
    options.onMove,
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
  let anchor: { x: number; y: number } | undefined
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
      return !!bounds && dropHits(rect, bounds, policy, target.padding)
    })
  }
  // The layout center is the visual center without the drag translation.
  const layout = () => {
    const rect = host.translation && host.bounds(source)
    if (!rect) return undefined
    const offset = host.translation!()
    const point = {
      x: rect.x + rect.width / 2 - offset.x,
      y: rect.y + rect.height / 2 - offset.y,
    }
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : undefined
  }
  const reanchor = () => {
    const next = layout(),
      previous = anchor
    if (!next) return
    anchor = next
    if (!previous) return
    const x = next.x - previous.x,
      y = next.y - previous.y
    if (Math.abs(x) > 0.01 || Math.abs(y) > 0.01) host.shift?.(-x, -y)
  }
  const cancel = () => {
    generation++
    active = false
    anchor = undefined
    try {
      stopEffect()
    } finally {
      hover(undefined)
    }
  }
  const commit = (target: DropTarget<T> | undefined, method: DropEvent<T>['method']) => {
    const epoch = generation
    active = false
    anchor = undefined
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
        else if (active) {
          const epoch = generation
          reanchor()
          if (epoch === generation && active) hover(find())
        }
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
        if (available()) {
          active = true
          anchor = layout()
        }
      }),
    move: () =>
      guard(() => {
        if (!active) return
        const epoch = generation
        handle.refresh()
        if (!active || epoch !== generation || !available() || !options.onMove) return
        const bounds = host.bounds(source)!
        options.onMove({
          id: hovered?.id,
          source,
          bounds: {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          },
          method: 'drag',
        })
      }),
    release: () => guard(() => (active ? commit(find(), 'drag') : false)),
  }
}
