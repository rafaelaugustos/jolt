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
import { hostInsets, windowHeight } from '../src/bottom-sheet/native'

export const bottomSheetNodeCount = () =>
  isIOS ? JoltLiveSpring.nodeCount() : org.rafaelaugusto.jolt.LiveSpring.nodeCount()
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
function nativeY(panel: View): number {
  return nativeFrame(panel).y
}
/** The panel's presented frame in its host, in DIPs. */
function nativeFrame(panel: View): { y: number; height: number } {
  if (isIOS) {
    const view = panel.nativeViewProtected as UIView
    const frame = (view.layer.presentationLayer() ?? view.layer).frame
    return { y: frame.origin.y, height: frame.size.height }
  }
  const view = panel.nativeViewProtected as android.view.View
  const density = Utils.layout.getDisplayDensity()
  return { y: view.getY() / density, height: view.getHeight() / density }
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
  /**
   * The host covers the whole window; checks follow the safe-area acceptance of #267.
   * Edge to edge, the host ignores Core's safe area and the sheet receives the page insets.
   */
  fullWindow?: { edgeToEdge: boolean; insets: { top: number; bottom: number } }
  /** The raw `sheet-safe-area` launch argument, kept in the report for provenance. */
  argument?: string
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
  const platform = isIOS ? 'ios' : 'android'
  const result = (status: 'passed' | 'failed', error?: string) => ({
    schema: 1,
    runId: input.runId,
    status,
    platform,
    variant: input.fullWindow
      ? input.fullWindow.edgeToEdge
        ? 'edge-to-edge'
        : 'full-window'
      : 'inset-host',
    argument: input.argument ?? null,
    ...(error === undefined ? {} : { stage, error }),
    checks,
    samples,
  })
  try {
    await deadline(() => host.getActualSize().height > 200)
    if (input.fullWindow) {
      const { edgeToEdge } = input.fullWindow
      const measured = hostInsets(host)
      const insets = edgeToEdge ? input.fullWindow.insets : measured
      // Core keeps a default host's children inside its insets, so the panel ends at the
      // bottom inset; an edge-to-edge host lets it reach the window edge.
      const edge = edgeToEdge ? 0 : insets.bottom
      const bottomEdge = () => {
        const frame = nativeFrame(panel)
        return frame.y + frame.height
      }
      stage = 'full-window host reports its safe-area insets in DIPs'
      assert(
        measured.top < 100 && measured.bottom < 100,
        `Implausible DIP insets ${JSON.stringify(measured)}`,
      )
      assert(
        !isIOS || edgeToEdge || measured.top > 0,
        'The full-window iOS host must extend under the status bar',
      )
      samples.push({ insetTop: insets.top, insetBottom: insets.bottom, edge })
      checks.push(stage)

      stage =
        'content snap reaches the window bottom with its content above the home indicator'
      sheet.open('content')
      await wait(1000)
      const window = host.getActualSize().height
      const measure = () => {
        const frame = nativeFrame(panel)
        samples.push({
          panelY: frame.y,
          panelHeight: frame.height,
          panelLayoutHeight: panel.getActualSize().height,
          scrollHeight: scroll.getActualSize().height,
          scrollTop: scroll.getLocationInWindow().y,
          paddingBottom: Number(panel.paddingBottom) || 0,
          effectivePaddingBottom: panel.effectivePaddingBottom,
          hostTop: host.getLocationInWindow().y,
          windowHeight: windowHeight(host),
          keyboardHeight: keyboard.height,
        })
      }
      measure()
      // The panel is sized for its largest stop, so its frame continues below the window.
      assert(
        bottomEdge() >= window - edge - 1,
        `Panel bottom ${bottomEdge()} stops above the window edge`,
      )
      near(nativeY(panel), window - insets.bottom - (3 * 76 + 152))
      checks.push(stage)

      stage = 'full snap starts below the status bar and still reaches the window bottom'
      sheet.open('100%')
      await wait(1000)
      measure()
      near(nativeY(panel), insets.top)
      near(bottomEdge(), window - edge)
      // Window coordinates start above the host on Android; compare with the host's bottom edge.
      const hostBottom = host.getLocationInWindow().y + window
      const scrollBottom = scroll.getLocationInWindow().y + scroll.getActualSize().height
      assert(
        scrollBottom <= hostBottom - insets.bottom + 2,
        `List bottom ${scrollBottom} reaches into the bottom inset below ${hostBottom}`,
      )
      checks.push(stage)

      stage = 'keyboard aligns the panel bottom with the keyboard top'
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
      measure()
      near(nativeY(panel), insets.top)
      // The keyboard height is a window measure; the panel bottom is relative to the host.
      near(
        host.getLocationInWindow().y + bottomEdge(),
        windowHeight(host) - keyboard.height,
      )
      const fieldBottom = field.getLocationInWindow().y + field.getActualSize().height
      assert(
        fieldBottom <= windowHeight(host) - keyboard.height + 3,
        'Focused field is covered by the keyboard',
      )
      field.dismissSoftInput()
      await deadline(() => !keyboard.visible)
      await wait(900)
      near(nativeY(panel), insets.top)
      near(bottomEdge(), window - edge)
      checks.push(stage)

      stage = 'disposal releases native ownership'
      sheet.dispose()
      await wait(100)
      assert(bottomSheetNodeCount() === baselineNodes, 'Disposal leaked native nodes')
      checks.push(stage)
      return result('passed')
    }
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
    return result('passed')
  } catch (error) {
    return result('failed', String(error))
  } finally {
    offKeyboard()
    configure({ reducedMotion: 'user' })
    host.height = originalHeight
    sheet.dispose()
  }
}
