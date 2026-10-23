import { GridLayout, Label, ScrollView, StackLayout, isIOS } from '@nativescript/core'
import { bind, motionScope, type SpringValue } from '@rafaelaugusto/jolt'
import { GestureSurface, gestures } from '@rafaelaugusto/jolt/gestures'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
export async function runGestureLifecycleChecks(host: StackLayout) {
  const assert = (value: unknown, message: string) => {
    if (!value) throw new Error(message)
  }
  const count = () =>
    isIOS ? JoltLiveSpring.nodeCount() : org.rafaelaugusto.jolt.LiveSpring.nodeCount()
  const baseline = count(),
    scope = motionScope()
  const container = new GridLayout()
  container.height = 160
  const surface = new GestureSurface()
  surface.height = 120
  const scroll = new ScrollView(),
    content = new StackLayout()
  for (let index = 0; index < 12; index++) {
    const label = new Label()
    label.text = `Gesture lifecycle ${index}`
    label.height = 40
    content.addChild(label)
  }
  scroll.content = content
  surface.addChild(scroll)
  container.addChild(surface)
  let scrollEvents = 0
  const listener = () => {
    scrollEvents++
  }
  scroll.on('scroll', listener)
  const control = scope.add(
    gestures(surface, {
      pan: { axis: 'y', bounds: { top: 0, bottom: 100 } },
      initial: { y: 20 },
      scrollView: scroll,
    }),
  )
  scope.use(() => bind(surface, { y: control.y }))
  host.addChild(container)
  try {
    await wait(150)
    assert(
      count() === baseline + 4,
      'Gesture controller did not retain four native values',
    )
    const proxy = isIOS ? (scroll.ios as UIScrollView).delegate : undefined
    scroll.off('scroll', listener)
    if (isIOS)
      assert(
        (scroll.ios as UIScrollView).delegate === proxy,
        'Removing the last Core listener removed gesture forwarding',
      )
    scroll.on('scroll', listener)
    if (isIOS)
      assert(
        (scroll.ios as UIScrollView).delegate === proxy,
        'Adding a Core listener replaced gesture forwarding',
      )
    control.jumpTo({ y: 10 })
    assert(control.y.get() === 10, 'Native gesture jump did not update its value')
    control.settleTo({ y: 90 })
    await wait(100)
    const y = control.y as SpringValue
    const position = y.get(),
      velocity = y.getVelocity()
    assert(position > 10 && velocity > 0, 'Gesture settling did not run natively')
    control.updateBounds({ top: 0, bottom: 40 })
    control.settleTo({ y: 40 })
    assert(
      Math.abs(y.get() - position) < 0.001 &&
        Math.abs(y.getVelocity() - velocity) < 0.001,
      'Moving a snap target reset gesture position or velocity',
    )
    await wait(1500)
    assert(Math.abs(y.get() - 40) < 0.01, 'Gesture value did not settle at the new bound')
    control.settleTo({ y: 0 })
    await wait(80)
    scope.suspend()
    const held = y.get()
    await wait(120)
    assert(
      Math.abs(y.get() - held) < 0.001,
      'Scope suspension did not freeze a gesture release',
    )
    scope.resume()
    scope.dispose()
    if (isIOS)
      assert(
        (scroll.ios as UIScrollView).delegate !== proxy &&
          !!(scroll.ios as UIScrollView).delegate,
        'Disposal did not restore Core scroll delegation',
      )
    scrollEvents = 0
    scroll.scrollToVerticalOffset(80, false)
    await wait(100)
    assert(scrollEvents > 0, 'The existing Core scroll listener stopped receiving events')
    assert(count() === baseline, 'Gesture controller leaked native value nodes')
    return { position, velocity, held, scrollEvents }
  } finally {
    scope.dispose()
    scroll.off('scroll', listener)
    host.removeChild(container)
  }
}
