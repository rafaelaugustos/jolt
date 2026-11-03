import {
  Application,
  File,
  GridLayout,
  Image,
  ImageSource,
  StackLayout,
  Utils,
  isAndroid,
  knownFolders,
} from '@nativescript/core'
import { imageEffect, type ImageEffect } from '@rafaelaugusto/jolt'
import { button, label, page } from './ui'

/** Opt-in benchmark screen. All starts/cancellations are actual native button taps. */
export function imageProfileRecipe() {
  const screen = page(),
    root = new StackLayout(),
    stage = new GridLayout()
  screen.content = root
  stage.columns = '*,*'
  stage.height = 240
  root.addChild(label('Image renderer measurements'))
  const source = ImageSource.fromFileSync(
    `${knownFolders.currentApp().path}/assets/image-grid.png`,
  )!
  const destination = ImageSource.fromFileSync(
    `${knownFolders.currentApp().path}/assets/image-target.png`,
  )!
  const photos = [0, 1].map((col) => {
    const photo = new Image()
    photo.col = col
    photo.width = 160
    photo.height = 220
    photo.src = `${knownFolders.currentApp().path}/assets/image-grid.png`
    photo.stretch = 'aspectFit'
    stage.addChild(photo)
    return photo
  })
  root.addChild(stage)
  const status = label('Ready', 16)
  status.automationText = 'image-profile-status'
  const events: unknown[] = [],
    session = Date.now()
  let active: ImageEffect[] = [],
    run = 0
  function report(name: string) {
    events.push({
      name,
      run,
      time: Date.now(),
      images: photos.map((p) => ({
        size: p.getActualSize(),
        source: { width: source.width, height: source.height },
      })),
      effects: active.map((effect) => effect.diagnostics),
    })
    const directory = isAndroid
      ? Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
      : knownFolders.documents().path
    File.fromPath(directory + '/jolt-image-profile.json').writeTextSync(
      JSON.stringify({
        session,
        density: Utils.layout.getDisplayDensity(),
        platform: isAndroid ? 'android' : 'ios',
        events,
      }),
    )
  }
  async function start(count: number, dissolve: boolean) {
    active.forEach((effect) => effect.stop())
    run++
    const current = run
    active = photos.slice(0, count).map((photo) => {
      photo.src = source
      return imageEffect(photo, dissolve ? 'dissolve' : 'ripple', {
        to: destination,
        duration: 1600,
        amplitude: 16,
      })
    })
    status.text = `Running ${current}`
    await Promise.resolve()
    report('prepared')
    const result = await Promise.all(active.map((effect) => effect.finished))
    if (current !== run) return
    report('finished')
    status.text = `Finished ${current}: ${result.every(Boolean)}`
  }
  root.addChild(
    button('One ripple', () => {
      void start(1, false)
    }),
  )
  root.addChild(
    button('Two dissolves', () => {
      void start(2, true)
    }),
  )
  root.addChild(
    button('Cancel effects', () => {
      active.forEach((effect) => effect.stop())
      report('cancelled')
    }),
  )
  root.addChild(status)
  screen.on('unloaded', () => {
    active.forEach((effect) => effect.stop())
    report('disposed')
  })
  return screen
}
