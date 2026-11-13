import { isIOS, type View } from '@nativescript/core'
import { nativeLiveNode, type LiveNode } from './live-spring-driver.js'

export interface NativeScrollSource {
  enabled(value: boolean): void
  observe(value: boolean): void
  refresh(): void
  snapshot(): { offset: number; updates: number; callbacks: number }
  dispose(): void
}
export type NativeScrollFactory = (
  view: View,
  node: LiveNode,
  axis: 'x' | 'y',
  rowHeight: number,
  changed: () => void,
) => NativeScrollSource
let override: NativeScrollFactory | undefined
export function setScrollSourceDriver(driver?: NativeScrollFactory) {
  override = driver
}
export function nativeScrollAvailable() {
  return (
    !!override ||
    (isIOS
      ? typeof JoltScrollSource !== 'undefined'
      : typeof org !== 'undefined' &&
        typeof org.rafaelaugusto?.jolt?.ScrollSource === 'function')
  )
}
export const createNativeScrollSource: NativeScrollFactory = (
  view,
  node,
  axis,
  rowHeight,
  changed,
) => {
  if (override) return override(view, node, axis, rowHeight, changed)
  const native = isIOS
    ? JoltScrollSource.attachNodeHorizontalChanged(
        view.nativeViewProtected,
        nativeLiveNode(node) as JoltLiveSpring,
        axis === 'x',
        changed,
      )
    : new org.rafaelaugusto.jolt.ScrollSource(
        view.nativeViewProtected,
        nativeLiveNode(node) as org.rafaelaugusto.jolt.LiveSpring,
        axis === 'x',
        rowHeight,
        new org.rafaelaugusto.jolt.ScrollSource.Listener({ changed }),
      )
  return {
    enabled: (value) => native.setEnabled(value),
    observe: (value) => native.setObserving(value),
    refresh: () => native.refresh(),
    snapshot: () => JSON.parse(native.snapshot()),
    dispose: () => native.dispose(),
  }
}
