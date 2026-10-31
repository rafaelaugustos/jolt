import { describe, expect, it, vi } from 'vitest'
import type { View } from '@nativescript/core'
import { hostInsets } from '../src/bottom-sheet/native.js'

vi.mock('@nativescript/core', async (original) => {
  const core = await original<typeof import('./shims/core.js')>()
  return {
    ...core,
    Utils: { layout: { toDeviceIndependentPixels: (value: number) => value / 3 } },
  }
})

describe('bottom sheet host insets', () => {
  it('converts the device-pixel insets Core reports on iOS into DIPs', () => {
    const host = {
      getSafeAreaInsets: () => ({ top: 186, bottom: 102 }),
    } as unknown as View
    expect(hostInsets(host)).toEqual({ top: 62, bottom: 34 })
    const flat = { getSafeAreaInsets: () => ({ top: 0, bottom: 0 }) } as unknown as View
    expect(hostInsets(flat)).toEqual({ top: 0, bottom: 0 })
  })
})
