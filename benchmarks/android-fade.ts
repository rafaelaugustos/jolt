import {
  Application,
  Button,
  Color,
  GridLayout,
  Image,
  ImageSource,
  Label,
  Page,
  StackLayout,
  isAndroid,
  knownFolders,
} from '@nativescript/core'
import { animate, type Animation } from '@rafaelaugusto/jolt'

declare const __BENCHMARK_BUILD__: Record<string, unknown>

const ACTION = 'org.nativescript.jolt.FADE_BENCHMARK'
const DURATION = 1200
const REPEAT = 5
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const report: Record<string, unknown> = { build: __BENCHMARK_BUILD__, phase: 'loading' }
let suspensions = 0
Application.on(Application.suspendEvent, () => suspensions++)

function save(phase: string, details: Record<string, unknown> = {}) {
  Object.assign(report, { phase, ...details })
  knownFolders
    .externalDocuments()
    .getFile('jolt-fade.json')
    .writeTextSync(JSON.stringify(report, null, 2))
}
function check(value: unknown, message: string) {
  if (!value) throw new Error(message)
}

/** Same native keyframes as animate(), before the automatic layer optimization. */
function baseline(view: StackLayout): Animation {
  view.opacity = 1
  const frames = Array.create(android.animation.Keyframe, 3)
  frames[0] = android.animation.Keyframe.ofFloat(0, 1)
  frames[1] = android.animation.Keyframe.ofFloat(0.5, 0.25)
  frames[2] = android.animation.Keyframe.ofFloat(1, 1)
  const holders = Array.create(android.animation.PropertyValuesHolder, 1)
  holders[0] = android.animation.PropertyValuesHolder.ofKeyframe(
    android.view.View.ALPHA,
    frames,
  )
  const animator = android.animation.ObjectAnimator.ofPropertyValuesHolder(
    view.android,
    holders,
  )
  animator.setDuration(DURATION)
  animator.setRepeatCount(REPEAT)
  animator.setInterpolator(new android.view.animation.LinearInterpolator())
  let cancelled = false
  let resolve!: (value: boolean) => void
  const finished = new Promise<boolean>((done) => (resolve = done))
  animator.addListener(
    new android.animation.Animator.AnimatorListener({
      onAnimationStart() {},
      onAnimationRepeat() {},
      onAnimationCancel() {
        cancelled = true
      },
      onAnimationEnd() {
        resolve(!cancelled)
      },
    }),
  )
  view.android.setAlpha(1)
  animator.start()
  return {
    finished,
    stop: () => animator.cancel(),
    then: (yes, no) => finished.then(yes, no),
  }
}

function thumbnail(index: number) {
  const bitmap = android.graphics.Bitmap.createBitmap(
    384,
    288,
    android.graphics.Bitmap.Config.ARGB_8888,
  )
  const canvas = new android.graphics.Canvas(bitmap)
  const paint = new android.graphics.Paint(3)
  canvas.drawColor(
    android.graphics.Color.parseColor(['#335f77', '#6f4b69', '#667747'][index]!),
  )
  for (let i = 0; i < 40; i++) {
    paint.setColor(
      android.graphics.Color.argb(
        160,
        (i * 41 + 70) % 255,
        (i * 19 + 90) % 255,
        (i * 29 + 110) % 255,
      ),
    )
    canvas.drawCircle((i * 47) % 384, (i * 31) % 288, 12 + i * 2, paint)
  }
  return new ImageSource(bitmap)
}

