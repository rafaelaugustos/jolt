import { isIOS, type ListView, type ScrollView, type View } from '@nativescript/core'
import { liveValueInput, type SpringValue } from '../motion-value.js'
import { nativeLiveNode } from '../live-spring-driver.js'
import type { ScrollHeaderGeometry } from './geometry.js'

export interface ScrollHeaderSnapshot {
  offset: number
  minimumOffset: number
  maximumOffset: number
  phase: 'expanded' | 'between' | 'collapsed'
  refresh: 'idle' | 'pulling' | 'armed' | 'refreshing'
  refreshRequests: number
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
  refreshing(value: boolean): void
  rows(views: readonly View[]): void
  dispose(): void
}
export function createScrollHeaderDriver(
  list: ListView | ScrollView,
  value: SpringValue,
  views: {
    header: View
    title: View
    toolbarTitle: View
    toolbar: View
    diagnostic?: View
  },
  geometry: ScrollHeaderGeometry,
  reduced: boolean,
  onState: () => void,
  refresh = { enabled: false, threshold: 80 },
): ScrollHeaderDriver {
  const input = liveValueInput(value),
    node = nativeLiveNode(input.node)
  const changed = () => {
    input.changed()
    onState()
  }
  const settings = () =>
    JSON.stringify({
      ...geometry,
      reduced,
      refresh: refresh.enabled,
      refreshThreshold: refresh.threshold,
    })
  if (isIOS) {
    if (typeof JoltScrollHeader === 'undefined')
      throw new Error('Rebuild the native app to use scrollHeader().')
    const native =
      JoltScrollHeader.attachNodeHeaderTitleToolbarTitleToolbarDiagnosticOptionsOnState(
        list.ios,
        node as JoltLiveSpring,
        views.header.nativeViewProtected,
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
      refreshing: (value) => native.setRefreshing(value),
      rows: (views) =>
        native.setRows(
          NSArray.arrayWithArray(views.map((view) => view.nativeViewProtected)),
        ),
      dispose: () => native.dispose(),
    }
  }
  const Native = org.rafaelaugusto.jolt.ScrollHeader
  if (typeof Native !== 'function')
    throw new Error('Rebuild the native app to use scrollHeader().')
  const native = new Native(
    list.android,
    node as org.rafaelaugusto.jolt.LiveSpring,
    views.header.nativeViewProtected,
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
    refreshing: (value) => native.setRefreshing(value),
    rows: (views) => {
      const rows = Array.create('android.view.View', views.length)
      views.forEach((view, index) => {
        rows[index] = view.nativeViewProtected
      })
      native.setRows(rows)
    },
    dispose: () => native.dispose(),
  }
}
