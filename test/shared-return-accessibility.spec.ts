import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Page, View } from '@nativescript/core'

describe.each(['ios', 'android'] as const)(
  '%s return accessibility ownership',
  (platform) => {
    let api: typeof import('../src/shared-navigation/return-target.js')
    let queue: (() => void)[]
    let enabled: boolean
    let announce: ReturnType<typeof vi.fn>
    let page: Page, target: View, native: any, root: any
    beforeEach(async () => {
      vi.resetModules()
      queue = []
      enabled = true
      announce = vi.fn()
      vi.doMock('@nativescript/core', async (original) => ({
        ...(await original<object>()),
        isIOS: platform === 'ios',
        isAndroid: platform === 'android',
        Application: {
          android: {
            context: {
              getSystemService: () => ({ isTouchExplorationEnabled: () => enabled }),
            },
          },
        },
      }))
      vi.stubGlobal('UIAccessibilityIsVoiceOverRunning', () => enabled)
      vi.stubGlobal('UIAccessibilityLayoutChangedNotification', 8)
      vi.stubGlobal('UIAccessibilityPostNotification', announce)
      vi.stubGlobal('NSOperationQueue', {
        mainQueue: { addOperationWithBlock: (f: () => void) => queue.push(f) },
      })
      vi.stubGlobal('java', {
        lang: {
          Runnable: class {
            run: () => void
            constructor(o: { run: () => void }) {
              this.run = o.run
            }
          },
        },
      })
      vi.stubGlobal('android', {
        content: { Context: { ACCESSIBILITY_SERVICE: 'accessibility' } },
        view: {
          View: { IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS: 4 },
          accessibility: { AccessibilityNodeInfo: { ACTION_ACCESSIBILITY_FOCUS: 64 } },
        },
      })
      root = {
        accessibilityElementsHidden: false,
        importance: 0,
        getImportantForAccessibility() {
          return this.importance
        },
        setImportantForAccessibility(value: number) {
          this.importance = value
        },
      }
      page = { nativeViewProtected: root } as Page
      ;(page as any).frame = { currentPage: page }
      native = {
        post: (r: { run: () => void }) => queue.push(r.run),
        performAccessibilityAction: announce,
      }
      target = {
        isLoaded: true,
        page,
        nativeViewProtected: native,
        sharedTransitionTag: 'photo:42',
      } as View
      api = await import('../src/shared-navigation/return-target.js')
    })
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.doUnmock('@nativescript/core')
    })
    const field = platform === 'ios' ? 'accessibilityElementsHidden' : 'importance'
    const hidden = platform === 'ios' ? true : 4
    const original = platform === 'ios' ? false : 0
    it('hides the destination during realization, restores it, then focuses after the native turn', () => {
      const restore = api.suppressReturnAccessibility(page)
      expect(root[field]).toBe(hidden)
      restore()
      expect(root[field]).toBe(original)
      api.focusReturnTarget(page, target)
      expect(announce).not.toHaveBeenCalled()
      expect(queue).toHaveLength(1)
      queue[0]!()
      expect(announce).toHaveBeenCalledOnce()
      expect(announce).toHaveBeenCalledWith(
        platform === 'ios' ? 8 : 64,
        platform === 'ios' ? native : null,
      )
    })
    it('leaves a reader-disabled destination untouched', () => {
      enabled = false
      api.suppressReturnAccessibility(page)()
      expect(root[field]).toBe(original)
      api.focusReturnTarget(page, target)
      queue[0]!()
      expect(announce).not.toHaveBeenCalled()
    })
    it('preserves app-owned hidden state', () => {
      root[field] = hidden
      api.suppressReturnAccessibility(page)()
      expect(root[field]).toBe(hidden)
    })
    it('does not overwrite an app change made during the return', () => {
      const restore = api.suppressReturnAccessibility(page)
      root[field] = platform === 'ios' ? false : 2
      restore()
      expect(root[field]).toBe(platform === 'ios' ? false : 2)
    })
    it.each([
      'unload',
      'recycle',
      'replace-native',
      'new-route',
      'new-page',
      'reader-disabled',
    ])('skips queued focus after %s', (change) => {
      api.focusReturnTarget(page, target)
      if (change === 'unload') (target as any).isLoaded = false
      if (change === 'recycle') target.sharedTransitionTag = 'photo:99'
      if (change === 'replace-native') (target as any).nativeViewProtected = {}
      if (change === 'new-route') (page as any).frame.currentPage = {}
      if (change === 'new-page') (target as any).page = {}
      if (change === 'reader-disabled') enabled = false
      queue[0]!()
      expect(announce).not.toHaveBeenCalled()
    })
    it('keeps a native focus failure outside the navigation outcome', () => {
      announce.mockImplementation(() => {
        throw new Error('detached')
      })
      api.focusReturnTarget(page, target)
      expect(() => queue[0]!()).not.toThrow()
    })
  },
)
