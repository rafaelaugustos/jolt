import { onBeforeUnmount, ref, watch, type Ref } from 'nativescript-vue'
import { Application, type EventData, type View } from '@nativescript/core'
import { drag, motionScope, set, type Drag, type DragPoint, type DragRelease } from '@rafaelaugusto/jolt'
import { intersects, transformedRect, type Rect } from '../potion/geometry'

interface IngredientDragOptions {
  disabled: Ref<boolean>
  target: () => Rect | undefined
  onStart: () => void
  onHover: (active: boolean) => void
  onDrop: () => void
}

const REST = { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }
const DRAG_SCALE = 0.86
const tilt = (x: number) => Math.max(-8, Math.min(8, x / 16))

/** Jolt owns tracking and snap physics; this adapter decides whether a drop lands. */
export function useIngredientDrag(options: IngredientDragOptions) {
  const dragging = ref(false)
  const motion = motionScope()
  let card: View | undefined
  let controller: Drag | undefined
  let origin: Rect | undefined
  let generation = 0
  let ignoreTapUntil = 0
  let hovering = false

  function setHover(active: boolean) {
    if (hovering === active) return
    hovering = active
    options.onHover(active)
  }

  function hitsTarget(point: DragPoint) {
    const target = options.target()
    return !!origin && !!target && intersects(
      transformedRect(origin, point, DRAG_SCALE, tilt(point.x)), target,
    )
  }

  function restore() {
    generation++
    motion.reset()
    origin = undefined
    dragging.value = false
    ignoreTapUntil = Date.now() + 500
    setHover(false)
    if (card) set(card, REST)
  }

  function start(point: DragPoint) {
    if (!card || options.disabled.value || Application.suspended) {
      controller?.cancel()
      return
    }
    generation++
    motion.reset()
    options.onStart()
    // Measure the layout origin, even when catching a card during its return.
    set(card, { scale: 1, rotate: 0 })
    const location = card.getLocationInWindow()
    origin = { x: location.x - point.x, y: location.y - point.y, ...card.getActualSize() }
    dragging.value = true
    ignoreTapUntil = Date.now() + 500
    set(card, { scale: DRAG_SCALE })
  }

  async function release(event: DragRelease) {
    if (!card || !origin || options.disabled.value || Application.suspended) {
      controller?.cancel()
      restore()
      return
    }
    const id = generation
    // Check the final release position: it need not have produced an onMove.
    const accepted = hitsTarget(event)
    setHover(false)
    ignoreTapUntil = Date.now() + 500
    if (accepted) {
      controller?.pause()
      const finished = await motion.animate(card, { scale: 0.08, opacity: 0 }, { duration: 200, ease: 'easeIn' }).finished
      if (id !== generation) return
      restore()
      if (finished && !Application.suspended && !options.disabled.value) options.onDrop()
      if (!options.disabled.value) controller?.play()
    } else {
      // snap: [0] returns both axes using Jolt's release velocity and native spring.
      const appearance = motion.animate(card, { rotate: 0, scale: 1 }, 'bouncy')
      await Promise.all([event.animation.finished, appearance.finished])
      if (id === generation) restore()
    }
  }

  function loaded(event: EventData) {
    const view = event.object as View
    if (view === card && controller) return
    controller?.dispose()
    restore()
    card = view
    // Keep the gesture separate from the visual scope: resetting feedback must
    // not detach the recognizer. The controller handles unload/background itself.
    controller = drag(view, {
      snap: [0],
      onStart: start,
      onMove: point => {
        if (!origin) return
        set(view, { rotate: tilt(point.x) })
        setHover(hitsTarget(point))
      },
      onRelease: event => { void release(event) },
      onCancel: restore,
    })
    if (options.disabled.value) controller.pause()
  }

  function tap() {
    if (Application.suspended || options.disabled.value || dragging.value || Date.now() < ignoreTapUntil) return
    options.onDrop()
  }

  watch(options.disabled, disabled => {
    if (disabled) { controller?.pause(); restore() }
    else controller?.play()
  }, { flush: 'sync' })

  // A release has no active contact for Jolt to cancel. Invalidate its pending
  // absorption callback too, so backgrounding cannot start an invisible brew.
  Application.on(Application.suspendEvent, restore)
  const resume = () => { if (!options.disabled.value) controller?.play() }
  Application.on(Application.resumeEvent, resume)
  onBeforeUnmount(() => {
    controller?.dispose()
    restore()
    motion.dispose()
    Application.off(Application.suspendEvent, restore)
    Application.off(Application.resumeEvent, resume)
  })

  return { dragging, loaded, tap }
}
