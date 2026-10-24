import {
  Application,
  ApplicationSettings,
  isIOS,
  type EventData,
  type TextField,
  type SystemAppearanceChangedEventData,
} from '@nativescript/core'
import { computed, ref, watch } from 'nativescript-vue'
import {
  palettes,
  resolveColorMode,
  themePreference,
  type ThemePreference,
} from './theme-model'

const key = 'jolt.showcase.appearance'
export const appearance = ref(
  themePreference(ApplicationSettings.getString(key, 'system')),
)
const systemAppearance = ref(Application.systemAppearance())
export const colorMode = computed(() =>
  resolveColorMode(appearance.value, systemAppearance.value),
)
export const palette = computed(() => palettes[colorMode.value])
export const themeClass = computed(() => `studio-theme studio-${colorMode.value}`)
export const statusBarStyle = computed(() =>
  colorMode.value === 'dark' ? 'light' : 'dark',
)

export function setAppearance(value: ThemePreference) {
  appearance.value = themePreference(value)
  if (appearance.value === 'system') ApplicationSettings.remove(key)
  else ApplicationSettings.setString(key, appearance.value)
  refreshAppearance()
}

function refreshAppearance() {
  systemAppearance.value = Application.systemAppearance()
}
function changed(event: SystemAppearanceChangedEventData) {
  systemAppearance.value = event.newValue
}

// Observe only while the showcase is mounted; isolated native probes keep their styling.
export function observeAppearance() {
  refreshAppearance()
  Application.on(Application.systemAppearanceChangedEvent, changed)
  Application.on(Application.resumeEvent, refreshAppearance)
  return () => {
    Application.off(Application.systemAppearanceChangedEvent, changed)
    Application.off(Application.resumeEvent, refreshAppearance)
  }
}

// iOS otherwise keeps a light keyboard when the app explicitly chooses dark mode.
export function useThemedInput() {
  let field: TextField | undefined
  function update() {
    if (!isIOS || !field?.ios) return
    field.ios.keyboardAppearance =
      colorMode.value === 'dark' ? UIKeyboardAppearance.Dark : UIKeyboardAppearance.Light
    if (field.ios.isFirstResponder) field.ios.reloadInputViews()
  }
  watch(colorMode, update)
  return {
    loaded(event: EventData) {
      field = event.object as TextField
      update()
    },
    unloaded() {
      field = undefined
    },
  }
}
