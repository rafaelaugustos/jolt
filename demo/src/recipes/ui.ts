import { Button, Color, Label, Page } from '@nativescript/core'

export function page() {
  const view = new Page()
  view.actionBarHidden = true
  view.backgroundColor = new Color('#F4F0E7')
  return view
}
export function label(text: string, size = 20) {
  const view = new Label()
  Object.assign(view, {
    text,
    fontSize: size,
    color: '#193D34',
    textWrap: true,
    margin: 16,
  })
  return view
}
export function button(text: string, action: () => void) {
  const view = new Button()
  Object.assign(view, {
    text,
    accessibilityLabel: text,
    height: 50,
    margin: 8,
    color: '#193D34',
    backgroundColor: '#D6E7B5',
  })
  view.on('tap', action)
  return view
}
