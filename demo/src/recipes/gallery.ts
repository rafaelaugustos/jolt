import {
  GridLayout,
  Image,
  ListView,
  StackLayout,
  knownFolders,
  type Frame,
  type View,
} from '@nativescript/core'
import { zoomable, type Zoomable } from '@rafaelaugusto/jolt'
import {
  resolveListTarget,
  sharedNavigationEntry,
} from '@rafaelaugusto/jolt/shared-navigation'
import { button, label, page } from './ui'

/** Search only current native children; a recycled cell is never a saved identity. */
function currentImage(view: View, tag: string): Image | undefined {
  if (view instanceof Image && view.sharedTransitionTag === tag) return view
  let found: Image | undefined
  view.eachChildView((child) => {
    found = currentImage(child, tag)
    return !found
  })
  return found
}

export function galleryRecipe(frame: Frame) {
  const screen = page(),
    root = new GridLayout(),
    list = new ListView()
  root.rows = 'auto,*'
  screen.content = root
  const heading = label('A complete gallery recipe')
  root.addChild(heading)
  const pictures = ['cove', 'dunes'].map(
    (name) => `${knownFolders.currentApp().path}/assets/studio/${name}.png`,
  )
  let items = Array.from({ length: 60 }, (_, i) => ({
    key: `place-${i + 1}`,
    source: pictures[i % 2]!,
  }))
  list.row = 1
  list.rowHeight = 142
  list.items = items
  list.automationText = 'recipe-gallery-list'
  const tag = (key: string) => `recipe:${key}`
  list.on('itemLoading', (event) => {
    const photo = (event.view as Image) ?? new Image(),
      item = items[event.index]!
    Object.assign(photo, {
      src: item.source,
      height: 126,
      width: 260,
      margin: 8,
      stretch: 'aspectFill',
      sharedTransitionTag: tag(item.key),
      automationText: `recipe-${item.key}`,
      accessibilityLabel: `Open ${item.key}`,
    })
    event.view = photo
  })
  root.addChild(list)
  let opening = false
  list.on('itemTap', async (event) => {
    if (opening) return
    opening = true
    const item = items[event.index]!
    let viewer: Zoomable | undefined
    const detail = page(),
      host = new GridLayout(),
      viewport = new GridLayout()
    const backdrop = new GridLayout(),
      chrome = new StackLayout(),
      photo = new Image()
    host.rows = '*,auto'
    detail.content = host
    viewport.clipToBounds = true
    backdrop.rowSpan = 2
    backdrop.backgroundColor = '#102922'
    chrome.row = 1
    photo.src = item.source
    photo.stretch = 'aspectFit'
    photo.sharedTransitionTag = tag(item.key)
    photo.automationText = 'recipe-detail-photo'
    viewport.addChild(photo)
    host.addChild(backdrop)
    host.addChild(viewport)
    host.addChild(chrome)
    const entry = sharedNavigationEntry(frame, {
      tag: tag(item.key),
      canBegin: () => !viewer || (viewer.state.scale <= 1.001 && !viewer.state.pending),
      back: (options) => {
        if (!frame.canGoBack()) return false
        Object.assign(frame.currentEntry!, options)
        frame.goBack()
        return true
      },
      returnTarget: {
        key: item.key,
        fallbackFocus: () => heading,
        resolve: (context) =>
          resolveListTarget(context, {
            list,
            indexOf: (key) => items.findIndex((value) => value.key === key),
            viewForKey: (key) => currentImage(list, tag(key)),
          }),
      },
    })
    chrome.addChild(button('Zoom photo', () => viewer?.zoomTo(2.5)))
    chrome.addChild(button('Reset photo', () => viewer?.reset()))
    chrome.addChild(
      button('Move photo to end', () => {
        items = [...items.filter((value) => value.key !== item.key), item]
        list.items = items
      }),
    )
    chrome.addChild(button('Close photo', () => viewer?.requestDismiss()))
    detail.on('unloaded', () => viewer?.dispose())
    try {
      const opened = await entry.open((options) =>
        frame.navigate({ create: () => detail, ...options }),
      )
      if (!opened.navigated || frame.currentPage !== detail) {
        entry.dispose()
        return
      }
      viewer = zoomable(photo, {
        viewport,
        backdrop,
        chrome,
        dismiss: 'vertical',
        async onDismiss(intent) {
          const result = await entry.returnToSource({
            velocity: { x: 0, y: intent.velocity },
          })
          if (!result.navigated) intent.cancel()
        },
      })
    } catch (error) {
      entry.dispose()
      throw error
    } finally {
      opening = false
    }
  })
  return screen
}
