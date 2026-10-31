/** Opt-in checks on the real Layers demo; input comes from XCTest/ADB. */
import {
  Application,
  Device,
  File,
  Utils,
  isIOS,
  knownFolders,
  type EventData,
  type TouchGestureEventData,
  type View,
} from '@nativescript/core'
import { animate, press, set, stop, type PlaybackAnimation } from '@rafaelaugusto/jolt'
import { getDriver } from '../dist/driver/index.js'
import { liveComposition } from '../dist/live-spring-driver.js'
import { currentValue, inspectViewMotion } from '../dist/engine.js'

export function motionRfcChecks(view: View) {
  const driver = getDriver(),
    originalPlay = driver.play,
    originalStop = driver.stop,
    originalFrame = driver.frame
  const active = new Set<unknown>(),
    timers = new Set<ReturnType<typeof setTimeout>>(),
    probes = new Set<() => void>()
  const snapshots: object[] = [],
    plays: object[] = [],
    touches: object[] = []
  let frames = 0,
    phase = 'ready',
    disposed = false,
    base: PlaybackAnimation | undefined
  const directory = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
  const path = directory + '/jolt-motion-rfc.json'
  const save = () =>
    File.fromPath(path).writeTextSync(
      JSON.stringify({
        platform: Device.os,
        version: Device.osVersion,
        composition: liveComposition() ? 'native' : 'windows',
        phase,
        snapshots,
        plays,
        touches,
      }),
    )
  driver.frame = (callback) => {
    frames++
    return originalFrame(callback)
  }
  driver.play = (target, track, startedAt, onEnd) => {
    if (target !== view) return originalPlay(target, track, startedAt, onEnd)
    plays.push({
      phase,
      property: track.property,
      duration: track.duration,
      repeat: Number.isFinite(track.repeat) ? track.repeat : 'infinite',
    })
    let handle: unknown,
      ended = false
    handle = originalPlay(target, track, startedAt, (finished) => {
      ended = true
      active.delete(handle)
      onEnd(finished)
    })
    if (!ended) active.add(handle)
    return handle
  }
  driver.stop = (target, handle) => {
    if (target === view) active.delete(handle)
    originalStop(target, handle)
  }
  const later = (ms: number, callback: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      if (!disposed) callback()
    }, ms)
    timers.add(timer)
  }
  const pose = () => {
    if (isIOS) {
      const layer =
        (view.ios as UIView).layer.presentationLayer() ?? (view.ios as UIView).layer
      return {
        x: Number(layer.valueForKeyPath('transform.translation.x')),
        scale: Number(layer.valueForKeyPath('transform.scale.x')),
      }
    }
    return {
      x: Utils.layout.toDeviceIndependentPixels(view.android.getTranslationX()),
      scale: Number(view.android.getScaleX()),
    }
  }
  const capture = (name: string, neutral = false) => {
    const progress = base?.progress ?? 1
    snapshots.push({
      name,
      phase,
      time: driver.now(),
      actual: pose(),
      expected: neutral
        ? { x: 64 - 40 * progress, scale: 1.3 + 0.2 * progress }
        : { x: currentValue(view, 'x'), scale: currentValue(view, 'scaleX') },
      baseProgress: progress,
      active: active.size,
      frames,
      live: isIOS
        ? { nodes: JoltLiveSpring.nodeCount(), clock: JoltLiveSpring.activeCount() }
        : {
            nodes: org.rafaelaugusto.jolt.LiveSpring.nodeCount(),
            clock: org.rafaelaugusto.jolt.LiveSpring.activeCount(),
          },
      channels: inspectViewMotion(view).map((e) => ({
        property: e.property,
        layer: e.layer ?? 'base',
        paused: e.paused,
      })),
    })
    save()
  }
  const sample = (name: string, neutral = false) => {
    if (isIOS || name === 'disposed') return capture(name, neutral)
    // Android getters expose the last displayed pose. Read after its animation
    // frame instead of comparing that pose with a later command-time clock.
    // This one-shot audit probe is separate from library frame requests.
    const cancel = originalFrame(() => {
      probes.delete(cancel)
      if (!disposed) capture(name, neutral)
    })
    probes.add(cancel)
  }
  const removePress = press(
    view,
    { x: 8, scale: 0.88 },
    { layer: 'press', duration: 150, ease: 'linear' },
  )
  const touched = (args: EventData) => {
    const event = args as TouchGestureEventData
    touches.push({ action: event.action, phase, time: driver.now() })
    if (phase === 'entrance' && event.action === 'down') {
      later(220, () => sample('held-with-feedback'))
      later(400, () => {
        stop(view, ['x'], { layer: 'feedback' })
        later(80, () => sample('held-without-feedback'))
      })
    }
    if (phase === 'entrance' && (event.action === 'up' || event.action === 'cancel'))
      later(250, () => sample('released-to-base', true))
  }
  view.on('touch', touched)
  const dispose = () => {
    if (disposed) return
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
    for (const cancel of probes) cancel()
    probes.clear()
    removePress()
    view.off('touch', touched)
    stop(view)
    phase = 'disposed'
    sample('disposed')
    disposed = true
    driver.play = originalPlay
    driver.stop = originalStop
    driver.frame = originalFrame
  }
  return {
    move() {
      if (phase !== 'ready') return
      phase = 'entrance'
      set(view, { x: 24, scale: 1.3 })
      base = animate(
        view,
        { x: [64, 24], scale: [1.3, 1.5] },
        { duration: 4000, ease: 'linear' },
      )
      later(4250, () => sample('entrance-settled', true))
    },
    shake() {
      if (phase === 'entrance') {
        animate(
          view,
          { x: [0, -12, 12, 0] },
          { layer: 'feedback', duration: 900, ease: 'linear', repeat: Infinity },
        )
      } else if (phase === 'loops') {
        phase = 'windows'
        stop(view)
        set(view, { x: 24, scale: 1.5 })
        for (const [layer, duration, amplitude] of [
          ['wobble', 701, 16],
          ['pulse', 709, 9],
        ] as const)
          animate(
            view,
            { x: [0, amplitude, 0] },
            { layer, duration, ease: 'linear', repeat: Infinity, repeatType: 'reverse' },
          )
        later(3800, () => sample('before-window'))
        later(4400, () => sample('after-window'))
      }
    },
    breathe() {
      if (phase === 'windows') return dispose()
      if (phase !== 'entrance') return
      phase = 'loops'
      stop(view)
      set(view, { x: 24, scale: 1.5 })
      animate(
        view,
        { x: [0, -16, 16, 0] },
        {
          layer: 'wobble',
          duration: 900,
          ease: 'linear',
          repeat: Infinity,
          repeatType: 'reverse',
        },
      )
      animate(
        view,
        { x: [0, 9, 0] },
        {
          layer: 'pulse',
          duration: 1600,
          ease: 'linear',
          repeat: Infinity,
          repeatType: 'reverse',
        },
      )
      later(400, () => sample('common-loop-early'))
      later(1700, () => sample('common-loop-late'))
    },
    dispose,
  }
}
