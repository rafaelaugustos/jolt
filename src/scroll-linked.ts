import { ScrollView, type EventData, type ScrollEventData } from '@nativescript/core'
import { animate, toView } from './animate.js'
import type { Keyframes, Target } from './types.js'

export interface ScrollLinkedOptions {
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
  if (!(source instanceof ScrollView))
    throw new TypeError('scrollLinked requires a NativeScript ScrollView.')
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
