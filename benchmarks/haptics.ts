import {
  Color,
  File,
  Utils,
  knownFolders,
  path,
  type LayoutBase,
} from '@nativescript/core'
import { animate, configure, motionScope, set, timeline } from '@rafaelaugusto/jolt'
import { HapticProbe, type HapticRequest } from '../demo/src/haptic-probe'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}

/** Actual native View requests/acceptance; tactile validation is a separate physical check. */
export async function checkAndroidHaptics(
  host: LayoutBase,
  report: (text: string) => void,
  mode = 'all',
) {
  const results: {
    name: string
    passed: boolean
    detail?: string
    requests: HapticRequest[]
  }[] = []
  const context = Utils.android.getApplicationContext()
  const scale = android.provider.Settings.Global.getFloat(
    context.getContentResolver(),
    'animator_duration_scale',
    1,
  )
  const metadata = {
    model: android.os.Build.MODEL,
    manufacturer: android.os.Build.MANUFACTURER,
    sdk: android.os.Build.VERSION.SDK_INT,
    release: android.os.Build.VERSION.RELEASE,
    scale,
    hapticsEnabled: android.provider.Settings.System.getInt(
      context.getContentResolver(),
      'haptic_feedback_enabled',
      -1,
    ),
    hasVibrator:
      (
        context.getSystemService(
          android.content.Context.VIBRATOR_SERVICE,
        ) as android.os.Vibrator
      )?.hasVibrator() ?? false,
    density: Utils.layout.getDisplayDensity(),
  }
  const probe = new HapticProbe()
  probe.width = probe.height = 40
  probe.backgroundColor = new Color('#3b82f6')
  host.addChild(probe)
  await wait(150)
  const all = motionScope()
  const check = async (name: string, run: () => Promise<void>) => {
    report(name)
    all.reset()
    configure({ timeScale: 1, reducedMotion: 'user' })
    set(probe, { x: 0, y: 0, opacity: 1 })
    probe.clearRequests()
    // Let the status label's Vue/layout update settle before measuring playback.
    // Its changing height must not become an unintended UI-stall fixture.
    await wait(150)
    try {
      await run()
      results.push({ name, passed: true, requests: probe.requests() })
    } catch (error) {
      results.push({
        name,
        passed: false,
        detail: String(error),
        requests: probe.requests(),
      })
    }
  }
  const play = (duration: number, times?: number[]) =>
    all.add(
      animate(
        probe,
        { x: 80 },
        {
          duration,
          ease: 'linear',
          haptic: times ? { style: 'light', times } : 'light',
        },
      ),
    )
  try {
    if (mode === 'background') {
      await check('Real Home/background/foreground drops feedback', async () => {
        play(1800)
        report('Background ready')
        await wait(2200 * Math.max(1, scale))
        assert(probe.requests().length === 0, 'Feedback survived background')
      })
    } else if (scale === 0) {
      await check('Scale zero with forced normal motion stays silent', async () => {
        configure({ reducedMotion: 'never' })
        await all.add(
          animate(probe, { opacity: 0.4, x: 80 }, { duration: 500, haptic: 'heavy' }),
        ).finished
        await wait(150)
        assert(probe.requests().length === 0, 'Disabled animator requested feedback')
      })
    } else {
      await check('Native styles and single tween arrival', async () => {
        const expected = [metadata.sdk >= 21 ? 4 : 3, metadata.sdk >= 23 ? 6 : 3, 0]
        for (const [i, style] of (['light', 'medium', 'heavy'] as const).entries()) {
          await wait(50)
          set(probe, { x: 0 })
          await all.add(animate(probe, { x: 80 }, { duration: 300, haptic: style }))
            .finished
          assert(probe.requests().length === i + 1, `Missing/duplicate ${style} request`)
          assert(
            probe.requests()[i]?.effect === expected[i],
            `Wrong mapping for ${style}`,
          )
        }
      })
      await check('Explicit points track native visual position', async () => {
        const started = android.os.SystemClock.uptimeMillis()
        await play(700, [0.3, 0.8]).finished
        const requests = probe.requests()
        assert(requests.length === 2, 'Expected exactly two impacts')
        for (const [i, fraction] of [0.3, 0.8].entries()) {
          const request = requests[i]!
          assert(
            Math.abs((request.at - started) / scale - 700 * fraction) < 130,
            'Feedback clock drift',
          )
          assert(
            Math.abs(request.xPixels / metadata.density - 80 * fraction) < 12,
            'Feedback disagrees with native position',
          )
        }
      })
      await check('Spring impact precedes settling completion', async () => {
        await all.add(
          animate(
            probe,
            { x: 80 },
            { type: 'spring', duration: 600, bounce: 0.35, haptic: 'heavy' },
          ),
        ).finished
        assert(probe.requests().length === 1, 'Spring must request one impact')
        assert(
          probe.requests()[0]!.at < android.os.SystemClock.uptimeMillis(),
          'Impact must precede completion',
        )
      })
      await check('Pause and seek preserve one-shot consumption', async () => {
        const animation = play(900, [0.3, 0.8])
        await wait(100 * scale)
        animation.pause()
        await wait(350 * scale)
        assert(probe.requests().length === 0, 'Impact while paused')
        animation.progress = 0.5
        animation.play()
        // Wait for the native event, not a wall-clock guess: native first-frame
        // startup can exceed the old 25 ms margin at Animator scale 0.5.
        const deadline = Date.now() + 2000 * Math.max(1, scale)
        while (
          probe.requests().length === 0 &&
          animation.progress < 1 &&
          Date.now() < deadline
        )
          await wait(10)
        animation.pause()
        assert(probe.requests().length === 1, 'Expected only the unconsumed point')
        assert(animation.progress < 1, 'Must rewind before playback completes')
        animation.progress = 0.1
        animation.play()
        await animation.finished
        assert(probe.requests().length === 1, 'Seek replayed an impact')
      })
      await check('Timeline pause includes pending steps and feedback', async () => {
        const scene = all.add(
          timeline([
            {
              at: 0,
              run: () => animate(probe, { x: 80 }, { duration: 500, haptic: 'light' }),
            },
            {
              at: 650,
              run: () => animate(probe, { x: 0 }, { duration: 250, haptic: 'heavy' }),
            },
          ]),
        )
        await wait(100 * scale)
        scene.pause()
        await wait(650 * scale)
        assert(probe.requests().length === 0, 'Timeline emitted while paused')
        scene.play()
        await scene.finished
        assert(
          probe
            .requests()
            .map((event) => event.effect)
            .join(',') === `${metadata.sdk >= 21 ? 4 : 3},0`,
          'Timeline feedback mismatch',
        )
      })
      await check('Interruption and scope disposal cancel pending feedback', async () => {
        play(700)
        await wait(100 * scale)
        await all.add(animate(probe, { x: 0 }, { duration: 250, haptic: 'heavy' }))
          .finished
        await wait(500 * scale)
        assert(
          probe.requests().length === 1 && probe.requests()[0]?.effect === 0,
          'Old owner emitted feedback',
        )
        probe.clearRequests()
        play(500)
        all.reset()
        await wait(600 * scale)
        assert(probe.requests().length === 0, 'Disposed scope emitted')
      })
      await check(
        'View-disabled feedback is declined without forced fallback',
        async () => {
          const native = probe.nativeViewProtected as android.view.View
          native.setHapticFeedbackEnabled(false)
          try {
            await play(250).finished
            assert(
              probe.requests().length === 1 && !probe.requests()[0]!.accepted,
              'Disabled view accepted feedback',
            )
          } finally {
            native.setHapticFeedbackEnabled(true)
          }
        },
      )
      await check(
        'False, stationary and zero-duration animations stay silent',
        async () => {
          await all.add(animate(probe, { x: 80 }, { duration: 200, haptic: false }))
            .finished
          await all.add(animate(probe, { x: 80 }, { duration: 200, haptic: 'light' }))
            .finished
          await all.add(animate(probe, { x: 0 }, { duration: 0, haptic: 'light' }))
            .finished
          assert(probe.requests().length === 0, 'Silent animation emitted')
        },
      )
      await check('Slow motion retains the visual clock', async () => {
        configure({ timeScale: 0.5 })
        const start = android.os.SystemClock.uptimeMillis()
        await play(300).finished
        assert(probe.requests().length === 1, 'Missing slow motion feedback')
        assert(
          Math.abs((probe.requests()[0]!.at - start) / scale - 600) < 130,
          'Slow motion event drift',
        )
        configure({ timeScale: 1 })
      })
      await check('Busy UI thread does not replay stale feedback', async () => {
        const animation = play(400, [0.2, 0.5])
        await wait(25 * scale)
        const until = Date.now() + 650 * scale
        while (Date.now() < until) {
          /* Deliberate UI-thread blocking probe. */
        }
        await animation.finished
        assert(probe.requests().length === 0, 'Stale feedback was replayed')
      })
      await check('Unload/reload cannot revive pending feedback', async () => {
        const old =
          probe.nativeViewProtected as org.rafaelaugusto.jolt.fixture.HapticProbeView
        play(500)
        host.removeChild(probe)
        host.addChild(probe)
        await wait(600 * scale)
        assert(
          JSON.parse(old.getFeedbackEvents()).length === 0 &&
            probe.requests().length === 0,
          'Unloaded owner emitted feedback',
        )
      })
      await check('Repeated cancellation leaves no later requests', async () => {
        for (let index = 0; index < 20; index++) {
          set(probe, { x: 0 })
          play(300).stop()
        }
        await wait(400 * scale)
        assert(probe.requests().length === 0, 'Cancelled requests leaked')
      })
    }
  } finally {
    all.dispose()
    configure({ timeScale: 1, reducedMotion: 'user' })
    if (probe.parent === host) host.removeChild(probe)
  }
  const output = {
    passed: results.every((result) => result.passed),
    mode,
    metadata,
    results,
  }
  await File.fromPath(
    path.join(knownFolders.documents().path, 'jolt-haptics.json'),
  ).writeText(JSON.stringify(output, null, 2))
  report(
    output.passed
      ? `${results.length} haptic checks passed`
      : `FAILED: ${results
          .filter((result) => !result.passed)
          .map((result) => result.name)
          .join(', ')}`,
  )
  return output
}
