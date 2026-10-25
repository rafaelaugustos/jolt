import { isAndroid, Trace, type View } from '@nativescript/core'
import { nativeBackSessions } from './presentation.js'
import { onReducedMotion, reducedMotion, timeScale } from '../config.js'
import { springPhysics } from '../spring.js'
import { springs, type Spring } from '../transition.js'

export type PredictiveBackValues = Partial<
  Record<
    'x' | 'y' | 'scale' | 'scaleX' | 'scaleY' | 'opacity' | 'rotate',
    readonly [number, number]
  >
>
export type PredictiveBackState =
  'idle' | 'tracking' | 'cancelling' | 'finishing' | 'committing' | 'disposed'
export interface PredictiveBackEvent {
  state: PredictiveBackState
  edge?: 'left' | 'right'
  /** Release sample only; updates during the gesture stay native. Velocity is progress/second. */
  release?: Readonly<{ progress: number; velocity: number }>
  outcome?: 'completed' | 'cancelled'
  reason?: 'rejected' | 'error' | 'timeout'
}
export interface PredictiveBackOptions {
  /** Close the owned surface or navigate once. Return false to spring back after a guard rejects. */
  commit: (options: { animated: false }) => boolean | void | Promise<boolean | void>
  spring?:
    | keyof typeof springs
    | Pick<Spring, 'duration' | 'bounce' | 'stiffness' | 'damping' | 'mass'>
  enabled?: boolean
  /** Mirror x and rotate when starting at the right edge. Default true. */
  mirrorX?: boolean
  /** Maximum wait for commit, 1–10000 ms. Default 5000. Does not cancel the caller's promise. */
  commitTimeout?: number
  /** Lifecycle only; no per-frame JavaScript notifications. */
  onState?: (event: PredictiveBackEvent) => void
}
export interface PredictiveBack {
  /** Android 14+, attached view-tree dispatcher owner and the native plugin are required. */
  readonly supported: boolean
  readonly state: PredictiveBackState
  /** Read on demand, never pushed through JavaScript on each frame. */
  readonly progress: number
  enabled: boolean
  /** Accessible button/keyboard equivalent. Unsupported platforms call commit without motion. */
  back(): void
  /** Rolls back a held gesture. An OS release already committed continues. */
  cancel(): void
  dispose(): void
}
const owners = new WeakMap<View, PredictiveBack>()

