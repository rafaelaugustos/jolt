import { Application, ApplicationSettings, Device } from '@nativescript/core'
import { computed, ref } from 'nativescript-vue'
import {
  languagePreference,
  resolveLocale,
  translate,
  type LanguagePreference,
} from './locale'

const preferenceKey = 'jolt.showcase.language'
const previewEnabled = ref(false)
export function enablePreviewLanguage(enabled: boolean) {
  previewEnabled.value = enabled
  refreshSystemLanguage()
}
export const preference = ref(
  languagePreference(ApplicationSettings.getString(preferenceKey, 'system')),
)
const systemLanguage = ref(Device.language || 'en')
export const locale = computed(() =>
  resolveLocale(preference.value, systemLanguage.value),
)
export const t = (source: unknown) => translate(source, locale.value)

export function setLanguage(value: LanguagePreference) {
  preference.value = languagePreference(value)
  if (preference.value === 'system') ApplicationSettings.remove(preferenceKey)
  else ApplicationSettings.setString(preferenceKey, preference.value)
  refreshSystemLanguage()
}

export function refreshSystemLanguage() {
  systemLanguage.value = Device.language || 'en'
}
Application.on(Application.resumeEvent, refreshSystemLanguage)

// The isolated technical playground retains its English fixtures and probes.
export function usePreviewI18n() {
  return {
    t: (source: unknown) => (previewEnabled.value ? t(source) : String(source ?? '')),
    locale: computed(() => (previewEnabled.value ? locale.value : 'en')),
  }
}
