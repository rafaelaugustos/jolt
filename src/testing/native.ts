import {
  Application,
  Device,
  Screen,
  GestureTypes,
  isIOS,
  Utils,
  type View,
  type PanGestureEventData,
  type EventData,
  type ScrollView,
} from '@nativescript/core'
import { animate } from '../animate.js'
import { asRoot, bind, motionValue } from '../motion-value.js'
import { drag, type Drag } from '../drag.js'
import { motionScope } from '../motion-scope.js'
import { getDriver, setDriver } from '../driver/index.js'
import { reducedMotion, timeScale } from '../config.js'
import { DragInput } from '../drag-input.js'
import { onKeyboard } from '../keyboard.js'
import { ReplayClock } from './clock.js'
import { replayInteraction, type ReplayAdapter, type ReplayReport } from './replay.js'
import {
  parseTrace,
  type InteractionTrace,
  type TraceInput,
  type TraceMotion,
  type TraceState,
  type TraceMetadata,
  type TraceRecorder,
} from './trace.js'

export { ReplayClock }
export { nativeScrollHandoffTraceGraph } from './scroll-handoff-native.js'
export { observeScrollHandoffInputs } from './handoff-recorder.js'

export const traceNow = () => getDriver().now()
export const traceSettings = () => ({
  timeScale: timeScale(),
  reducedMotion: reducedMotion(),
})
export function traceMetadata(): TraceMetadata {
  const screen = Screen.mainScreen
  const refreshRate = isIOS
    ? UIScreen.mainScreen.maximumFramesPerSecond
    : (Application.android.foregroundActivity ?? Application.android.startActivity)
        .getWindowManager()
        .getDefaultDisplay()
        .getRefreshRate()
  return {
    platform: isIOS ? 'ios' : 'android',
    os: Device.osVersion,
    model: Device.model,
    refreshRate,
    density: screen.scale,
    width: screen.widthDIPs,
    height: screen.heightDIPs,
  }
}

/** Opt-in Core pan/environment capture. Pointer numbers are contact slots, never native handles. */
export function observeTraceInputs(
  view: View,
  id: string,
  recorder: Pick<TraceRecorder, 'input'>,
  options: {
    pan?: boolean
    layout?: boolean
    lifecycle?: boolean
    keyboard?: boolean
    scroll?: ScrollView
  } = { pan: true },
): () => void {
  const off: (() => void)[] = [],
    samples = new DragInput()
  const on = (name: string, callback: (event: EventData) => void) => {
    view.on(name, callback)
    off.push(() => view.off(name, callback))
  }
  if (options.pan)
    on('pan', (raw) => {
      const event = raw as PanGestureEventData
      if (event.state === 1) samples.reset()
      const point = samples.read(event, view)
      const count =
        event.android?.current?.getPointerCount?.() ??
        event.ios?.numberOfTouches ??
        (event.state === 3 ? 0 : 1)
      recorder.input({
        type: 'gesture',
        id,
        phase: point.cancelled
          ? 'cancel'
          : event.state === 1
            ? 'begin'
            : event.state === 3
              ? 'end'
              : 'move',
        x: point.x,
        y: point.y,
        velocityX: point.velocityX,
        velocityY: point.velocityY,
        pointers: Array.from({ length: Math.min(10, count) }, (_, index) => index),
      })
    })
  if (options.layout)
    on('layoutChanged', () => {
      const location = view.getLocationInWindow(),
        size = view.getActualSize()
      if (location) recorder.input({ type: 'layout', id, ...location, ...size })
    })
  if (options.scroll) {
    const scroll = options.scroll
    const changed = () =>
      recorder.input({ type: 'scroll', id, offset: scroll.verticalOffset })
    scroll.on('scroll', changed)
    off.push(() => scroll.off('scroll', changed))
  }
  if (options.keyboard)
    off.push(
      onKeyboard((state) => recorder.input({ type: 'keyboard', inset: state.height })),
    )
  if (options.lifecycle) {
    const suspend = () => recorder.input({ type: 'lifecycle', state: 'suspend' })
    const resume = () => recorder.input({ type: 'lifecycle', state: 'resume' })
    Application.on(Application.suspendEvent, suspend)
    Application.on(Application.resumeEvent, resume)
    off.push(() => {
      Application.off(Application.suspendEvent, suspend)
      Application.off(Application.resumeEvent, resume)
    })
    on('unloaded', () => recorder.input({ type: 'lifecycle', state: 'unload' }))
    on('loaded', () => recorder.input({ type: 'lifecycle', state: 'load' }))
  }
  let disposed = false
  return () => {
    if (!disposed) {
      disposed = true
      off.reverse().forEach((release) => release())
    }
  }
}

