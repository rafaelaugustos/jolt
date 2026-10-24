import type { View } from '@nativescript/core'

export interface ThemeSnapshot {
  revealNewContent(): void
  dispose(): void
}
export function captureTheme(view: View): ThemeSnapshot | undefined
