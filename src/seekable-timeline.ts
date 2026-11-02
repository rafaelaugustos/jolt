import { Application, type View } from '@nativescript/core'
import { toView } from './animate.js'
import { timeScale } from './config.js'
import { ViewAnimation, type Plan } from './engine.js'
import {
  asRoot,
  detachBindings,
  isMotionValue,
  type MotionValue,
} from './motion-value.js'
import { defaults, type NumericProperty } from './core/properties.js'
import { type PlaybackAnimation } from './playback.js'
import { TimedAnimation } from './timed-animation.js'
import { createTrack, type Track } from './track.js'
import {
  resolveTransition,
  springs,
  type Transition,
  type SpringName,
} from './transition.js'
import type { Target } from './types.js'

interface Timing {
  /** Absolute milliseconds within the containing scene. Defaults to zero. */
  at?: number
  transition?: Transition | SpringName
  layer?: string
}

export type SeekableStep =
  | (Timing & {
      target: Target
      /** Explicit endpoints; use keyframes for several movements of the same channel. */
      keyframes: Partial<Record<NumericProperty | 'scale', readonly number[]>>
    })
  | (Timing & { value: MotionValue; keyframes: readonly number[] })
  | { at?: number; steps: readonly SeekableStep[] }

/**
 * A finite, precompiled scene. All participants share one control; no child
 * handles or callback effects are accepted. Loaded views and explicit numeric
 * keyframes keep validation and timing independent of future application code.
 */
export function seekableTimeline(
  steps: readonly SeekableStep[],
  options: { paused?: boolean } = {},
): PlaybackAnimation {
  const prepared: { view?: View; value?: MotionValue; layer?: string; track: Track }[] =
    []
  const claimed = new Map<object, Set<string>>()
  const keys = (value: object, allowed: readonly string[]) => {
    if (Object.keys(value).some((key) => !allowed.includes(key)))
      throw new TypeError(
        'A seekable scene accepts only declarative numeric tracks and nested steps.',
      )
  }
  keys(options, ['paused'])
  if (options.paused !== undefined && typeof options.paused !== 'boolean')
    throw new TypeError('paused must be a boolean.')
  const visit = (entries: readonly SeekableStep[], offset: number, depth: number) => {
    if (!Array.isArray(entries) || depth > 16)
      throw new TypeError('Seekable steps must be an array, nested at most 16 levels.')
    for (const entry of entries as readonly SeekableStep[]) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        throw new TypeError(
          'Seekable scenes do not accept callbacks or animation handles.',
        )
      const at = entry.at ?? 0
      if (!Number.isFinite(at) || at < 0)
        throw new RangeError('Scene positions must be finite, nonnegative milliseconds.')
      const start = offset + at
      if ('steps' in entry) {
        keys(entry, ['steps', 'at'])
        visit(entry.steps, start, depth + 1)
        continue
      }
      keys(entry, ['target', 'value', 'keyframes', 'at', 'transition', 'layer'])
      if ('target' in entry === 'value' in entry)
        throw new TypeError(
          'A seekable track needs either a view target or a motion value.',
        )
      const layer = entry.layer
      if (layer !== undefined && (typeof layer !== 'string' || !layer))
        throw new TypeError('A layer needs a nonempty name.')
      if ('value' in entry && (layer !== undefined || !isMotionValue(entry.value)))
        throw new TypeError('Value tracks require a numeric motionValue() base channel.')
      const view = 'target' in entry ? toView(entry.target) : undefined
      if (view && (!view.isLoaded || !view.nativeViewProtected))
        throw new TypeError('Seekable scene views must already be loaded.')
      const value = 'value' in entry ? entry.value : undefined
      const owner = view ?? value!
      let owned = claimed.get(owner)
      if (!owned) claimed.set(owner, (owned = new Set()))
      const transition =
        typeof entry.transition === 'string'
          ? springs[entry.transition]
          : (entry.transition ?? { duration: 300 })
      if (!transition || typeof transition !== 'object')
        throw new TypeError('Invalid seekable transition.')
      keys(transition, [
        'type',
        'duration',
        'ease',
        'times',
        'easeTrack',
        'delay',
        'repeat',
        'repeatType',
        'repeatDelay',
        'stiffness',
        'damping',
        'mass',
        'bounce',
        'velocity',
        'acceleration',
        'restitution',
      ])
      if (Array.isArray(transition.repeatDelay))
        throw new TypeError('Seekable repeat delays must be deterministic numbers.')
      const easing = 'ease' in transition ? transition.ease : undefined
      if (
        typeof easing === 'function' ||
        (Array.isArray(easing) && easing.some((x) => typeof x === 'function'))
      )
        throw new TypeError('Seekable scenes require named or cubic-bezier easings.')
      const repeat = transition.repeat ?? 0
      if (!Number.isInteger(repeat) || repeat < 0 || repeat > 100)
        throw new RangeError('Seekable tracks support zero to 100 repeats.')
      const frames = value
        ? [['opacity', entry.keyframes] as const]
        : Object.entries(entry.keyframes)
      if (!frames.length) throw new TypeError('A seekable track needs keyframes.')
      for (const [name, raw] of frames) {
        if (name !== 'scale' && !Object.hasOwn(defaults, name))
          throw new TypeError('Seekable view tracks support transforms and opacity.')
        if (
          !Array.isArray(raw) ||
          raw.length < 2 ||
          ![...raw].every((x) => typeof x === 'number' && Number.isFinite(x))
        )
          throw new TypeError(
            'Seekable keyframes need at least two explicit finite numbers.',
          )
        for (const property of name === 'scale'
          ? (['scaleX', 'scaleY'] as const)
          : [name as NumericProperty]) {
          const key = `${property}#${layer ?? ''}`
          if (owned.has(key))
            throw new TypeError(
              'Each scene channel has one track; combine its movements into keyframes.',
            )
          owned.add(key)
          const resolved = resolveTransition(transition, property, raw.length)
          resolved.delay += start
          const track = createTrack(property, raw, resolved, 0)
          if (!Number.isFinite(track.end) || track.end > 600000 / timeScale())
            throw new RangeError(
              'Seekable tracks must finish within ten unscaled minutes.',
            )
          prepared.push({ view, value, layer, track })
          if (prepared.length > 256)
            throw new RangeError('A seekable scene supports at most 256 channels.')
        }
      }
    }
  }
  visit(steps, 0, 0)
  const duration = Math.max(0, ...prepared.map(({ track }) => track.end))
  // Compile the full native representation before taking any ownership.
  const tracks = prepared.map((item) => ({
    ...item,
    track: padTrack(item.track, duration),
  }))
  const children: PlaybackAnimation[] = []
  const views = [...new Set(tracks.flatMap(({ view }) => (view ? [view] : [])))]
  let interrupted = false
  let automaticPause = false
  let off = () => {}
  const scene = new TimedAnimation(
    duration,
    duration,
    (time, paused) => {
      for (const child of children) {
        if (paused) child.pause()
        child.progress = duration ? time / duration : 1
        if (!paused) child.play()
      }
    },
    (completed) => {
      for (const child of children) {
        if (completed) {
          child.progress = 1
          child.play()
        } else child.stop()
        if (child instanceof ViewAnimation) child.releaseGroup()
      }
      off()
    },
  )
  const unloaded = () => {
    if (!Application.suspended) scene.stop()
  }
  const pause = scene.pause.bind(scene)
  scene.pause = () => {
    // An explicit pause during suspension cancels the pending automatic resume.
    automaticPause = false
    pause()
  }
  const suspend = () => {
    if (!scene.paused && !scene.done) {
      automaticPause = true
      pause()
    }
  }
  const resume = () => {
    if (automaticPause) {
      automaticPause = false
      scene.play()
    }
  }
  off = () => {
    views.forEach((view) => view.off('unloaded', unloaded))
    Application.off(Application.suspendEvent, suspend)
    Application.off(Application.resumeEvent, resume)
  }
  try {
    const plans = new Map<View, Plan[]>()
    for (const { view, track, layer } of tracks)
      if (view) {
        const list = plans.get(view) ?? []
        plans.set(view, list)
        list.push({
          property: track.property,
          keyframes: track.values,
          transition: resolveTransition({ duration }, track.property, 2),
          track: () => track,
          layer,
        })
      }
    for (const [view, list] of plans) {
      detachBindings(
        view,
        list.filter((plan) => plan.layer === undefined).map((plan) => plan.property),
      )
      children.push(new ViewAnimation(view, list, undefined, true))
    }
    for (const { value, track } of tracks)
      if (value) children.push(asRoot(value).playTrack(track))
    children.forEach((child) => {
      void child.finished.then((ok) => {
        if (!ok) interrupted = true
      })
    })
    views.forEach((view) => view.on('unloaded', unloaded))
    Application.on(Application.suspendEvent, suspend)
    Application.on(Application.resumeEvent, resume)
    if (options.paused) scene.pause()
    scene.progress = 0
    scene.start()
  } catch (error) {
    scene.stop()
    throw error
  }
  const finished = scene.finished.then(async (ok) => {
    const results = await Promise.all(children.map((child) => child.finished))
    return ok && !interrupted && results.every(Boolean)
  })
  // Keep the registered clock on the actual handle; only aggregate the outcome.
  Object.defineProperty(scene, 'finished', { value: finished })
  return scene
}

