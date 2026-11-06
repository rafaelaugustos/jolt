import { playbackSource, type Animation } from './playback.js'

/** Receives demand only. The application combines this with its own renderer policy. */
export interface RenderActivityAdapter {
  change(active: boolean): void
  /** Draw a final/seeked frame even when continuous rendering has just stopped. */
  redraw(): void
}
export interface RenderActivity {
  readonly active: boolean
  readonly disposed: boolean
  readonly suspended: boolean
  readonly size: number
  /** Borrow playback; removing this observation does not stop the animation. */
  track(animation: Animation): () => void
  /** Explicit ongoing work, including application simulation or continuous input. */
  hold(): () => void
  /** Independent owner sharing the same renderer, bounded by this parent's lifetime. */
  scope(): RenderActivity
  suspend(): void
  resume(): void
  dispose(): void
}
export interface ActivityHost {
  hidden(): boolean
  visibility(change: () => void): () => void
  error(error: unknown): void
  disposed?(): void
}
interface Entry {
  running(): boolean
  off(): void
  animation?: Animation
  release(): void
}
interface Owner {
  parent?: Owner
  entries: Set<Entry>
  children: Set<Owner>
  paused: boolean
  disposed: boolean
}
const adapters = new WeakSet<object>()

/** Shared native/browser ownership; no timers or frame sampling. Delays reserve demand. */
export function createRenderActivity(
  adapter: RenderActivityAdapter,
  host: ActivityHost,
): RenderActivity {
  if (
    !adapter ||
    typeof adapter.change !== 'function' ||
    typeof adapter.redraw !== 'function'
  )
    throw new TypeError('Rendering activity needs change(active) and redraw().')
  if (adapters.has(adapter))
    throw new Error('This renderer already has an activity owner; use activity.scope().')
  const owners = new Set<Owner>()
  const clearEntry = (entry: Entry) => {
    entry.off()
    entry.off = () => {}
    entry.running = () => false
    entry.animation = undefined
  }
  const releaseHost = () => {
    if (!ended) return
    host = { hidden: () => false, visibility: () => () => {}, error: () => {} }
    adapter = { change: () => {}, redraw: () => {} }
    unwatch = () => {}
  }
  let active = false,
    ended = false,
    notifying = false,
    dirty = false,
    redraw = false
  let count = 0
  let unwatch = () => {}
  const blocked = (owner: Owner): boolean =>
    owner.disposed || owner.paused || !!(owner.parent && blocked(owner.parent))
  const demand = (owner: Owner): boolean =>
    !blocked(owner) &&
    ([...owner.entries].some((entry) => entry.running()) ||
      [...owner.children].some(demand))
  const invoke = (callback: () => void) => {
    try {
      callback()
    } catch (error) {
      host.error(error)
    }
  }
  const refresh = (frame = false) => {
    dirty = true
    redraw ||= frame
    if (notifying) return
    notifying = true
    try {
      let iterations = 0
      while (dirty) {
        dirty = false
        const draw = redraw
        redraw = false
        const next =
          !ended &&
          !host.hidden() &&
          [...owners].some(
            (owner) =>
              !blocked(owner) && [...owner.entries].some((entry) => entry.running()),
          )
        if (next !== active) {
          active = next
          invoke(() => adapter.change(next))
        }
        if (draw && !host.hidden()) invoke(() => adapter.redraw())
        if (++iterations > 100) {
          dirty = false
          redraw = false
          host.error(new Error('Reentrant renderer activity did not settle.'))
        }
      }
    } finally {
      notifying = false
      releaseHost()
    }
  }
  const make = (parent?: Owner): RenderActivity => {
    const owner: Owner = {
      parent,
      entries: new Set(),
      children: new Set(),
      paused: false,
      disposed: false,
    }
    owners.add(owner)
    parent?.children.add(owner)
    const alive = () => {
      if (ended || owner.disposed) throw new Error('Render activity owner is disposed.')
    }
    const add = (running: () => boolean, animation?: Animation) => {
      alive()
      if (count >= 4096)
        throw new RangeError('Rendering activity is limited to 4096 observations/tokens.')
      const entry: Entry = {
        running,
        animation,
        off: () => {},
        release: () => {
          if (!owner.entries.delete(entry)) return
          count--
          clearEntry(entry)
          refresh(true)
        },
      }
      owner.entries.add(entry)
      count++
      return entry
    }
    const destroy = (target: Owner) => {
      if (target.disposed) return
      target.disposed = true
      for (const child of [...target.children]) destroy(child)
      for (const entry of [...target.entries]) {
        target.entries.delete(entry)
        count--
        clearEntry(entry)
      }
      target.parent?.children.delete(target)
      owners.delete(target)
    }
    return {
      get active() {
        return !ended && !host.hidden() && demand(owner)
      },
      get disposed() {
        return owner.disposed
      },
      get suspended() {
        return host.hidden() || blocked(owner)
      },
      get size() {
        return owner.entries.size
      },
      track(animation) {
        alive()
        const previous = [...owner.entries].find((entry) => entry.animation === animation)
        if (previous) return previous.release
        const source = playbackSource(animation) // Reject unknown clocks before changing activity.
        const state = source.read()
        if (state.settled) return () => {}
        const entry = add(() => {
          const state = source.read()
          return state.ready && !state.paused && !state.settled
        }, animation)
        const change = () => {
          if (source.read().settled) entry.release()
          else refresh(true)
        }
        const unsubscribe = source.subscribe(change)
        let settle: (() => void) | undefined = entry.release
        entry.off = () => {
          unsubscribe()
          settle = undefined
        }
        // Some clocks notify settlement through a promise only.
        void animation.finished.then(
          () => settle?.(),
          () => settle?.(),
        )
        refresh(true)
        return entry.release
      },
      hold() {
        const entry = add(() => true)
        refresh(true)
        return entry.release
      },
      scope() {
        alive()
        return make(owner)
      },
      suspend() {
        if (owner.disposed || owner.paused) return
        owner.paused = true
        refresh(true)
      },
      resume() {
        if (owner.disposed || !owner.paused) return
        owner.paused = false
        refresh(true)
      },
      dispose() {
        if (owner.disposed) return
        destroy(owner)
        if (!parent) {
          ended = true
          unwatch()
          adapters.delete(adapter)
        }
        if (!parent) host.disposed?.()
        refresh(true)
      },
    }
  }
  adapters.add(adapter)
  const root = make()
  try {
    unwatch = host.visibility(() => refresh(true))
  } catch (error) {
    root.dispose()
    throw error
  }
  return root
}
