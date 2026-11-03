import {
  Application,
  Button,
  Color,
  GridLayout,
  knownFolders,
  Label,
  Page,
  StackLayout,
} from '@nativescript/core'
import { animate, configure, set, type PlaybackAnimation } from '@rafaelaugusto/jolt'
configure({ timeScale: 1, reducedMotion: 'never' })
Application.run({
  create: () => {
    // Explicit diagnostic controls only. The default comparison stays unchanged.
    const intent = Application.android.startActivity.getIntent()
    const driver = intent.getStringExtra('diagnostic-driver') ?? 'jolt'
    const tileKind = intent.getStringExtra('diagnostic-tile') ?? 'label'
    const layer = intent.getStringExtra('diagnostic-layer') ?? 'none'
    const startMode = intent.getStringExtra('diagnostic-start') ?? 'immediate'
    if (
      !['jolt', 'native', 'static'].includes(driver) ||
      !['label', 'layout'].includes(tileKind) ||
      !['none', 'hardware'].includes(layer) ||
      !['immediate', 'vsync'].includes(startMode)
    )
      throw Error('Unknown frame diagnostic configuration')
    const page = new Page()
    page.actionBarHidden = true
    page.backgroundColor = new Color('#102922')
    const root = new StackLayout()
    root.padding = 24
    page.content = root
    const title = new Label()
    Object.assign(title, {
      text: 'Jolt · linear ping-pong',
      color: '#eff5da',
      fontSize: 22,
    })
    root.addChild(title)
    const stage = new GridLayout()
    Object.assign(stage, {
      width: 288,
      height: 120,
      marginTop: 24,
      horizontalAlignment: 'center',
    })
    root.addChild(stage)
    const tile = tileKind === 'layout' ? new GridLayout() : new Label()
    Object.assign(tile, {
      width: 48,
      height: 48,
      backgroundColor: '#D6E7B5',
      horizontalAlignment: 'left',
      verticalAlignment: 'middle',
      automationText: 'comparison-tile',
    })
    stage.addChild(tile)
    let motion: PlaybackAnimation | undefined
    let nativeMotion: android.animation.ObjectAnimator | undefined
    let pending: android.view.Choreographer.FrameCallback | undefined
    let previousLayer: number | undefined
    const stop = () => {
      if (pending) android.view.Choreographer.getInstance().removeFrameCallback(pending)
      pending = undefined
      motion?.stop()
      motion = undefined
      nativeMotion?.cancel()
      nativeMotion = undefined
      if (previousLayer !== undefined) tile.android.setLayerType(previousLayer, null)
      previousLayer = undefined
    }
    const start = () => {
      stop()
      set(tile, { x: 0, opacity: 1 })
      const play = () => {
        pending = undefined
        if (layer === 'hardware') {
          previousLayer = tile.android.getLayerType()
          tile.android.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
        }
        if (driver === 'native') {
          const holders = Array.create(android.animation.PropertyValuesHolder, 2)
          const x = Array.create('float', 2),
            alpha = Array.create('float', 2)
          x[0] = 0
          x[1] = 240 * tile.android.getResources().getDisplayMetrics().density
          alpha[0] = 1
          alpha[1] = 0.4
          holders[0] = android.animation.PropertyValuesHolder.ofFloat(
            android.view.View.TRANSLATION_X,
            x,
          )
          holders[1] = android.animation.PropertyValuesHolder.ofFloat(
            android.view.View.ALPHA,
            alpha,
          )
          nativeMotion = android.animation.ObjectAnimator.ofPropertyValuesHolder(
            tile.android,
            holders,
          )
          nativeMotion.setDuration(1000)
          nativeMotion.setRepeatCount(-1)
          nativeMotion.setRepeatMode(android.animation.ValueAnimator.REVERSE)
          nativeMotion.setInterpolator(new android.view.animation.LinearInterpolator())
          nativeMotion.start()
        } else if (driver === 'jolt') {
          motion = animate(
            tile,
            { x: [0, 240], opacity: [1, 0.4] },
            { duration: 1000, ease: 'linear', repeat: Infinity, repeatType: 'reverse' },
          )
        }
      }
      if (startMode === 'vsync') {
        pending = new android.view.Choreographer.FrameCallback({ doFrame: play })
        android.view.Choreographer.getInstance().postFrameCallback(pending)
      } else play()
    }
    page.on('loaded', () => {
      knownFolders
        .externalDocuments()
        .getFile('jolt-frame-diagnostic.json')
        .writeTextSync(
          JSON.stringify({
            driver,
            tileKind,
            layer,
            startMode,
            nativeClass: tile.android.getClass().getName(),
            overlapping: tile.android.hasOverlappingRendering(),
            processId: android.os.Process.myPid(),
            mainThreadId: android.os.Process.myTid(),
          }),
        )
    })
    const block = () => {
      const start = android.os.SystemClock.uptimeMillis()
      while (android.os.SystemClock.uptimeMillis() - start < 300) {
        /* deliberate benchmark workload */
      }
      android.util.Log.i(
        'JoltComparison',
        'blockMs=' + (android.os.SystemClock.uptimeMillis() - start),
      )
    }
    for (const [text, id, action] of [
      ['Start', 'comparison-start', start],
      ['Stop', 'comparison-stop', stop],
      ['Block app runtime · 300 ms', 'comparison-runtime-block', block],
      // NativeScript application JS already runs on the platform UI thread.
      ['Block UI thread · 300 ms', 'comparison-ui-block', block],
    ] as const) {
      const button = new Button()
      Object.assign(button, { text, automationText: id, height: 48, marginTop: 8 })
      button.on('tap', action)
      button.on('loaded', () => {
        // Button elevation/ripple animations can submit RenderThread-only buffers
        // while the tile's UI-thread animation is stalled. Keep controls static.
        button.android.setStateListAnimator(null)
        button.android.setBackground(
          new android.graphics.drawable.ColorDrawable(
            android.graphics.Color.parseColor('#254C3C'),
          ),
        )
        button.android.setTextColor(android.graphics.Color.parseColor('#EFF5DA'))
      })
      root.addChild(button)
    }
    const note = new Label()
    Object.assign(note, {
      text: 'Benchmark configuration: motion enabled. App JS and UI share a thread. No per-frame application callbacks.',
      color: '#c9d7bc',
      textWrap: true,
      fontSize: 12,
      marginTop: 16,
    })
    root.addChild(note)
    page.on('unloaded', stop)
    return page
  },
})
