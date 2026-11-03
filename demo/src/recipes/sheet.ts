import { GridLayout, ScrollView, StackLayout, TextField } from '@nativescript/core'
import {
  bottomSheet,
  GestureSurface,
  type BottomSheet,
} from '@rafaelaugusto/jolt/bottom-sheet'
import { button, label, page } from './ui'

export function sheetRecipe() {
  const screen = page(),
    root = new GridLayout(),
    base = new StackLayout()
  screen.content = root
  root.addChild(base)
  base.addChild(label('A complete sheet recipe'))
  let sheet: BottomSheet | undefined
  const open = button('Open sheet', () => sheet?.open('50%'))
  base.addChild(open)
  const backdrop = new GridLayout()
  backdrop.backgroundColor = '#102922'
  const panel = new GestureSurface()
  panel.rows = 'auto,*'
  panel.backgroundColor = '#F4F0E7'
  const handle = label('Drag to resize', 20)
  handle.automationText = 'recipe-sheet-handle'
  const scroll = new ScrollView(),
    content = new StackLayout()
  scroll.row = 1
  scroll.content = content
  scroll.automationText = 'recipe-sheet-scroll'
  content.addChild(
    button('Add content', () => content.addChild(label('One more useful row', 18))),
  )
  const field = new TextField()
  field.hint = 'Write a message'
  field.accessibilityLabel = 'Recipe message'
  field.margin = 16
  content.addChild(field)
  content.addChild(button('Close sheet', () => sheet?.dismiss()))
  for (let i = 1; i <= 16; i++) content.addChild(label(`Scrollable row ${i}`, 18))
  panel.addChild(handle)
  panel.addChild(scroll)
  root.addChild(backdrop)
  root.addChild(panel)
  root.on('loaded', () => {
    sheet ??= bottomSheet(panel, {
      handle,
      scrollView: scroll,
      backdrop,
      snap: ['content', '50%', '90%'],
      keyboard: 'follow',
      returnFocus: open,
    })
  })
  root.on('unloaded', () => {
    sheet?.dispose()
    sheet = undefined
  })
  return screen
}
