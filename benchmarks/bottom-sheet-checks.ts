import {
  Utils,
  isAndroid,
  isIOS,
  type GridLayout,
  type ScrollView,
  type TextField,
  type View,
} from '@nativescript/core'
import { configure, onKeyboard } from '@rafaelaugusto/jolt'
import type { BottomSheet, GestureSurface } from '@rafaelaugusto/jolt/bottom-sheet'
import { windowHeight } from '../src/bottom-sheet/native'

export const bottomSheetNodeCount = () =>
  isIOS ? JoltLiveSpring.nodeCount() : org.rafaelaugusto.jolt.LiveSpring.nodeCount()
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
function nativeY(panel: View): number {
  if (isIOS) {
    const view = panel.nativeViewProtected as UIView
    return (view.layer.presentationLayer() ?? view.layer).frame.origin.y
  }
  return (
    (panel.nativeViewProtected as android.view.View).getY() /
    Utils.layout.getDisplayDensity()
  )
}
function accessibility(handle: View, label: string): void {
  const observed: string[] = []
  if (isIOS) {
    const actions = (handle.nativeViewProtected as UIView).accessibilityCustomActions
    if (actions)
      for (let i = 0; i < actions.count; i++) {
        const action = actions.objectAtIndex(i)
        if (action.name === label && action.actionHandler) {
          action.actionHandler(action)
          return
        }
      }
  } else {
    const view = handle.nativeViewProtected as android.view.View
    const node = view.createAccessibilityNodeInfo(),
      actions = node.getActionList()
    try {
      for (let i = 0; i < actions.size(); i++) {
        const action = actions.get(i)
        observed.push(`${action.getId()}: ${String(action.getLabel())}`)
        if (
          String(action.getLabel()) === label &&
          view.performAccessibilityAction(action.getId(), null)
        )
          return
      }
    } finally {
      node.recycle()
    }
  }
  throw new Error(
    `Missing native accessibility action: ${label}; observed ${observed.join(', ')}`,
  )
}

