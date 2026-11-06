import { isIOS, View } from '@nativescript/core'
import { registerNativeProperty } from '@rafaelaugusto/jolt/native'
export class PortableReveal extends View {
  override createNativeView() {
    return isIOS
      ? JoltRevealView.new()
      : new org.rafaelaugusto.jolt.fixture.RevealView(this._context)
  }
}
/** Uses the already compiled UIKit/Canvas demo property, with no JS frame setter. */
export const portableReveal = registerNativeProperty<number>({
  name: 'jolt.demo/portable-reveal',
  units: ['fraction'],
  platforms: ['ios', 'android'],
  spatial: true,
  encode: (value) => [value],
  decode: (values) => values[0]!,
  create: (target) =>
    isIOS
      ? JoltPropertySink.scalarTargetKeyPath(target as NSObject, 'reveal')
      : org.rafaelaugusto.jolt.PropertySink.scalar(target, 'getReveal', 'setReveal'),
})
declare global {
  class JoltRevealView extends UIView {
    reveal: number
  }
  namespace org.rafaelaugusto.jolt.fixture {
    class PointerReplay {
      static play(activity: android.app.Activity, target: android.view.View): void
    }
    class RevealView extends android.view.View {
      constructor(context: android.content.Context)
    }
  }
}
