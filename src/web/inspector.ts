import { createAdapterInspector } from '../core/adapter-inspection.js'
import { playbackSource, type PlaybackAnimation } from '../core/playback.js'
import { inspectorSpring, type InspectorSpring } from '../core/inspector-spring.js'
import type { WebRuntime, WebDiagnostics } from './public.js'
export { inspectorSpring } from '../core/inspector-spring.js'
export type { InspectorSpring } from '../core/inspector-spring.js'
export type {
  AdapterInspector,
  AdapterInspectionSnapshot,
} from '../core/adapter-inspection.js'

export function springCode(options: {
  target?: string
  to: number
  spring: InspectorSpring
}) {
  const target = options.target ?? 'card'
  if (!/^[A-Za-z_$][\w$]*$/.test(target) || !Number.isFinite(options.to))
    throw new TypeError('Use a target identifier and finite translation.')
  return `runtime.animate(${target}, { x: ${options.to} }, ${JSON.stringify({ ...inspectorSpring(options.spring), velocity: 0 }, null, 2)})\n`
}

/** Opt-in pull-only tools. The application keeps ownership of watched targets and animations. */
export function createMotionInspector(
  document: Document,
  runtime: WebRuntime,
  options: {
    development: true
    capacity?: number
    /** Borrow an existing diagnostic collector, leaving its disposal to the caller. */
    diagnostics?: WebDiagnostics
  },
) {
  if (options.development !== true)
    throw new TypeError('Motion inspection requires development: true.')
  const adapters = createAdapterInspector({
    development: true,
    capacity: options.capacity,
    now: () => document.defaultView!.performance.now(),
  })
  const diagnostics =
    options.diagnostics ??
    runtime.diagnostics({ development: true, maxEvents: options.capacity })
  const surfaces = new Map<string, WeakRef<HTMLElement>>()
  const animations = new Map<string, WeakRef<PlaybackAnimation>>()
  let disposed = false
  const validID = (id: string) => {
    if (disposed) throw new Error('Web inspector is disposed.')
    if (!/^[A-Za-z][\w.-]{0,63}$/.test(id) || surfaces.has(id) || animations.has(id))
      throw new TypeError('Use a unique non-personal ASCII inspector ID.')
    if (surfaces.size + animations.size >= 128)
      throw new RangeError('Inspect at most 128 explicit resources.')
  }
  return {
    adapters,
    watch(target: HTMLElement, id: string) {
      validID(id)
      if (!target?.isConnected || target.ownerDocument !== document)
        throw new TypeError('Watch a mounted surface in this runtime document.')
      surfaces.set(id, new WeakRef(target))
      return () => {
        surfaces.delete(id)
      }
    },
    track(animation: PlaybackAnimation, id: string) {
      validID(id)
      playbackSource(animation)
      animations.set(id, new WeakRef(animation))
      return () => {
        animations.delete(id)
      }
    },
    control(id: string, command: 'pause' | 'play' | 'seek' | 'stop', progress?: number) {
      if (disposed) throw new Error('Web inspector is disposed.')
      const animation = animations.get(id)?.deref()
      if (!animation)
        throw new TypeError('Track an application-owned playback before editing it.')
      if (command === 'seek') {
        if (!Number.isFinite(progress) || progress! < 0 || progress! > 1)
          throw new RangeError('Seek progress is 0–1.')
        animation.progress = progress!
      } else if (command === 'pause' || command === 'play' || command === 'stop')
        animation[command]()
      else throw new TypeError('Unsupported inspector command.')
    },
    /** Only the application callback can replace its animation. No hidden preview owner. */
    tune(
      spring: InspectorSpring,
      apply: (settings: ReturnType<typeof inspectorSpring>) => void,
    ) {
      if (disposed) throw new Error('Web inspector is disposed.')
      const settings = inspectorSpring(spring)
      apply({ ...settings })
      return settings
    },
    read() {
      const targets: {
        id: string
        target: number
        transform: string
        opacity: number
      }[] = []
      for (const [id, ref] of surfaces) {
        const target = ref.deref()
        if (!target?.isConnected || target.ownerDocument !== document) {
          surfaces.delete(id)
          continue
        }
        const style = document.defaultView!.getComputedStyle(target)
        targets.push({
          id,
          target: diagnostics.identify(target),
          transform: style.transform,
          opacity: Number(style.opacity),
        })
      }
      const playback: {
        id: string
        owner: number
        time: number
        duration: number
        paused: boolean
        completed: boolean
      }[] = []
      for (const [id, ref] of animations) {
        const animation = ref.deref()
        if (!animation) {
          animations.delete(id)
          continue
        }
        const state = playbackSource(animation).read()
        if (state.settled) {
          animations.delete(id)
          continue
        }
        playback.push({
          id,
          owner: diagnostics.identify(animation),
          time: state.time,
          duration: state.duration,
          paused: state.paused,
          completed: state.completed,
        })
      }
      return {
        version: 1 as const,
        targets,
        playback,
        diagnostics: diagnostics.snapshot(),
        adapters: adapters.read(),
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      surfaces.clear()
      animations.clear()
      adapters.dispose()
      if (!options.diagnostics) diagnostics.dispose()
    },
  }
}
export type WebMotionInspector = ReturnType<typeof createMotionInspector>