Application.run({
  create: () => {
    if (!isAndroid) throw new Error('This benchmark runs on Android.')
    const page = new Page()
    page.actionBarHidden = true
    page.backgroundColor = new Color('#18181b')
    const root = new StackLayout()
    root.padding = 20
    const title = new Label()
    title.text = 'Android fade layers'
    title.fontSize = 24
    title.color = new Color('white')
    root.addChild(title)
    const status = new Label()
    status.text = 'Checking lifecycle…'
    status.color = new Color('#a1a1aa')
    status.marginBottom = 16
    root.addChild(status)
    const card = new StackLayout()
    card.width = 320
    card.height = 360
    card.padding = 16
    card.backgroundColor = new Color('#fafafa')
    card.borderRadius = 16
    root.addChild(card)
    const heading = new Label()
    heading.text = 'A card with three images'
    heading.fontSize = 19
    heading.color = new Color('#18181b')
    card.addChild(heading)
    const images = new GridLayout()
    images.columns = '*, *, *'
    images.height = 128
    images.marginTop = images.marginBottom = 12
    card.addChild(images)
    for (let i = 0; i < 3; i++) {
      const image = new Image()
      image.imageSource = thumbnail(i)
      image.stretch = 'aspectFill'
      image.margin = 3
      GridLayout.setColumn(image, i)
      images.addChild(image)
    }
    for (let i = 0; i < 6; i++) {
      const row = new GridLayout()
      row.height = 22
      row.columns = '*, auto'
      const text = new Label()
      text.text = `Static content ${i + 1}`
      text.fontSize = 13
      text.color = new Color('#52525b')
      row.addChild(text)
      const value = new Label()
      value.text = `${20 + i * 7}%`
      value.color = new Color('#18181b')
      value.fontSize = 13
      GridLayout.setColumn(value, 1)
      row.addChild(value)
      card.addChild(row)
    }
    const buttons = new GridLayout()
    buttons.height = 56
    buttons.columns = '*, *'
    root.addChild(buttons)
    let busy = true
    async function run(mode: string | null) {
      if (busy || (mode !== 'baseline' && mode !== 'hardware')) return
      busy = true
      let running: Animation | undefined
      try {
        const visibleGeneration = suspensions
        check(card.android.hasWindowFocus(), 'Keep the benchmark in the foreground.')
        check(
          android.animation.ValueAnimator.getDurationScale() === 1,
          'Set Animator duration scale to 1x.',
        )
        check(
          card.android.getLayerType() === android.view.View.LAYER_TYPE_NONE,
          'Previous layer was not restored.',
        )
        card.opacity = 1
        status.text = `${mode} · 7.2 seconds`
        await wait(200)
        const animation =
          mode === 'baseline'
            ? baseline(card)
            : animate(
                card,
                { opacity: [1, 0.25, 1] },
                { duration: DURATION, ease: 'linear', repeat: REPEAT },
              )
        save('warming', { mode, startedAt: android.os.SystemClock.uptimeMillis() })
        await wait(2000)
        check(
          suspensions === visibleGeneration && card.android.hasWindowFocus(),
          'Benchmark left the foreground.',
        )
        const layer = card.android.getLayerType()
        check(
          layer === (mode === 'baseline' ? 0 : 2),
          'Unexpected layer during playback.',
        )
        save('sampling', { layerDuring: layer })
        check(await animation, 'Fade did not complete.')
        check(
          suspensions === visibleGeneration && card.android.hasWindowFocus(),
          'Benchmark left the foreground.',
        )
        check(card.android.getLayerType() === 0, 'Fade left a hardware layer installed.')
        save('done', {
          layerAfter: card.android.getLayerType(),
          completedAt: android.os.SystemClock.uptimeMillis(),
        })
        running = animation
        status.text = `${mode} · done`
      } catch (error) {
        running?.stop()
        status.text = String(error)
        save('error', { error: String(error) })
      } finally {
        busy = false
      }
    }
    for (const [index, mode] of ['baseline', 'hardware'].entries()) {
      const button = new Button()
      button.text = mode
      button.color = new Color('#dcf71d')
      button.on('tap', () => void run(mode))
      GridLayout.setColumn(button, index)
      buttons.addChild(button)
    }
    page.content = root
    let loaded = false
    page.on('loaded', () => {
      if (loaded) return
      loaded = true
      void (async () => {
        await wait(500)
        const native = card.android as android.view.ViewGroup
        check(native.isHardwareAccelerated(), 'Hardware acceleration is off.')
        check(android.os.Build.VERSION.SDK_INT >= 26, 'This benchmark needs Android 8+.')
        check(
          android.animation.ValueAnimator.getDurationScale() === 1,
          'Set Animator duration scale to 1x.',
        )
        const first = animate(card, { opacity: [1, 0.25] }, { duration: 600, delay: 300 })
        check(native.getLayerType() === 0, 'Layer allocated during start delay.')
        await wait(450)
        check(native.getLayerType() === 2, 'Active fade has no hardware layer.')
        first.stop()
        check(
          (await first) === false && native.getLayerType() === 0,
          'Stop leaked the layer.',
        )
        const replaced = animate(card, { opacity: 1 }, { duration: 600 })
        await wait(80)
        const replacement = animate(card, { opacity: 0.5 }, { duration: 200 })
        check(
          (await replaced) === false &&
            (await replacement) &&
            native.getLayerType() === 0,
          'Replacement leaked the layer.',
        )
        native.setLayerType(android.view.View.LAYER_TYPE_SOFTWARE, null)
        const software = animate(card, { opacity: 1 }, { duration: 100 })
        check(native.getLayerType() === 1, 'Software layer overwritten.')
        check(
          (await software) && native.getLayerType() === 1,
          'Software layer not preserved.',
        )
        native.setLayerType(0, null)
        const unloading = animate(card, { opacity: 0.5 }, { duration: 600 })
        await wait(80)
        root.removeChild(card)
        check(native.getLayerType() === 0, 'Unloading leaked the layer.')
        unloading.stop()
        root.insertChild(card, 2)
        card.opacity = 1
        await wait(300)
        save('ready', {
          lifecyclePassed: true,
          device: android.os.Build.MODEL,
          os: android.os.Build.VERSION.RELEASE,
          sdk: android.os.Build.VERSION.SDK_INT,
          density: native.getResources().getDisplayMetrics().density,
          debuggable: !!(
            Application.android.context.getApplicationInfo().flags &
            android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE
          ),
          boundsPixels: { width: native.getWidth(), height: native.getHeight() },
          duration: DURATION,
          repeat: REPEAT,
        })
        status.text = 'Ready · collect gfxinfo for each mode'
        busy = false
        Application.android.registerBroadcastReceiver(
          ACTION,
          (_context, intent) => void run(intent.getStringExtra('mode')),
        )
      })().catch((error) => {
        status.text = String(error)
        save('error', { error: String(error) })
      })
    })
    return page
  },
})
