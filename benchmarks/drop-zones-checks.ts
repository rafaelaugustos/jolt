import {
  GestureTypes,
  GridLayout,
  Label,
  StackLayout,
  Utils,
  isIOS,
  type GestureEventData,
  type View,
} from '@nativescript/core'
import { configure, motionScope, set, type DropMoveEvent } from '@rafaelaugusto/jolt'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
// Scripted pan input on the real handle view; OS touches are recorded separately.
function pan(view: View, state: number, x: number, y: number) {
  const event = {
    eventName: 'pan',
    object: view,
    view,
    state,
    deltaX: x,
    deltaY: y,
    ios: {
      numberOfTouches: state === 3 ? 0 : 1,
      translationInView: () => ({ x, y }),
      velocityInView: () => ({ x: 0, y: 0 }),
    },
  } as unknown as GestureEventData
  for (const observer of [...(view.getGestureObservers(GestureTypes.pan) ?? [])])
    observer.callback(event)
}
/** Presented translation: the iOS presentation layer or Android's native getter. */
function presentedY(view: View) {
  if (isIOS) {
    const layer = (view.ios as UIView).layer
    return Number(
      (layer.presentationLayer() ?? layer).valueForKeyPath('transform.translation.y'),
    )
  }
  return Utils.layout.toDeviceIndependentPixels(
    (view.android as android.view.View).getTranslationY(),
  )
}
function begin(view: View) {
  for (const observer of [...(view.getGestureObservers(GestureTypes.touch) ?? [])])
    observer.callback({ action: 'down' } as unknown as GestureEventData)
  pan(view, 1, 0, 0)
}