/** Animate a dedicated surface with Android's system back gesture. Create after the view is attached. */
export function predictiveBack(
  view: View,
  values: PredictiveBackValues,
  options: PredictiveBackOptions,
): PredictiveBack {
  if (!options || typeof options.commit !== 'function')
    throw new TypeError('predictiveBack requires a commit callback.')
  if (!values || typeof values !== 'object' || !Object.keys(values).length)
    throw new TypeError('predictiveBack requires at least one transform or opacity pair.')
  const parsed: PredictiveBackValues = {}
  for (const [key, pair] of Object.entries(values)) {
    if (!['x', 'y', 'scale', 'scaleX', 'scaleY', 'opacity', 'rotate'].includes(key))
      throw new TypeError(`Unsupported predictive back property: ${key}.`)
    const neutral = key.startsWith('scale') || key === 'opacity' ? 1 : 0
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      pair.some((v) => typeof v !== 'number' || !Number.isFinite(v)) ||
      pair[0] !== neutral
    )
      throw new RangeError(`${key} requires two finite values starting at ${neutral}.`)
    if (
      (key.startsWith('scale') && pair[1]! <= 0) ||
      (key === 'opacity' && (pair[1]! < 0 || pair[1]! > 1))
    )
      throw new RangeError(`Invalid ${key} endpoint.`)
    parsed[key as keyof PredictiveBackValues] = [pair[0]!, pair[1]!]
  }
  if (parsed.scale && (parsed.scaleX || parsed.scaleY))
    throw new TypeError('Use scale or scaleX/scaleY, not both.')
  for (const key of ['enabled', 'mirrorX'] as const)
    if (options[key] !== undefined && typeof options[key] !== 'boolean')
      throw new TypeError(`${key} must be boolean.`)
  const timeout = options.commitTimeout ?? 5000
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 10000)
    throw new RangeError('commitTimeout must be between 1 and 10000 ms.')
  const input =
    typeof options.spring === 'string'
      ? Object.hasOwn(springs, options.spring)
        ? springs[options.spring]
        : undefined
      : options.spring
  if (options.spring !== undefined && !input)
    throw new TypeError('Unknown predictive back spring.')
  if (input !== undefined && (typeof input !== 'object' || Array.isArray(input)))
    throw new TypeError('spring must be a named spring or a physics object.')
  for (const [key, value] of Object.entries(input ?? {}) as [string, unknown][]) {
    if (!['type', 'duration', 'bounce', 'stiffness', 'damping', 'mass'].includes(key))
      throw new TypeError(`Unsupported spring option: ${key}.`)
    if (key === 'type') {
      if (value !== 'spring') throw new TypeError('A spring is required.')
      continue
    }
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new RangeError(`${key} must be finite.`)
    if (['duration', 'stiffness', 'mass'].includes(key) && value <= 0)
      throw new RangeError(`${key} must be positive.`)
    if (key === 'damping' && value < 0)
      throw new RangeError('damping must be nonnegative.')
  }
  const physics = springPhysics(input ?? springs.smooth)
  if (Object.values(physics).some((v) => !Number.isFinite(v)))
    throw new RangeError('Spring physics must be finite.')
  if (owners.has(view))
    throw new Error(
      'This view already has a predictive back owner. Dispose it before rebinding.',
    )
  let native: org.rafaelaugusto.jolt.PredictiveBackSession | undefined
  let supported = false,
    enabled = options.enabled ?? true
  let state: PredictiveBackState = 'idle',
    edge: PredictiveBackEvent['edge']
  let reason: PredictiveBackEvent['reason']
  let generation = 0,
    timer: ReturnType<typeof setTimeout> | undefined
  let offMotion: (() => void) | undefined
  const emit = (next: PredictiveBackState, extra: Partial<PredictiveBackEvent> = {}) => {
    state = next
    try {
      options.onState?.({ state, ...(edge ? { edge } : {}), ...extra })
    } catch (error) {
      Trace.write(
        `Predictive back observer failed: ${String(error)}`,
        'Jolt',
        Trace.messageType.error,
      )
    }
  }
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const finishCommit = (
    token: number,
    accepted: boolean,
    why?: PredictiveBackEvent['reason'],
  ) => {
    if (token !== generation || state !== 'committing') return
    generation++
    clear()
    reason = why
    if (native) native.completeCommit(accepted)
    else {
      emit('idle', {
        outcome: accepted ? 'completed' : 'cancelled',
        ...(why ? { reason: why } : {}),
      })
      if (accepted) control.dispose()
    }
  }
  const commit = () => {
    const token = ++generation
    emit('committing')
    if (state !== 'committing') return
    timer = setTimeout(() => finishCommit(token, false, 'timeout'), timeout)
    try {
      Promise.resolve(options.commit({ animated: false })).then(
        (result) =>
          finishCommit(
            token,
            result !== false,
            result === false ? 'rejected' : undefined,
          ),
        () => finishCommit(token, false, 'error'),
      )
    } catch {
      finishCommit(token, false, 'error')
    }
  }
  const cleanup = () => {
    if (state === 'disposed') return
    generation++
    clear()
    offMotion?.()
    offMotion = undefined
    view.off('unloaded', unload)
    if (owners.get(view) === control) owners.delete(view)
    native = undefined
    nativeBackSessions.delete(control)
    emit('disposed')
  }
  const unload = () => {
    if (state !== 'committing') control.dispose()
  }
  const control: PredictiveBack = {
    get supported() {
      return supported
    },
    get state() {
      return state
    },
    get progress() {
      return native?.getProgress() ?? 0
    },
    get enabled() {
      return enabled
    },
    set enabled(value) {
      if (typeof value !== 'boolean') throw new TypeError('enabled must be boolean.')
      if (state === 'disposed') return
      enabled = value
      native?.setInputEnabled(value)
    },
    back() {
      if (
        !enabled ||
        state === 'disposed' ||
        state === 'committing' ||
        state === 'finishing'
      )
        return
      if (native) native.handleOnBackPressed()
      else commit()
    },
    cancel() {
      native?.cancel()
    },
    dispose() {
      native?.dispose()
      cleanup()
    },
  }
  if (
    isAndroid &&
    typeof org !== 'undefined' &&
    org.rafaelaugusto?.jolt?.PredictiveBackSession
  ) {
    const Native = org.rafaelaugusto.jolt.PredictiveBackSession
    native =
      Native.attach(
        view.nativeViewProtected,
        JSON.stringify({
          values: parsed,
          ...physics,
          mirrorX: options.mirrorX ?? true,
          enabled,
          reduced: reducedMotion(),
          timeScale: timeScale(),
        }),
        new Native.Listener({
          onState(code, progress, velocity, side) {
            if (state === 'disposed') return
            edge = side === 0 ? 'left' : side === 1 ? 'right' : undefined
            if (code === 1) {
              reason = undefined
              emit('tracking')
            } else if (code === 2 || code === 3)
              emit(code === 2 ? 'cancelling' : 'finishing', {
                release: { progress, velocity },
              })
            else if (code === 4) commit()
            else if (code === 5) {
              emit('idle', { outcome: 'cancelled', ...(reason ? { reason } : {}) })
              reason = undefined
            } else if (code === 6) emit('idle', { outcome: 'completed' })
            else if (code === 7) cleanup()
          },
        }),
      ) ?? undefined
    supported = !!native
    if (native) nativeBackSessions.set(control, native)
  }
  owners.set(view, control)
  view.on('unloaded', unload)
  if (native)
    offMotion = onReducedMotion((reduced) => native?.setMotion(reduced, timeScale()))
  return control
}