/** Same boundary as the native CI probe: no iOS model-layer fallback. */
export function nativeTracePosition(view: View, axis: 'x' | 'y'): number {
  if (isIOS) {
    const layer = (view.nativeViewProtected as UIView).layer.presentationLayer()
    if (!layer) throw new Error('Replay view has no native presentation layer.')
    return Number(layer.valueForKeyPath(`transform.translation.${axis}`))
  }
  const native = view.nativeViewProtected as android.view.View
  return Utils.layout.toDeviceIndependentPixels(
    axis === 'x' ? native.getTranslationX() : native.getTranslationY(),
  )
}

/** Dispatch normalized graph input, explicitly bypassing the OS recognizer. */
export function replayPan(view: View, event: Extract<TraceInput, { type: 'gesture' }>) {
  if (event.phase === 'begin') {
    const touch = { eventName: 'touch', object: view, view, action: 'down' }
    const observers = view.getGestureObservers?.(GestureTypes.touch)
    if (observers?.length) {
      for (const observer of [...observers]) observer.callback(touch as never)
    } else view.notify(touch)
  }
  const data = {
    eventName: 'pan',
    object: view,
    view,
    state: { begin: 1, move: 2, end: 3, cancel: 0 }[event.phase],
    deltaX: event.x,
    deltaY: event.y,
    // DragInput accepts this normalized structural payload on either platform.
    ios: {
      translationInView: () => ({ x: event.x, y: event.y }),
      velocityInView: () => ({ x: event.velocityX, y: event.velocityY }),
      numberOfTouches: event.pointers.length,
    },
  } as unknown as PanGestureEventData
  const observers = view.getGestureObservers?.(GestureTypes.pan)
  if (observers?.length) {
    for (const observer of [...observers]) observer.callback(data)
  } else view.notify(data)
}

export interface MotionTraceGraph extends ReplayAdapter {
  /** Engine state for checkpoints recorded before handing them to native presentation probes. */
  engineState(id: string): TraceState
}