/** Drop zones with a handle, move reports, padded targets, re-anchoring and cancellation. */
export async function runDropZonesChecks(host: StackLayout) {
  const assert = (value: unknown, message: string) => {
    if (!value) throw new Error(message)
  }
  const near = (actual: number, expected: number, message: string, tolerance = 2) =>
    assert(
      Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
      `${message}: ${actual} != ${expected} ± ${tolerance}`,
    )
  const scope = motionScope()
  const board = new GridLayout()
  board.columns = '*,*'
  board.height = 300
  const list = new StackLayout(),
    spacer = new Label(),
    card = new GridLayout(),
    grip = new Label(),
    body = new Label(),
    column = new StackLayout()
  spacer.height = 0
  list.clipToBounds = false
  card.columns = '36,*'
  card.height = 60
  card.backgroundColor = '#61E4C2' as never
  grip.text = '⋮⋮'
  grip.backgroundColor = '#3FB89A' as never
  body.text = 'Drop card'
  body.col = 1
  card.addChild(grip)
  card.addChild(body)
  list.addChild(spacer)
  list.addChild(card)
  column.col = 1
  column.height = 50
  column.verticalAlignment = 'top'
  column.backgroundColor = '#227B6B' as never
  board.addChild(list)
  board.addChild(column)
  host.addChild(board)
  if (!isIOS)
    for (const layout of [board, list])
      (layout.android as android.view.ViewGroup).setClipChildren(false)
  const moves: DropMoveEvent<View>[] = []
  let dropped = 0,
    rejected = 0
  const located = (view: View) => {
    const point = view.getLocationInWindow()!
    const size = view.getActualSize()
    return { x: point.x, y: point.y, width: size.width, height: size.height }
  }
  try {
    configure({ reducedMotion: 'never' })
    await wait(200)
    const zones = scope.dropZones(card, {
      targets: [{ id: 'column', target: column, padding: { bottom: 60 } }],
      drag: { handle: grip, snap: [0] },
      onMove: (event) => moves.push(event),
      onDrop: () => {
        dropped++
      },
      onReject: () => {
        rejected++
      },
    })
    assert(
      !card.getGestureObservers(GestureTypes.pan)?.length,
      'The card body took the pan',
    )
    assert(
      grip.getGestureObservers(GestureTypes.pan)?.length === 1,
      'The handle has no pan',
    )
    const start = located(card),
      target = located(column)

    begin(grip)
    pan(grip, 2, 30, 0)
    await wait(60)
    near(located(card).x, start.x + 30, 'Handle pan did not move the card')
    near(located(grip).x - located(card).x, 0, 'The grip moved apart from the card')
    const report = moves.at(-1)!
    assert(report?.method === 'drag' && report.source === card, 'Missing move report')
    near(report.bounds.x, start.x + 30, 'Move report x')
    near(report.bounds.y, start.y, 'Move report y')
    near(report.bounds.width, start.width, 'Move report width')

    spacer.height = 50
    await wait(200)
    near(located(card).y, start.y, 'Card left the pointer after a layout change')
    near(card.translateY, -50, 'Translation was not re-anchored')
    pan(grip, 2, 30, 10)
    await wait(60)
    near(located(card).y, start.y + 10, 'Re-anchored card did not follow the pointer')
    const reanchored = located(card).y

    const count = moves.length
    zones.cancel()
    pan(grip, 2, 60, 40)
    await wait(60)
    assert(moves.length === count, 'Move reports continued after cancel')
    near(located(card).y, reanchored, 'Cancelled card kept moving')
    spacer.height = 0
    set(card, { x: 0, y: 0 })
    await wait(200)

    const towards = (below: number) => ({
      x: target.x + target.width / 2 - (start.x + start.width / 2),
      y: target.y + target.height + below - (start.y + start.height / 2),
    })
    let point = towards(40)
    begin(grip)
    pan(grip, 2, point.x, point.y)
    await wait(60)
    assert(
      zones.hovered === 'column',
      `Bottom padding did not extend the target: ${JSON.stringify({ moved: point, card: located(card), column: located(column), report: moves.at(-1)?.bounds })}`,
    )
    assert(moves.at(-1)?.id === 'column', 'Move report missed the padded target')
    pan(grip, 3, point.x, point.y)
    await wait(60)
    assert(dropped === 1 && rejected === 0, 'Padded release was not accepted')
    set(card, { x: 0, y: 0 })
    await wait(120)

    point = towards(100)
    begin(grip)
    pan(grip, 2, point.x, point.y)
    await wait(60)
    assert(zones.hovered === undefined, 'Hit padding exceeded its 60 DIP')
    pan(grip, 3, point.x, point.y)
    await wait(80)
    assert(rejected === 1 && dropped === 1, 'Release beyond padding was not rejected')
    assert(Math.abs(presentedY(card)) > 1, 'Normal motion returned without a spring')
    await wait(900)

    configure({ reducedMotion: 'always' })
    begin(grip)
    pan(grip, 2, point.x, point.y)
    await wait(60)
    near(located(card).y, start.y + point.y, 'Reduced motion changed direct tracking')
    pan(grip, 3, point.x, point.y)
    await wait(80)
    assert(rejected === 2, 'Reduced-motion release was not rejected')
    near(presentedY(card), 0, 'Reduced motion did not return at once')
    configure({ reducedMotion: 'never' })

    zones.pause()
    assert(
      !grip.getGestureObservers(GestureTypes.pan)?.length,
      'Paused handle kept its pan',
    )
    const paused = moves.length
    pan(grip, 2, 20, 20)
    assert(moves.length === paused, 'Paused drop zones reported a move')
    zones.play()
    assert(
      grip.getGestureObservers(GestureTypes.pan)?.length === 1,
      'Play did not reattach',
    )
    scope.dispose()
    assert(zones.disposed, 'Scope did not dispose the drop zones')
    assert(!grip.getGestureObservers(GestureTypes.pan)?.length, 'Disposal left a pan')
    return { moves: moves.length, dropped, rejected, start, target }
  } finally {
    configure({ reducedMotion: 'never' })
    scope.dispose()
    host.removeChild(board)
  }
}