/** Real native measurements. OS touch/scroll and recordings run separately. */
export async function runBottomSheetChecks(input: {
  sheet: BottomSheet
  host: GridLayout
  panel: GestureSurface
  handle: View
  scroll: ScrollView
  field: TextField
  grow(amount?: number): void
  baselineNodes: number
  runId: string
}) {
  const { sheet, host, panel, handle, scroll, field, grow, baselineNodes } = input
  let keyboard = { visible: false, height: 0 }
  const offKeyboard = onKeyboard((state) => {
    keyboard = state
  })
  const checks: string[] = [],
    samples: Record<string, number>[] = []
  let stage = 'open and native snap'
  const assert = (value: unknown, message: string) => {
    if (!value) throw new Error(message)
  }
  const near = (actual: number, expected: number, tolerance = 3) => {
    samples.push({ actual, expected, tolerance })
    assert(
      Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
      `${actual} != ${expected} ± ${tolerance}`,
    )
  }
  const deadline = async (condition: () => boolean, milliseconds = 5000) => {
    const end = Date.now() + milliseconds
    while (!condition() && Date.now() < end) await wait(50)
    assert(condition(), `Timed out: ${stage}`)
  }
  const originalHeight = host.height
  try {
    await deadline(() => host.getActualSize().height > 200)
    sheet.open('50%')
    await wait(1000)
    near(nativeY(panel), host.getActualSize().height * 0.5)
    assert(
      bottomSheetNodeCount() === baselineNodes + 4,
      'Expected four retained gesture nodes',
    )
    checks.push(stage)

    stage = 'small content resolves its intrinsic height'
    sheet.open('content')
    await wait(1000)
    near(nativeY(panel), host.getActualSize().height - (3 * 76 + 152))
    checks.push(stage)

    stage = 'rapid close and reopen preserve the visible position'
    sheet.dismiss()
    await wait(80)
    const before = nativeY(panel)
    sheet.open('90%')
    near(nativeY(panel), before, 1)
    await wait(1000)
    near(nativeY(panel), host.getActualSize().height * 0.1)
    checks.push(stage)

    stage = 'growing content retargets its logical snap'
    sheet.open('content')
    await wait(80)
    const growing = nativeY(panel)
    grow(12)
    near(nativeY(panel), growing, 1)
    await wait(1200)
    assert(sheet.snapPoint === 'content', 'Content growth changed the logical snap')
    near(nativeY(panel), 0)
    checks.push(stage)

    stage = 'usable-window resize'
    sheet.open('50%')
    await wait(900)
    host.height = host.getActualSize().height * 0.8
    await wait(1000)
    near(nativeY(panel), host.getActualSize().height * 0.5)
    host.height = originalHeight
    await wait(1000)
    near(nativeY(panel), host.getActualSize().height * 0.5)
    checks.push(stage)

    stage = 'keyboard preserves focused input and keeps it visible'
    field.text = 'A quiet weekend'
    field.focus()
    if (isAndroid) {
      const view = field.nativeViewProtected as android.widget.EditText
      const manager = view
        .getContext()
        .getSystemService(
          android.content.Context.INPUT_METHOD_SERVICE,
        ) as android.view.inputmethod.InputMethodManager
      manager.showSoftInput(
        view,
        android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT,
      )
    }
    await deadline(() => keyboard.visible)
    await wait(900)
    assert(field.text === 'A quiet weekend', 'Keyboard changed the field text')
    assert(
      isIOS
        ? (field.nativeViewProtected as UIView).isFirstResponder
        : (field.nativeViewProtected as android.view.View).hasFocus(),
      'Keyboard transition lost input focus',
    )
    near(nativeY(panel), 0)
    const fieldBottom = field.getLocationInWindow().y + field.getActualSize().height
    assert(
      fieldBottom <= windowHeight(host) - keyboard.height + 3,
      'Focused field is covered by the keyboard',
    )
    assert(sheet.snapPoint === '50%', 'Keyboard overwrote the selected snap')
    checks.push(stage)

    stage = 'keyboard dismissal restores the selected snap'
    field.dismissSoftInput()
    await deadline(() => !keyboard.visible)
    await wait(900)
    near(nativeY(panel), host.getActualSize().height * 0.5)
    assert(field.text === 'A quiet weekend', 'Keyboard dismissal lost input text')
    checks.push(stage)

    stage = 'native accessibility expand and collapse actions'
    accessibility(handle, 'Expand')
    assert(sheet.snapPoint === '90%', 'Expand action did not choose the next stop')
    await wait(900)
    near(nativeY(panel), host.getActualSize().height * 0.1)
    accessibility(handle, 'Collapse')
    await wait(900)
    assert(sheet.snapPoint === '50%', 'Collapse action did not choose the previous stop')
    checks.push(stage)

    stage = 'reduced motion'
    configure({ reducedMotion: 'always' })
    sheet.open('content')
    await wait(100)
    near(nativeY(panel), 0)
    configure({ reducedMotion: 'user' })
    checks.push(stage)

    stage = 'unload reload and disposal release native ownership'
    host.removeChild(panel)
    await wait(100)
    assert(bottomSheetNodeCount() === baselineNodes, 'Unloading retained sheet nodes')
    host.addChild(panel)
    await wait(1000)
    assert(
      bottomSheetNodeCount() === baselineNodes + 4,
      'Reload did not reattach one gesture session',
    )
    let scrollEvents = 0
    const changed = () => scrollEvents++
    scroll.on('scroll', changed)
    sheet.dispose()
    // A standalone existing scroll listener must still work after disposing the recipe.
    panel.visibility = 'visible'
    scroll.scrollToVerticalOffset(150, false)
    await wait(100)
    scroll.off('scroll', changed)
    assert(scrollEvents > 0, 'Disposal broke the existing scroll delegate/listener')
    assert(bottomSheetNodeCount() === baselineNodes, 'Disposal leaked native nodes')
    panel.visibility = 'hidden'
    checks.push(stage)
    return {
      schema: 1,
      runId: input.runId,
      status: 'passed',
      platform: isIOS ? 'ios' : 'android',
      checks,
      samples,
    }
  } catch (error) {
    return {
      schema: 1,
      runId: input.runId,
      status: 'failed',
      platform: isIOS ? 'ios' : 'android',
      stage,
      error: String(error),
      checks,
      samples,
    }
  } finally {
    offKeyboard()
    configure({ reducedMotion: 'user' })
    host.height = originalHeight
    sheet.dispose()
  }
}