/** Expand finite repeats and hold both ends for the shared scene interval. */
function padTrack(track: Track, duration: number): Track {
  if (!duration) return track
  const times = [0],
    values = [track.valueAt(0)]
  const add = (time: number, value: number) => {
    const offset = Math.fround(Math.max(0, Math.min(1, time / duration)))
    const last = times.length - 1
    if (offset === times[last]) {
      if (value === values[last]) return
      if (offset === 0) {
        values[last] = value
        return
      }
      // A loop reset is a discontinuity. Give Android distinct float fractions
      // instead of a zero-length interval (FloatKeyframeSet divides by its span).
      const previous = times[last - 1] ?? 0
      times[last] = Math.fround(offset - Math.min(1e-6, (offset - previous) / 2))
      if (times[last]! <= previous) {
        values[last] = value
        times[last] = offset
        return
      }
    }
    times.push(offset)
    values.push(value)
  }
  if (track.delay > 0) add(track.delay, values[0]!)
  for (let iteration = 0; iteration <= track.repeat && track.duration > 0; iteration++) {
    const reversed = track.reverse && iteration % 2 === 1
    for (let k = 0; k < track.times.length; k++) {
      const i = reversed ? track.times.length - 1 - k : k
      add(
        track.delay +
          (iteration + (reversed ? 1 - track.times[i]! : track.times[i]!)) *
            track.duration,
        track.values[i]!,
      )
      if (times.length > 100000)
        throw new RangeError('Seekable scene sample budget exceeded.')
    }
  }
  add(track.end, track.to)
  add(duration, track.to)
  return {
    ...track,
    delay: 0,
    duration,
    end: duration,
    arrival: duration,
    times,
    values,
    repeat: 0,
    reverse: false,
    valueAt: (time) => (time >= track.end ? track.to : track.valueAt(time)),
    velocityAt: (time) => (time >= track.end ? 0 : track.velocityAt(time)),
  }
}
