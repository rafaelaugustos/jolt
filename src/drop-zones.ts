import { Application, Trace, isIOS, type View } from '@nativescript/core'
import { toView } from './animate.js'
import { dragBeforeRelease, type AnchoredDrag, type DragOptions } from './drag.js'
import {
  createDropPolicy,
  type DropOptions,
  type DropZones,
  type DropRect,
} from './core/drop.js'
import type { Target } from './types.js'

export type {
  DropEvent,
  DropMoveEvent,
  DropPadding,
  DropRect,
  DropTarget,
  DropZones,
  DropEffect,
} from './core/drop.js'
export interface DropZoneOptions extends DropOptions<View> {
  drag?: Omit<DragOptions, 'onStart' | 'onMove' | 'onRelease' | 'onCancel' | 'onSettle'>
}

/** An in-app drop coordinator. OS file import and cross-window dragging are separate. */
export function dropZones(target: Target, options: DropZoneOptions): DropZones {
  const source = toView(target)
  const targets = options?.targets?.map((entry) => ({
    ...entry,
    target: toView(entry.target),
  }))
  const inputOptions = options?.drag ?? {}
  if (
    Object.keys(inputOptions).some((key) => key.startsWith('on')) ||
    'value' in inputOptions
  )
    throw new TypeError('Drop zones own drag callbacks and move the source view itself.')
  let input: AnchoredDrag | undefined,
    handoff = false,
    background = Application.suspended
  const geometry = isIOS ? undefined : new org.rafaelaugusto.jolt.DropGeometry()
  const bounds = (view: View): DropRect | undefined => {
    if (!view.isLoaded || !view.isEnabled || view.visibility !== 'visible')
      return undefined
    if (isIOS) {
      const native = view.nativeViewProtected as UIView,
        origin = source.nativeViewProtected as UIView
      if (
        !native?.window ||
        !origin?.window ||
        !native.window.isEqual(origin.window) ||
        native.hidden
      )
        return undefined
      const rect = native.convertRectToView(native.bounds, null)
      return {
        x: rect.origin.x,
        y: rect.origin.y,
        width: rect.size.width,
        height: rect.size.height,
      }
    }
    const native = view.nativeViewProtected as android.view.View,
      origin = source.nativeViewProtected as android.view.View
    if (
      !native?.getWindowToken() ||
      !origin?.getWindowToken() ||
      !native.getWindowToken().equals(origin.getWindowToken())
    )
      return undefined
    const rect = geometry!.bounds(native)
    return rect
      ? { x: rect[0]!, y: rect[1]!, width: rect[2]!, height: rect[3]! }
      : undefined
  }
  const cancelInput = () => {
    handoff = true
    try {
      input?.cancel()
    } finally {
      handoff = false
    }
  }
  const policy = createDropPolicy(
    source,
    { ...options, targets: targets ?? [] },
    {
      bounds,
      enabled: () => !background,
      cancelDrag: cancelInput,
      translation: () => input?.position ?? { x: 0, y: 0 },
      shift: (x, y) => input?.shift(x, y),
      error: (error) =>
        Trace.write(String(error), Trace.categories.Error, Trace.messageType.error),
    },
  )
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
    refresh: () => policy.handle.refresh(),
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
      for (const view of watched) {
        view.off('unloaded', invalidate)
        view.off('layoutChanged', refresh)
      }
      Application.off(Application.suspendEvent, suspend)
      Application.off(Application.resumeEvent, resume)
      try {
        policy.handle.dispose()
      } finally {
        input?.dispose()
        input = undefined
        watched.clear()
      }
    },
  }
  const watched = new Set([source, ...(targets ?? []).map((entry) => entry.target)])
  const invalidate = () => controller.cancel(),
    refresh = () => controller.refresh()
  const suspend = () => {
    background = true
    controller.cancel()
  }
  const resume = () => {
    background = false
  }
  try {
    input = dragBeforeRelease(
      source,
      {
        ...inputOptions,
        onStart: policy.begin,
        onMove: policy.move,
        onCancel: () => {
          if (!handoff) policy.handle.cancel()
        },
      },
      () => {
        policy.release()
      },
    )
    for (const view of watched) {
      view.on('unloaded', invalidate)
      view.on('layoutChanged', refresh)
    }
    Application.on(Application.suspendEvent, suspend)
    Application.on(Application.resumeEvent, resume)
  } catch (error) {
    controller.dispose()
    throw error
  }
  return controller
}
