import { GridLayout, Label, ListView } from '@nativescript/core'
import { animateItems } from '@rafaelaugusto/jolt'
import { button, label, page } from './ui'

export function listRecipe() {
  const screen = page(),
    root = new GridLayout(),
    list = new ListView()
  root.rows = 'auto,auto,*'
  screen.content = root
  root.addChild(label('A complete list recipe'))
  let generation = 0
  const rows = () =>
    Array.from({ length: 100 }, (_, i) => ({
      title: `Collection ${generation} · item ${i + 1}`,
    }))
  list.items = rows()
  list.row = 2
  list.rowHeight = 68
  list.iosEstimatedRowHeight = 68
  list.automationText = 'recipe-list'
  list.on('itemLoading', (event) => {
    const row = (event.view as GridLayout) ?? new GridLayout()
    row.height = 68
    if (!row.getChildrenCount()) row.addChild(label('', 18))
    ;(row.getChildAt(0) as Label).text = (list.items as { title: string }[])[
      event.index
    ]!.title
    event.view = row
  })
  const replace = button('Replace items', () => {
    generation++
    list.items = rows()
  })
  replace.row = 1
  root.addChild(replace)
  root.addChild(list)
  let unlink: (() => void) | undefined
  list.on('loaded', () => {
    // Core 9.1.3 can detach a prefetched UIKit cell before it is displayed.
    if (__IOS__) list.ios.prefetchingEnabled = false
    unlink?.()
    unlink = animateItems(list, 'fadeIn', { once: true, duration: 350 })
  })
  list.on('unloaded', () => {
    unlink?.()
    unlink = undefined
  })
  return screen
}