/** Reference graph for interrupted springs and cancelled single-pointer drags. */
export function motionTraceGraph(
  motions: readonly TraceMotion[],
  viewFor: (id: string) => View,
  options: {
    native?: boolean
    /** Application-specific scroll/layout/keyboard routing. Unsupported events must throw. */
    environment?: (event: TraceInput, graph: MotionTraceGraph) => void
  } = {},
): MotionTraceGraph {
  const scope = motionScope()
  let disposed = false
  const nodes = new Map<
    string,
    {
      config: TraceMotion
      view: View
      value: ReturnType<typeof motionValue>
      drag?: Drag
      settled: boolean
      velocity: number
      generation: number
    }
  >()
  try {
    for (const config of motions) {
      const view = viewFor(config.id),
        value = motionValue(config.initial)
      const node = {
        config,
        view,
        value,
        settled: true,
        velocity: 0,
        generation: 0,
        drag: undefined as Drag | undefined,
      }
      nodes.set(config.id, node)
      scope.use(() => bind(view, { [config.axis]: value }))
      if (config.kind === 'drag')
        node.drag = scope.add(
          drag(view, {
            value,
            axis: config.axis,
            bounds:
              config.axis === 'x'
                ? { left: config.min, right: config.max }
                : { top: config.min, bottom: config.max },
            ...(config.snap.length ? { snap: config.snap } : {}),
            onMove: (event) => {
              node.velocity = config.axis === 'x' ? event.velocityX : event.velocityY
            },
            onCancel: () => {
              node.velocity = 0
            },
          }),
        )
    }
  } catch (error) {
    scope.dispose()
    throw error
  }
  const find = (id: string) => {
    const node = nodes.get(id)
    if (!node) throw new Error('Unknown replay view ID.')
    return node
  }
  const graph: MotionTraceGraph = {
    input(event) {
      if (disposed) throw new Error('Replay graph is disposed.')
      if (event.type === 'target') {
        const node = find(event.id),
          generation = ++node.generation
        if (node.config.kind !== 'spring')
          throw new Error('Target events require a spring motion.')
        node.settled = false
        const animation = scope.add(
          animate(node.value, event.value, {
            type: 'spring',
            stiffness: node.config.stiffness,
            damping: node.config.damping,
            mass: node.config.mass,
          }),
        )
        void animation.finished.then(() => {
          if (generation === node.generation) node.settled = true
        })
      } else if (event.type === 'gesture') {
        const node = find(event.id)
        if (!node.drag) throw new Error('Gesture events require a drag motion.')
        replayPan(node.view, event)
      } else if (
        event.type === 'lifecycle' &&
        (event.state === 'suspend' || event.state === 'resume')
      ) {
        if (event.state === 'suspend') scope.suspend()
        else scope.resume()
      } else if (options.environment) options.environment(event, graph)
      else throw new Error(`The reference graph has no adapter for ${event.type}.`)
    },
    engineState(id) {
      const node = find(id)
      return {
        position: node.value.get(),
        velocity: node.drag?.dragging
          ? node.velocity
          : asRoot(node.value).inspect().velocity,
        settled: node.drag ? !node.drag.dragging && !node.drag.settling : node.settled,
      }
    },
    read(id) {
      const node = find(id),
        state = graph.engineState(id)
      return {
        ...state,
        position: options.native
          ? nativeTracePosition(node.view, node.config.axis)
          : state.position,
      }
    },
    dispose() {
      if (!disposed) {
        disposed = true
        scope.dispose()
      }
    },
    resources: () =>
      scope.size +
      [...nodes.values()].reduce(
        (sum, node) => sum + asRoot(node.value).inspect().resources,
        0,
      ),
  }
  return graph
}

let replaying = false
/** Run in an isolated fixture. Installs the test driver temporarily and always restores it. */
export async function replayWithDriver(
  value: InteractionTrace | string,
  create: (trace: InteractionTrace, random: () => number) => ReplayAdapter,
  options: {
    native?: boolean
    signal?: { readonly aborted: boolean }
    present?: () => Promise<void>
  } = {},
): Promise<ReplayReport> {
  if (replaying) throw new Error('Only one isolated driver replay may run at a time.')
  const trace = parseTrace(value),
    previous = getDriver()
  if (
    timeScale() !== trace.settings.timeScale ||
    reducedMotion() !== trace.settings.reducedMotion
  )
    throw new Error(
      'Configure the isolated fixture to match the recorded timeScale and Reduced Motion settings first.',
    )
  const clock = new ReplayClock(
    options.native ? previous : undefined,
    trace.settings.reducedMotion,
  )
  const present =
    options.present ??
    (() =>
      new Promise<void>((resolve, reject) => {
        let cancel = () => {}
        const timer = setTimeout(() => {
          cancel()
          reject(new Error('Native replay presentation timed out.'))
        }, 1500)
        cancel = previous.frame(() => {
          cancel = previous.frame(() => {
            clearTimeout(timer)
            resolve()
          })
        })
      }))
  replaying = true
  setDriver(clock)
  try {
    return await replayInteraction(trace, {
      signal: options.signal,
      advanceTo: async (at) => {
        clock.advanceTo(at)
        if (options.native) await present()
      },
      create: (trace, random) => {
        const adapter = create(trace, random)
        return {
          input: async (event) => {
            await adapter.input(event)
            if (options.native) await present()
          },
          read: (id) => adapter.read(id),
          dispose: () => adapter.dispose(),
          resources: () => adapter.resources() + clock.resources,
        }
      },
    })
  } finally {
    try {
      clock.dispose()
    } finally {
      setDriver(previous)
      replaying = false
    }
  }
}
