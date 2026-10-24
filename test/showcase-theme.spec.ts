import { describe, expect, it } from 'vitest'
import {
  palettes,
  resolveColorMode,
  themePreference,
} from '../demo/src/showcase/theme-model'

describe('showcase appearance', () => {
  it('defaults to the system and keeps explicit choices independent of system changes', () => {
    for (const value of [null, undefined, '', 'invalid'])
      expect(themePreference(value)).toBe('system')
    expect(resolveColorMode('system', 'dark')).toBe('dark')
    expect(resolveColorMode('system', 'light')).toBe('light')
    expect(resolveColorMode('system', undefined)).toBe('light')
    expect(resolveColorMode('light', 'dark')).toBe('light')
    expect(resolveColorMode('dark', 'light')).toBe('dark')
  })

  it('keeps body text and controls readable in both appearances', () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
    }
    const contrast = (a: string, b: string) => {
      const x = luminance(a),
        y = luminance(b)
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
    }
    for (const palette of Object.values(palettes)) {
      for (const [foreground, background] of [
        [palette.text, palette.background],
        [palette.muted, palette.background],
        [palette.controlText, palette.control],
        [palette.text, palette.surface],
        [palette.selectedText, palette.selected],
        [palette.selectedMuted, palette.selected],
      ])
        expect(contrast(foreground!, background!)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
