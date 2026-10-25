import { isIOS, ScrollView, Utils, type View } from '@nativescript/core'
import { GestureSurface } from '../gestures/index.js'
import {
  liveSpringDriver,
  nativeLiveNode,
  type LiveNode,
  type LiveBinding,
} from '../live-spring-driver.js'
import { retainScrollDelegate } from '../driver/ios-scroll-delegate.js'
import { nativeTracePosition } from './native.js'
import {
  handoffIds,
  handoffInput,
  handoffMotions,
  type HandoffIds,
} from './scroll-handoff.js'
import type { TraceMotion } from './trace.js'
import type { ReplayAdapter } from './replay.js'

/** Isolated native contact replay. Uses the production gesture session's consumption code.
 * It holds the sheet at release; free spring settling and OS recognition are separate tests.
 */
export function nativeScrollHandoffTraceGraph(
  motions: readonly TraceMotion[],
  surface: GestureSurface,
  scroll: ScrollView,
  ids: HandoffIds = handoffIds,
): ReplayAdapter {
  const config = handoffMotions(motions, ids)
  let parent: View | undefined = scroll.parent as View | undefined
  while (parent && parent !== surface) parent = parent.parent as View | undefined
  if (
    !(surface instanceof GestureSurface) ||
    !(scroll instanceof ScrollView) ||
    scroll.orientation !== 'vertical' ||
    parent !== surface ||
    !surface.isLoaded ||
    !scroll.isLoaded
  )
    throw new TypeError(
      'Handoff replay requires a loaded GestureSurface and descendant vertical ScrollView.',
    )
  if (
    isIOS
      ? typeof JoltGestureSession === 'undefined' ||
        !JoltGestureSession.supportsScrollReplay?.()
      : typeof org === 'undefined' ||
        !org.rafaelaugusto.jolt.GestureSession.supportsScrollReplay?.()
  )
    throw new Error('Rebuild the native app to use scroll handoff replay.')
  if (Math.abs(scroll.scrollableHeight - config.scroll.max) > 1)
    throw new RangeError('The loaded scroll range differs from the recorded geometry.')
  if (
    isIOS
      ? JoltGestureSession.hasSession(surface.nativeViewProtected)
      : (
          surface.nativeViewProtected as org.rafaelaugusto.jolt.GestureSurface
        ).hasSession()
  )
    throw new Error('Replay requires an unowned gesture surface.')
  const count = () =>
    isIOS ? JoltLiveSpring.nodeCount() : org.rafaelaugusto.jolt.LiveSpring.nodeCount()
  const baseline = count(),
    nodes: LiveNode[] = []
  const surfaceInput = surface.isUserInteractionEnabled,
    scrollInput = scroll.isUserInteractionEnabled
  let claimedInput = false
  let binding: LiveBinding | undefined,
    releaseDelegate = () => {},
    disposed = false,
    ownsVelocity = false
  let session:
    | {
        input(phase: number, delta: number, velocity: number): void
        offset(value: number): void
        dispose(): void
      }
    | undefined
  const dispose = () => {
    if (disposed) return
    disposed = true
    try {
      session?.dispose()
    } finally {
      releaseDelegate()
      binding?.cancel()
      nodes.forEach((node) => node.dispose())
      if (claimedInput) {
        surface.isUserInteractionEnabled = surfaceInput
        scroll.isUserInteractionEnabled = scrollInput
      }
    }
  }
  try {
    const physics = {
      stiffness: config.sheet.stiffness,
      damping: config.sheet.damping,
      mass: config.sheet.mass,
      restDelta: 0.001,
      restSpeed: 0.01,
    }
    for (const initial of [0, config.sheet.initial, 1, 0])
      nodes.push(liveSpringDriver().create(initial, physics, false))
    const options = JSON.stringify({
      replay: true,
      axis: 2,
      threshold: 8,
      failOffset: 12,
      minX: 0,
      maxX: 0,
      minY: config.sheet.min,
      maxY: config.sheet.max,
      minScale: 1,
      maxScale: 1,
      pinch: false,
      rotate: false,
      tap: false,
      doubleTap: false,
    })
    if (isIOS) {
      const n = nodes.map(nativeLiveNode) as JoltLiveSpring[]
      const native = JoltGestureSession.attachScrollXYScaleRotationOptionsOnState(
        surface.nativeViewProtected,
        scroll.nativeViewProtected,
        n[0]!,
        n[1]!,
        n[2]!,
        n[3]!,
        options,
        () => {},
      )
      session = {
        input: (phase, delta, velocity) =>
          native.replayScrollDeltaVelocity(phase, delta, velocity),
        offset: (value) => native.replayScrollOffset(value),
        dispose: () => native.dispose(),
      }
      releaseDelegate = retainScrollDelegate(scroll, () => native.refreshScrollDelegate())
    } else {
      const n = nodes.map(nativeLiveNode) as org.rafaelaugusto.jolt.LiveSpring[]
      const native = new org.rafaelaugusto.jolt.GestureSession(
        surface.nativeViewProtected,
        scroll.nativeViewProtected,
        n[0]!,
        n[1]!,
        n[2]!,
        n[3]!,
        options,
        new org.rafaelaugusto.jolt.GestureSession.Listener({ onState() {} }),
      )
      session = {
        input: (phase, delta, velocity) => native.replayScroll(phase, delta, velocity),
        offset: (value) => native.replayScrollOffset(value),
        dispose: () => native.dispose(),
      }
    }
    // Claim input and bind only after native ownership validation succeeds.
    claimedInput = true
    surface.isUserInteractionEnabled = false
    scroll.isUserInteractionEnabled = false
    binding = nodes[1]!.bind(surface, 'y', [])
    session.offset(config.scroll.initial)
  } catch (error) {
    dispose()
    throw error
  }
  const input = handoffInput((phase, delta, velocity) => {
    const before = nodes[1]!.position()
    session!.input(phase, delta, velocity)
    ownsVelocity = phase === 2 && nodes[1]!.position() !== before
  })
  return {
    input(event) {
      if (disposed) throw new Error('Handoff graph is disposed.')
      if (event.type === 'gesture' && event.id === ids.sheet) input.gesture(event)
      else if (event.type === 'scroll' && event.id === ids.scroll) {
        if (event.offset < 0 || event.offset > config.scroll.max)
          throw new RangeError('Scroll offset is outside the recorded bounds.')
        session!.offset(event.offset)
      } else if (event.type === 'lifecycle') input.lifecycle(event.state)
      else throw new Error(`Handoff has no adapter for ${event.type}.`)
    },
    read(id) {
      if (id !== ids.sheet && id !== ids.scroll)
        throw new Error('Unknown handoff view ID.')
      const offset = isIOS
        ? (scroll.nativeViewProtected as UIScrollView).contentOffset.y +
          (scroll.nativeViewProtected as UIScrollView).adjustedContentInset.top
        : Utils.layout.toDeviceIndependentPixels(
            (scroll.nativeViewProtected as android.view.View).getScrollY(),
          )
      return {
        position: id === ids.sheet ? nativeTracePosition(surface, 'y') : offset,
        velocity: id === ids.sheet && ownsVelocity ? nodes[1]!.velocity() : 0,
        settled: !input.contact && !nodes[1]!.moving(),
      }
    },
    dispose,
    resources: () => (disposed ? Math.max(0, count() - baseline) : nodes.length + 2),
  }
}
