import {
  Application,
  Button,
  Color,
  GridLayout,
  Label,
  Page,
  StackLayout,
} from '@nativescript/core'
import { animate, configure, set, type PlaybackAnimation } from '@rafaelaugusto/jolt'
configure({ timeScale: 1, reducedMotion: 'never' })
Application.run({
  create: () => {
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
    const tile = new Label()
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
    const stop = () => {
      motion?.stop()
      motion = undefined
    }
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
      [
        'Start',
        'comparison-start',
        () => {
          stop()
          set(tile, { x: 0, opacity: 1 })
          motion = animate(
            tile,
            { x: [0, 240], opacity: [1, 0.4] },
            { duration: 1000, ease: 'linear', repeat: Infinity, repeatType: 'reverse' },
          )
        },
      ],
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
