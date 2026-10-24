export type ColorMode = 'light' | 'dark'
export type ThemePreference = ColorMode | 'system'

export function themePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveColorMode(
  preference: ThemePreference,
  system: unknown,
): ColorMode {
  return preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference
}

export const palettes = {
  light: {
    background: '#F6F5F0',
    text: '#20242D',
    muted: '#687260',
    subtle: '#77816D',
    surface: '#EAEAE3',
    raised: '#F0F0E9',
    border: '#DDE2D5',
    control: '#E4E8DD',
    controlText: '#34432E',
    selected: '#24392D',
    selectedText: '#F4F4E7',
    selectedMuted: '#B9C9AE',
    lavender: '#E9E7F2',
    sage: '#E7EDD8',
    peach: '#F0E7DA',
    badgeText: '#343C36',
  },
  dark: {
    background: '#151C1A',
    text: '#EFF3E9',
    muted: '#B0BBA8',
    subtle: '#9AA98F',
    surface: '#28332C',
    raised: '#202A24',
    border: '#3C493E',
    control: '#303E33',
    controlText: '#DCE7D0',
    selected: '#E3FC62',
    selectedText: '#1C2B1F',
    selectedMuted: '#42522D',
    lavender: '#373242',
    sage: '#303D2C',
    peach: '#3B3429',
    badgeText: '#E2E9D8',
  },
} as const
