/// <reference path="../../../src/ios-plugin.d.ts" />
/// <reference path="../../../src/android-plugin.d.ts" />
import {
  Application,
  Color,
  File,
  GridLayout,
  Image,
  ImageSource,
  ScrollView,
  StackLayout,
  isAndroid,
  isIOS,
  knownFolders,
} from '@nativescript/core'
import {
  animate,
  imageEffect,
  motionValue,
  springValue,
  type ImageEffect,
  type LiquidMaskOptions,
} from '@rafaelaugusto/jolt'
import { getDriver } from '../../../dist/driver/index'
import { button, label, page } from './ui'

/** Native interaction fixture. JS diagnostics are read only at explicit button boundaries. */
export function shaderTexturesRecipe() {
  const screen = page(),
    root = new GridLayout(),
    stage = new GridLayout(),
    photo = new Image(),
    scroll = new ScrollView()
  root.rows = 'auto,280,90,auto,auto'
  root.padding = 12
  screen.content = root
  const heading = label('Shader textures', 26)
  heading.margin = 4
  root.addChild(heading)
  stage.row = 1
  stage.backgroundColor = new Color('#CA9B68')
  stage.borderRadius = 20
  const checker = new GridLayout()
  checker.rows = '*,*,*,*'
  checker.columns = '*,*,*,*'
  for (let i = 0; i < 16; i++) {
    const tile = new GridLayout()
    tile.row = Math.floor(i / 4)
    tile.col = i % 4
    tile.backgroundColor = new Color((tile.row + tile.col) % 2 ? '#D8BD93' : '#F5E8CE')
    checker.addChild(tile)
  }
  stage.addChild(checker)
  photo.src = '~/assets/studio/cove.png'
  photo.stretch = 'aspectFill'
  photo.height = 260
  photo.width = 320
  photo.automationText = 'shader-image'
  stage.addChild(photo)
  root.addChild(stage)
  scroll.row = 2
  scroll.automationText = 'shader-scroll'
  scroll.backgroundColor = new Color('#D6E7B5')
  const track = new StackLayout()
  for (let i = 0; i < 6; i++) {
    const row = label(
      i === 0 ? 'Drag here to merge the shapes ↓' : `Scroll progress · ${i}`,
      16,
    )
    row.height = 55
    row.margin = 4
    track.addChild(row)
  }
  scroll.content = track
  root.addChild(scroll)
  const status = label('Ready · choose a source', 12)
  status.row = 4
  status.margin = 4
  status.automationText = 'shader-status'
  root.addChild(status)
  const controls = new GridLayout()
  controls.row = 3
  controls.columns = '*,*,*'
  controls.rows = 'auto,auto,auto,auto,auto'
  root.addChild(controls)
  const input = motionValue(0),
    spring = springValue(input, { stiffness: 100, damping: 13 })
  let effect: ImageEffect | undefined,
    goal = 0,
    expanded = false,
    videoPaused = false,
    observing: (() => void) | undefined
  let jsFrameRequests = 0
  const driver = getDriver(),
    originalFrame = driver.frame
  driver.frame = function (callback) {
    jsFrameRequests++
    return originalFrame.call(driver, callback)
  }
  const events: unknown[] = [],
    session = Date.now()
  const mask: LiquidMaskOptions = {
    blend: 22,
    shapes: [
      {
        kind: 'circle',
        from: { x: 0.25, y: 0.5, radius: 0.18 },
        to: { x: 0.43, y: 0.5, radius: 0.22 },
      },
      {
        kind: 'rectangle',
        from: { x: 0.77, y: 0.5, width: 0.3, height: 0.5, radius: 0.09 },
        to: { x: 0.59, y: 0.5, width: 0.44, height: 0.6, radius: 0.15 },
      },
    ],
  }
  function report(name: string) {
    events.push({
      name,
      time: Date.now(),
      jsFrameRequests,
      progress: effect?.progress,
      size: photo.getActualSize(),
      diagnostics: effect?.diagnostics,
      processMemoryBytes: isIOS
        ? JoltImageEffect.processMemoryBytes()
        : android.os.Debug.getPss() * 1024,
      nativeNodes: isIOS
        ? JoltLiveSpring.nodeCount()
        : org.rafaelaugusto.jolt.LiveSpring.nodeCount(),
    })
    const directory = isAndroid
      ? Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
      : knownFolders.documents().path
    File.fromPath(directory + '/jolt-shader-textures.json').writeTextSync(
      JSON.stringify({ session, platform: isIOS ? 'ios' : 'android', events }),
    )
    status.text = `${name} · JS frames ${jsFrameRequests} · native ${effect?.diagnostics.nativeParameterWrites ?? 0} · p=${effect?.progress.toFixed(2) ?? '—'}`
  }
  function start(kind: 'liquid-mask' | 'ripple' = 'liquid-mask') {
    effect?.stop()
    observing?.()
    observing = undefined
    effect = imageEffect(photo, kind, {
      mask: kind === 'liquid-mask' ? mask : undefined,
      paused: true,
      amplitude: 28,
      radius: 130,
      duration: 2000,
    })
    return effect
  }
  function control(text: string, index: number, run: () => void) {
    const view = button(text, () => {
      try {
        run()
      } catch (error) {
        status.text = String(error)
        report('error: ' + String(error))
      }
    })
    view.row = Math.floor(index / 3)
    view.col = index % 3
    view.height = 42
    view.margin = 2
    view.fontSize = 12
    controls.addChild(view)
  }
  control('Spring merge', 0, () => {
    start().bind('progress', spring)
    animate(input, 0, { duration: 0 })
    goal = 1
    animate(input, goal, { duration: 0 })
    report('spring-start')
  })
  control('Reverse', 1, () => {
    goal = goal ? 0 : 1
    animate(input, goal, { duration: 0 })
    report('spring-reverse')
  })
  control('Native scroll', 2, () => {
    start().bindScroll('progress', scroll, { range: [0, 220] })
    report('scroll-bound')
  })
  control('Resize', 3, () => {
    report('before-resize')
    expanded = !expanded
    photo.width = expanded ? 250 : 320
    photo.height = expanded ? 210 : 260
    photo.style.padding = expanded ? 8 : 0
    photo.borderWidth = expanded ? 4 : 0
    photo.borderColor = new Color('#386B52')
    photo.borderRadius = expanded ? 36 : 0
    setTimeout(() => report('resized'), 300)
  })
  control('Scrub 50%', 4, () => {
    if (!effect) start()
    effect!.pause()
    effect!.progress = 0.5
    report('scrubbed')
  })
  control('Snapshot', 5, () => report('snapshot'))
  control('Video texture', 6, () => {
    const handle = start('ripple')
    handle.progress = 0.35
    handle.setVideo({
      src: knownFolders.currentApp().path + '/assets/shader-video.mp4',
      loop: true,
    })
    videoPaused = false
    report('video-start')
  })
  control('Pause video', 7, () => {
    videoPaused = !videoPaused
    videoPaused ? effect?.pauseVideo() : effect?.playVideo()
    report(videoPaused ? 'video-paused' : 'video-resumed')
  })
  control('Replace video', 8, () => {
    effect?.setVideo({
      src: knownFolders.currentApp().path + '/assets/shader-video-alt.mp4',
      loop: true,
    })
    videoPaused = false
    report('video-replaced')
  })
  control('Stop', 9, () => {
    effect?.stop()
    observing?.()
    observing = undefined
    report('stopped')
  })
  control('JS control', 10, () => {
    start().bind('progress', spring)
    observing = spring.subscribe(() => {})
    goal = goal ? 0 : 1
    animate(input, goal, { duration: 0 })
    report('negative-control')
  })
  control('Reset counters', 11, () => {
    observing?.()
    observing = undefined
    jsFrameRequests = 0
    report('reset')
  })
  control('Play mask', 12, () => {
    start().play()
    report('mask-playing')
  })
  control('Pause mask', 13, () => {
    effect?.pause()
    report('mask-paused')
  })
  control('Remove video', 14, () => {
    effect?.setVideo(null)
    report('video-removed')
  })
  screen.on('unloaded', () => {
    if (Application.suspended) return
    effect?.stop()
    observing?.()
    spring.dispose()
    driver.frame = originalFrame
    report('disposed')
  })
  return screen
}
