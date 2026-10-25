import { ReturnScope, type SharedReturnSignal } from './return-signal.js'
import {
  Application,
  isIOS,
  type ListView,
  type Page,
  type View,
} from '@nativescript/core'
import { getDriver } from '../driver/index.js'
import { find } from './targets.js'

export interface SharedReturnContext {
  readonly key: string
  readonly tag: string
  readonly page: Page
  readonly signal: SharedReturnSignal
}
export interface SharedReturnTarget {
  /** Stable item identity, independent of its current list position or native cell. */
  key: string
  resolve(
    context: SharedReturnContext,
  ): View | undefined | null | Promise<View | undefined | null>
  /** Includes realization, scrolling and final layout. Default 1500 ms; maximum 5000. */
  timeout?: number
  /** Accessible fallback when the original item was deleted. Must belong to the returned page. */
  fallbackFocus?: (page: Page) => View | undefined
}
export type ReturnResolution = { view?: View; reason?: string }
export function validateReturnTarget(target: SharedReturnTarget | undefined) {
  if (!target) return
  if (
    typeof target.key !== 'string' ||
    !target.key.trim() ||
    typeof target.resolve !== 'function'
  )
    throw new TypeError('A return target needs a stable nonempty key and resolver.')
  const timeout = target.timeout ?? 1500
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 5000)
    throw new RangeError('Return target timeout must be positive and at most 5000 ms.')
  if (target.fallbackFocus !== undefined && typeof target.fallbackFocus !== 'function')
    throw new TypeError('fallbackFocus must be a function.')
}
export function afterReturnLayout(view: View, signal: SharedReturnSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let detach: (() => void) | undefined,
      done = false
    const finish = (error?: Error) => {
      if (done) return
      done = true
      detach?.()
      signal.removeEventListener('abort', abort)
      error ? reject(error) : resolve()
    }
    const abort = () => finish(new Error('return-cancelled'))
    if (signal.aborted) {
      abort()
      return
    }
    signal.addEventListener('abort', abort, { once: true })
    const driver = getDriver()
    if (!driver.afterLayout) {
      finish(new Error('unsupported-layout'))
      return
    }
    try {
      detach = driver.afterLayout(view, () => finish())
      if (done) detach?.()
      else view.requestLayout()
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)))
    }
  }).then(() => {
    if (signal.aborted) throw new Error('return-cancelled')
    // Core's measure/layout and UIKit's deferred table-cell realization are
    // separate boundaries. Flush the latter while JS-backed delegates can run,
    // including a deleted-item return where no scrollToIndex call will follow.
    if (isIOS) view.nativeViewProtected?.layoutIfNeeded?.()
  })
}
export async function resolveReturnTarget(
  target: SharedReturnTarget,
  tag: string,
  page: Page,
  signal: SharedReturnSignal,
): Promise<ReturnResolution> {
  const scope = new ReturnScope()
  const abort = () => scope.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) scope.abort()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const cancelled = new Promise<ReturnResolution>((resolve) => {
      const end = () => resolve({ reason: 'target-cancelled' })
      scope.signal.addEventListener('abort', end, { once: true })
      if (scope.signal.aborted) end()
    })
    const expired = new Promise<ReturnResolution>((resolve) => {
      timer = setTimeout(() => {
        resolve({ reason: 'target-timeout' })
        scope.abort()
      }, target.timeout ?? 1500)
    })
    const run = async (): Promise<ReturnResolution> => {
      await afterReturnLayout(page, scope.signal)
      const view = await target.resolve({
        key: target.key,
        tag,
        page,
        signal: scope.signal,
      })
      if (scope.signal.aborted) return { reason: 'target-cancelled' }
      if (!view) return { reason: 'missing-target' }
      await afterReturnLayout(page, scope.signal)
      const matches = find(page, tag, true)
      if (matches.length !== 1)
        return { reason: matches.length ? 'duplicate-target' : 'missing-target' }
      if (matches[0] !== view || !view.isLoaded) return { reason: 'stale-target' }
      return { view }
    }
    return await Promise.race([
      run().catch(() => ({
        reason: scope.signal.aborted ? 'target-cancelled' : 'target-resolution-failed',
      })),
      expired,
      cancelled,
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    signal.removeEventListener('abort', abort)
    scope.abort()
  }
}

/** Resolve a Core ListView cell after scrolling by the current key, never a saved native view/index. */
export async function resolveListTarget(
  context: SharedReturnContext,
  options: {
    list: ListView
    indexOf(key: string): number
    viewForKey(key: string): View | undefined
  },
): Promise<View | undefined> {
  const { list, indexOf, viewForKey } = options
  for (let attempt = 0; attempt < 4 && !context.signal.aborted; attempt++) {
    const index = indexOf(context.key)
    if (!Number.isSafeInteger(index) || index < 0) return
    list.scrollToIndex(index)
    await afterReturnLayout(list, context.signal)
    if (indexOf(context.key) !== index) continue
    const view = viewForKey(context.key)
    if (view?.sharedTransitionTag === context.tag) return view
  }
}
export function focusReturnTarget(page: Page, view: View | undefined) {
  if (!view || !view.isLoaded || view.page !== page) return
  try {
    const native = view.nativeViewProtected
    if (isIOS) {
      if (UIAccessibilityIsVoiceOverRunning())
        UIAccessibilityPostNotification(UIAccessibilityLayoutChangedNotification, native)
    } else {
      const manager = Application.android.context?.getSystemService(
        android.content.Context.ACCESSIBILITY_SERVICE,
      ) as android.view.accessibility.AccessibilityManager | undefined
      if (manager?.isTouchExplorationEnabled())
        native?.performAccessibilityAction(
          android.view.accessibility.AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS,
          null,
        )
    }
  } catch {
    /* Focus cannot change the navigation outcome. */
  }
}
