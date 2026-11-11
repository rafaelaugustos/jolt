import { createDropPolicy, type DropOptions, type DropZones } from '../core/drop.js'
import { shiftDrag, type WebDrag, type WebDragOptions } from './drag.js'
import { inputBlocked, inputEvents, type InteractionHost } from './interaction.js'
export type {
  DropEvent,
  DropMoveEvent,
  DropPadding,
  DropRect,
  DropTarget,
  DropZones,
  DropEffect,
} from '../core/drop.js'
export interface WebDropZoneOptions extends DropOptions<HTMLElement> {
  drag?: Omit<
    WebDragOptions,
    'onStart' | 'onMove' | 'onRelease' | 'onCancel' | 'onSettle' | 'value'
  >
}

export function createDropZones(
  source: HTMLElement,
  options: WebDropZoneOptions,
  host: InteractionHost,
  drag: (source: HTMLElement, options: WebDragOptions) => WebDrag,
  flushSource: () => void,
): DropZones {
  const document = source.ownerDocument,
    events = inputEvents(source)
  const inputOptions = options?.drag ?? {}
  if (
    Object.keys(inputOptions).some((key) => key.startsWith('on')) ||
    'value' in inputOptions
  )
    throw new TypeError(
      'Drop zones own drag callbacks and move the source element itself.',
    )
  let input: WebDrag | undefined,
    handoff = false
  const cancelInput = () => {
    handoff = true
    try {
      input?.cancel()
    } finally {
      handoff = false
    }
  }
  const policy = createDropPolicy(source, options, {
    bounds: (target) => {
      if (!(target instanceof events.view.HTMLElement) || inputBlocked(target, document))
        return undefined
      const rect = target.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    },
    enabled: () => !document.hidden && !inputOptions.disabled,
    cancelDrag: cancelInput,
    error: host.error,
    translation: () => input?.position ?? { x: 0, y: 0 },
    shift: (x, y) => {
      if (!input) return
      shiftDrag(input, { x, y })
      flushSource()
    },
  })
  const releases: (() => void)[] = []
  const controller: DropZones = {
    get hovered() {
      return policy.handle.hovered
    },
    get accepted() {
      return policy.handle.accepted
    },
    get dragging() {
      return policy.handle.dragging
    },
    get paused() {
      return policy.handle.paused
    },
    get disposed() {
      return policy.handle.disposed
    },
    request: (id) => policy.handle.request(id),
    refresh: () => {
      // Measure the painted translation, not a newer unrendered input sample.
      if (policy.handle.dragging) flushSource()
      policy.handle.refresh()
    },
    cancel() {
      try {
        policy.handle.cancel()
      } finally {
        cancelInput()
      }
    },
    pause() {
      try {
        policy.handle.pause()
      } finally {
        input?.pause()
      }
    },
    play() {
      policy.handle.play()
      input?.play()
    },
    dispose() {
      if (controller.disposed) return
      events.dispose()
      for (const release of releases.splice(0)) release()
      try {
        policy.handle.dispose()
      } finally {
        input?.dispose()
        input = undefined
      }
    },
  }
  try {
    input = drag(source, {
      ...inputOptions,
      onStart: policy.begin,
      onMove: () => {
        flushSource()
        policy.move()
      },
      onRelease: () => {
        policy.release()
      },
      onCancel: () => {
        if (!handoff) policy.handle.cancel()
      },
    })
    releases.push(host.register(source, controller, controller.refresh))
    // A removed accepting target cancels its owned effect.
    for (const entry of options.targets)
      releases.push(
        host.register(
          entry.target,
          {
            get disposed() {
              return controller.disposed
            },
            get paused() {
              return controller.paused
            },
            pause: controller.cancel,
            play: controller.refresh,
            cancel: controller.cancel,
            dispose: controller.cancel,
          },
          controller.refresh,
        ),
      )
    events.on(document, 'visibilitychange', () => {
      if (document.hidden) controller.cancel()
    })
    events.on(events.view, 'blur', controller.cancel)
  } catch (error) {
    controller.dispose()
    throw error
  }
  return controller
}
