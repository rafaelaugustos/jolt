import { isIOS, type ListView, type View } from '@nativescript/core'
import { liveValueInput, type SpringValue } from '../motion-value.js'
import { nativeLiveNode } from '../live-spring-driver.js'
import type { ScrollHeaderGeometry } from './geometry.js'

export interface ScrollHeaderSnapshot {
  offset: number
  minimumOffset: number
  maximumOffset: number
  phase: 'expanded' | 'between' | 'collapsed'
  updates: number
  callbacks: number
  first: number
  visible: number
  total: number
}
export interface ScrollHeaderDriver {
  snapshot(): ScrollHeaderSnapshot
  configure(geometry: ScrollHeaderGeometry, reduced: boolean): void
  scroll(offset: number, animated: boolean): void
  enabled(value: boolean): void
  dispose(): void
}
export function createScrollHeaderDriver(
  list: ListView,
  value: SpringValue,
  views: { title: View; toolbarTitle: View; toolbar: View; diagnostic?: View },
  geometry: ScrollHeaderGeometry,
  reduced: boolean,
  onState: () => void,
): ScrollHeaderDriver {
  const input = liveValueInput(value),
    node = nativeLiveNode(input.node)
  const changed = () => {
    input.changed()
    onState()
  }
  const settings = () => JSON.stringify({ ...geometry, reduced })
  if (isIOS) {
    if (typeof JoltScrollHeader === 'undefined')
      throw new Error('Rebuild the native app to use scrollHeader().')
    const native =
      JoltScrollHeader.attachNodeTitleToolbarTitleToolbarDiagnosticOptionsOnState(
        list.ios,
        node as JoltLiveSpring,
        views.title.nativeViewProtected,
        views.toolbarTitle.nativeViewProtected,
        views.toolbar.nativeViewProtected,
        views.diagnostic?.nativeViewProtected ?? null,
        settings(),
        changed,
      )
    return {
      snapshot: () => JSON.parse(native.snapshot()),
      configure: (next, motion) => {
        geometry = next
        reduced = motion
        native.configure(settings())
      },
      scroll: (offset, animated) => native.scrollAnimated(offset, animated),
      enabled: (value) => native.setEnabled(value),
      dispose: () => native.dispose(),
    }
  }
  const Native = org.rafaelaugusto.jolt.ScrollHeader
  if (typeof Native !== 'function')
    throw new Error('Rebuild the native app to use scrollHeader().')
  const native = new Native(
    list.android,
    node as org.rafaelaugusto.jolt.LiveSpring,
    views.title.nativeViewProtected,
    views.toolbarTitle.nativeViewProtected,
    views.toolbar.nativeViewProtected,
    views.diagnostic?.nativeViewProtected ?? null,
    settings(),
    new org.rafaelaugusto.jolt.ScrollHeader.Listener({ changed }),
  )
  return {
    snapshot: () => JSON.parse(native.snapshot()),
    configure: (next, motion) => {
      geometry = next
      reduced = motion
      native.configure(settings())
    },
    scroll: (offset, animated) => native.scroll(offset, animated),
    enabled: (value) => native.setEnabled(value),
    dispose: () => native.dispose(),
  }
}
