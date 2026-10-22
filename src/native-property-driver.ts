import { isAndroid } from '@nativescript/core'
import type { Track } from './track.js'

/** Opaque compiled JoltPropertySink / PropertySink instance. */
export type NativeSink = object
export interface NativePlayer {
  control(time: number, paused: boolean): void
  cancel(): void
}
export interface NativePropertyDriver {
  validate(sink: NativeSink, dimensions: number): void
  alive(sink: NativeSink): boolean
  read(sink: NativeSink): number[]
  write(sink: NativeSink, values: readonly number[]): void
  dispose(sink: NativeSink): void
  play(
    sink: NativeSink,
    track: Track,
    samples: readonly (readonly number[])[],
    final: readonly number[],
    end: (completed: boolean) => void,
  ): NativePlayer
}
let override: NativePropertyDriver | undefined
/** Test injection; not part of the public package entry. */
export function setNativePropertyDriver(driver: NativePropertyDriver | undefined) {
  override = driver
}
export function nativePropertyDriver(): NativePropertyDriver {
  if (override) return override
  const available = isAndroid
    ? typeof org !== 'undefined' &&
      typeof org.rafaelaugusto.jolt.PropertySink?.scalar === 'function'
    : typeof JoltPropertySink !== 'undefined'
  if (!available)
    throw new Error(
      'Native property adapters require the optional @rafaelaugusto/jolt-native plugin. Install it and rebuild the native app.',
    )
  return isAndroid ? androidDriver : iosDriver
}

function array(values: readonly number[]) {
  const result = Array.create('double', values.length)
  values.forEach((value, i) => {
    result[i] = value
  })
  return result
}
const androidDriver: NativePropertyDriver = {
  validate(sink, dimensions) {
    if (
      !(sink instanceof org.rafaelaugusto.jolt.PropertySink) ||
      sink.getDimensions() !== dimensions ||
      !sink.isCompiled()
    )
      throw new TypeError(
        'Native adapters require a compiled PropertySink with matching dimensions, not a JavaScript setter.',
      )
  },
  alive: (sink) => (sink as org.rafaelaugusto.jolt.PropertySink).isAlive(),
  read(sink) {
    const values = (sink as org.rafaelaugusto.jolt.PropertySink).read()
    return Array.from({ length: values.length }, (_, i) => values[i]!)
  },
  write: (sink, values) =>
    (sink as org.rafaelaugusto.jolt.PropertySink).write(array(values)),
  dispose: (sink) => (sink as org.rafaelaugusto.jolt.PropertySink).dispose(),
  play(sink, track, samples, final, end) {
    const player = new org.rafaelaugusto.jolt.PropertyPlayer(
      sink as org.rafaelaugusto.jolt.PropertySink,
      array(track.times),
      array(samples.flat()),
      array(final),
      track.duration,
      track.delay,
      Number.isFinite(track.repeat) ? track.repeat : -1,
      track.reverse,
      new org.rafaelaugusto.jolt.PropertyPlayer.Listener({ onEnd: end }),
    )
    return {
      control: (time, paused) => player.control(time, paused),
      cancel: () => player.cancel(),
    }
  },
}
const iosDriver: NativePropertyDriver = {
  validate(sink, dimensions) {
    if (
      !(sink instanceof JoltPropertySink) ||
      sink.dimensions !== dimensions ||
      !sink.compiled
    )
      throw new TypeError(
        'Native adapters require a compiled JoltPropertySink with matching dimensions, not a JavaScript setter.',
      )
  },
  alive: (sink) => (sink as JoltPropertySink).alive,
  read(sink) {
    const values = (sink as JoltPropertySink).read()
    return Array.from({ length: values.count }, (_, i) => values.objectAtIndex(i))
  },
  write: (sink, values) =>
    (sink as JoltPropertySink).write(NSArray.arrayWithArray([...values])),
  dispose: (sink) => (sink as JoltPropertySink).dispose(),
  play(sink, track, samples, final, end) {
    const player =
      JoltPropertyPlayer.startSinkTimesValuesFinalValueDurationDelayRepeatReverseCompletion(
        sink as JoltPropertySink,
        NSArray.arrayWithArray([...track.times]),
        NSArray.arrayWithArray(samples.flat()),
        NSArray.arrayWithArray([...final]),
        track.duration,
        track.delay,
        track.repeat,
        track.reverse,
        end,
      )
    return {
      control: (time, paused) => player.controlPaused(time, paused),
      cancel: () => player.cancel(),
    }
  },
}
