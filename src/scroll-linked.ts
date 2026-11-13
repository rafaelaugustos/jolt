import {
  scrollValue,
  bind,
  liveValueInput,
  type Bindings,
  type DerivedValue,
  type ScrollValueOptions,
} from './motion-value.js'
import { nativeScrollAvailable } from './scroll-source.js'
import { readValue } from './properties.js'
import { isColorProperty } from './color.js'
import { isLivePaint } from './live-paint.js'
import { onReducedMotion, reducedMotion } from './config.js'
import {
  Color,
  ScrollView,
  type EventData,
  type ScrollEventData,
} from '@nativescript/core'
import { animate, toView, expandKeyframes } from './animate.js'
import type { Keyframes, Target } from './types.js'

export interface ScrollLinkedOptions extends ScrollValueOptions {
  /** Scroll offsets in DIPs, mapped to progress 0 and 1. Either order is allowed. */
  range: readonly [number, number]
  /** Offset to read. Defaults to the vertical axis. */
  axis?: 'x' | 'y'
}

/** Builds one paused animation and scrubs it synchronously on scroll. */
export function scrollLinked(
  scrollView: Target,
  target: Target,
  keyframes: Keyframes,
  options: ScrollLinkedOptions,
): () => void {
  const source = toView(scrollView)
  const view = toView(target)
  const range = options?.range
  if (
    !Array.isArray(range) ||
    range.length !== 2 ||
    !range.every(Number.isFinite) ||
    !Number.isFinite(range[1]! - range[0]!) ||
    range[0] === range[1]
  )
    throw new RangeError('Scroll range requires two distinct finite offsets in DIPs.')
  const [start, end] = range as [number, number]
  const axis = options.axis ?? 'y'
  if (axis !== 'x' && axis !== 'y') throw new TypeError('Scroll axis must be "x" or "y".')

  const frames = expandKeyframes(keyframes)
  const eligible =
    !('path' in keyframes) &&
    frames.every(
      ([property]) =>
        [
          'x',
          'y',
          'scaleX',
          'scaleY',
          'rotate',
          'rotateX',
          'rotateY',
          'opacity',
        ].includes(property) || isLivePaint(property),
    )
  if (options.execution !== 'javascript' && nativeScrollAvailable() && eligible) {
    const offset = scrollValue(source, {
      axis,
      execution: 'native',
      rowHeight: options.rowHeight,
    })
    let stop: (() => void) | undefined,
      stopDemand: (() => void) | undefined,
      stopReduced: (() => void) | undefined
    let ended = false,
      installing = false,
      demanded = false
    let derived: DerivedValue[] = []
    const cleanup = () => {
      if (ended) return
      ended = true
      stopDemand?.()
      stopReduced?.()
      stop?.()
      for (const value of derived) value.dispose()
      derived = []
      offset.dispose()
      source.off('unloaded', cleanup)
      view.off('unloaded', cleanup)
      view.off('loaded', install)
    }
    const install = () => {
      if (ended || !view.isLoaded) return
      installing = true
      try {
        const bindings: Bindings = {}
        const next: DerivedValue[] = []
        for (const [property, keyframes] of frames) {
          const initial = readValue(view, property)
          let values = keyframes.map((value) => value ?? initial)
          if (reducedMotion() && property !== 'opacity' && !isColorProperty(property))
            values = values.map(() => values.at(-1)!)
          const input = values.map(
            (_, i) => start + ((end - start) * i) / (values.length - 1),
          )
          const value = isColorProperty(property)
            ? offset.to(
                input,
                values.map((value) => new Color(value)),
              )
            : offset.to(input, values)
          ;(bindings as Record<string, unknown>)[property] = value
          next.push(value as DerivedValue)
        }
        const off = bind(view, bindings)
        stop?.()
        for (const value of derived) value.dispose()
        derived = next
        stop = off
      } catch (error) {
        cleanup()
        throw error
      } finally {
        installing = false
      }
    }
    try {
      install()
      stopReduced = onReducedMotion(install)
      stopDemand = liveValueInput(offset).demand((active) => {
        if (active) demanded = true
        else if (demanded && !installing) cleanup()
      })
      source.on('unloaded', cleanup)
      view.on('unloaded', cleanup)
      view.on('loaded', install)
      return cleanup
    } catch (error) {
      cleanup()
      throw error
    }
  }
  if (options.execution === 'native')
    throw new Error(
      'These scroll tracks need supported native properties and rebuilt Jolt classes.',
    )
  if (!(source instanceof ScrollView))
    throw new TypeError('The JavaScript fallback requires a NativeScript ScrollView.')

  const animation = animate(view, keyframes, { duration: 1000, ease: 'linear' })
  animation.pause()
  let disposed = false
  let previous: number | undefined

  const update = (offset: number) => {
    if (disposed || !Number.isFinite(offset)) return
    const progress = Math.max(0, Math.min(1, (offset - start) / (end - start)))
    if (progress === previous) return
    animation.progress = progress
    previous = progress
  }
  const current = () =>
    update(axis === 'x' ? source.horizontalOffset : source.verticalOffset)
  const onScroll = (event: EventData) => {
    const scroll = event as ScrollEventData
    update(axis === 'x' ? scroll.scrollX : scroll.scrollY)
  }
  const cleanup = () => {
    if (disposed) return
    disposed = true
    source.off(ScrollView.scrollEvent, onScroll)
    source.off('loaded', current)
    source.off('unloaded', cleanup)
    view.off('loaded', current)
    view.off('unloaded', cleanup)
    animation.stop()
  }

  source.on(ScrollView.scrollEvent, onScroll)
  source.on('loaded', current)
  source.on('unloaded', cleanup)
  view.on('loaded', current)
  view.on('unloaded', cleanup)
  void animation.finished.then(cleanup)
  current()
  return cleanup
}
