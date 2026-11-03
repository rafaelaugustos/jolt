# Web gravity, haptics, sensors, glass and gallery

**Development build; not published in RC.9.** This batch covers [#373–#378](https://github.com/rafaelaugustos/jolt/issues/373) under [#236](https://github.com/rafaelaugustos/jolt/issues/236), and advances the Web portion of [#117](https://github.com/rafaelaugustos/jolt/issues/117). No release is authorized. Import `/web` safely during SSR; create the runtime and mounted targets on the client. Resources created through a scope pause/resume with it and are disposed on teardown.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
// scope.suspend(); scope.resume(); scope.dispose(); motion.dispose()
```

## Finite gravity {#gravity}

`animate()` now accepts `type: 'gravity'` for `x`, `y` and numeric motion values. It uses the same finite ballistic compiler as native: positive acceleration toward the endpoint, restitution in `[0, 1)`, signed explicit or inherited velocity, one endpoint, delays/repeats and independent layers. Pause, resume, seek, stop, reduced motion and transactional validation follow existing playback rules. A paused animation contributes zero handoff velocity. This is separate from the multi-body `physicsWorld()` API.

```ts
const fall = scope.animate(
  card,
  { y: 280 },
  {
    type: 'gravity',
    acceleration: 1800,
    restitution: 0.6,
  },
)
fall.pause()
fall.progress = 0.3
fall.play()
const height = scope.motionValue(0)
scope.animate(height, 280, { type: 'gravity', velocity: -600 })
```

<Clip name="web-gravity-parity-chromium" :width="900" caption="Chromium on macOS, English: actual clicks drop, pause/resume, toss and interrupt ballistic playback. Original timing." />
<Clip name="gravity-ios" caption="iOS simulator, English native demo: real taps drop, toss, interrupt and pause/resume. Reviewed existing recording at original speed; not physical-device performance evidence." />

## Opt-in haptics {#haptics}

`haptic()` returns `backend: 'vibration' | 'none'` and `status: 'requested' | 'unavailable' | 'blocked' | 'disabled'`. A requested result acknowledges the browser request, not hardware output. The [Vibration API](https://www.w3.org/TR/vibration/) provides short duration hints (10/20/30 ms), not native light/medium/heavy intensity equivalence. A visible document and prior user activation are required; reduced motion suppresses requests. There is no forced vibration fallback. Press feedback fires once on accepted contact or keyboard press; disabled/loading controls do not fire. Animation cues default to arrival; optional increasing `times` are in `(0, 1]` after the initial delay. Pause reschedules cues; seeking consumes skipped cues, interruption cancels them, and cues over 100 ms late are dropped.

```ts
const result = motion.haptic('light')
scope.press(button, { scale: 0.96 }, { haptic: 'light' })
scope.animate(
  card,
  { x: 240 },
  {
    duration: 800,
    haptic: { style: 'medium', times: [0.5, 1] },
  },
)
```

<Clip name="web-haptics-parity-chromium" :width="900" caption="Chromium on macOS, English: real button/animation feedback requests and pause/resume. Desktop video cannot prove vibration or native impact intensity." />
<Clip name="haptics-android-device" caption="Physical ASUS_Z017DC, Android 8, English: real touches request native haptic feedback. White flashes mark requests; video cannot convey tactile sensation. Reviewed existing recording." />

## Rotation and gravity sensors {#sensors}

`sensor('rotation')` exposes relative XYZ **radians**, a normalized Hamilton quaternion (`xyzw`) and `recenter()`. `sensor('gravity')` exposes downward gravitational acceleration in **m/s²**; a flat face-up device has negative Z. Gravity is linear acceleration minus acceleration including gravity; if either reading is absent, Jolt does not substitute total acceleration. Coordinates default to the screen interface; `device` retains device axes. The [Device Orientation and Motion API](https://www.w3.org/TR/orientation-event/) requires a secure context and may require permission. Call `requestPermission()` directly from user input; construction and resume never prompt. API presence is not hardware availability: `available` becomes true after a valid sample, while a two-second wait without usable data reports `unavailable` / `no-data`. States also include `permission-required`, `denied`, `idle`, `starting`, `active`, `paused` and `disposed`. Snapshot timestamps are monotonic browser event timestamps, not promised hardware timestamps. `interval: 'auto' | 5–1000` throttles delivered readings; it does not configure hardware frequency. Binding or subscription demand starts acquisition, shared per event/document. Removing the last consumer, scope suspension, backgrounding, reduced motion and disposal stop it. Rotation preserves its relative pose across restart. Use `reducedMotion: 'continue'` only for intentional nondecorative input.

```ts
const rotation = scope.sensor('rotation')
const gravity = scope.sensor('gravity', { coordinates: 'interface' })
scope.bind(card, {
  rotate: scope.map(rotation.z, [-Math.PI, Math.PI], [-180, 180]),
  x: scope.map(gravity.x, [-10, 10], [-80, 80]),
})
enableButton.onclick = () => {
  void rotation.requestPermission()
  void gravity.requestPermission()
}
rotation.recenter()
console.log(gravity.snapshot())
```

<Clip name="web-sensors-parity-chromium" :width="900" caption="Chromium on macOS, English: actual enable, pause/resume and recenter controls with honest no-data status. No physical sensor samples or synthetic device motion are used in this recording." />
<Clip name="device-sensors-physical-ios" caption="Physical iPhone 17 Pro, iOS 27.2, English Release demo: real Core Motion rotation and gravity move native views. Reviewed existing USB capture at original speed; not browser sensor or calibrated axis evidence." />

## Controlled glass {#glass}

`glass()` returns `set`, `animate`, `stop`, `suspend`, `resume`, `dispose` and `snapshot`. The actual backend is `css-backdrop-filter` or `solid`. Missing support, reduced transparency and forced colors select a solid fallback; captions and capability reporting never claim UIKit Liquid Glass refraction or fusion. Filtering affects the backdrop, leaving child controls interactive. Intensity is `[0, 1]`, radius is `1–64` CSS pixels. Disposal restores only styles still owned by the effect, preserving application writes. Do not assign another blur/glass owner to the same backdrop channel.

```ts
const surface = scope.glass(panel, {
  amount: 0.7,
  radius: 24,
  tint: 'rgba(30, 38, 58, 0.35)',
  fallbackColor: '#202638',
})
scope.add(surface.animate(1, { duration: 400 }))
console.log(surface.snapshot().backend)
```

<Clip name="web-glass-parity-chromium" :width="900" caption="Chromium on macOS, English: real backdrop blur changes, paused intensity and an interactive child button. CSS filtering, not native Liquid Glass." />
<Clip name="glass-legacy-ios" caption="iOS 18.6 simulator, English: real touches control native rounded blur surfaces and motion. Reviewed existing recording; no Liquid Glass fusion or physical-device claim." />

## Interactive route return {#navigation}

`interactiveNavigation()` uses the existing gesture engine and a private translation layer. A horizontal gesture starts within 32 CSS pixels of the leading edge by default; vertical gestures use the whole surface. Release position and velocity choose cancellation or exit. A spring settles from the current pose and velocity, then `commit` calls the application router exactly once. Returning `false`, rejecting or timing out rolls the view back. `cancel()` reverses an in-flight exit; `back()` supplies a keyboard/button path. The router must honor its abort signal and resolve after route commitment. Jolt cannot undo an application route that already changed, and does not intercept browser history, implement OS predictive back or manage route focus automatically. Scope disposal removes its own contribution and input handlers.

```ts
const backGesture = scope.interactiveNavigation(page, {
  axis: 'x',
  edgeWidth: 32,
  canBegin: () => !editorIsBusy(),
  commit: ({ animated, signal }) => routerBack({ animated, signal }),
})
backButton.onclick = () => backGesture.back()
// backGesture.cancel()
```

<Clip name="web-navigation-parity-chromium" :width="900" caption="Chromium on macOS, English: actual edge drags cancel a short return and commit a long return exactly once. Application-owned routing; no system back claim." />
<Clip name="interactive-navigation-ios" caption="iOS 26.2 simulator, English: real taps and edge drags cancel and commit native page returns. Reviewed existing recording at original speed; not a physical-device recording." />

## Gallery and keyed thumbnail return {#gallery}

`sharedNavigationEntry()` coordinates one forward route and return, reusing the reviewed shared-layout snapshot restrictions. `returnFrom(intent)` captures the held zoom/dismissal pose before routing and transfers its vertical release velocity. A rejected return calls `intent.cancel()` so the viewer remains usable. Repeated return requests share one operation. `resolveListTarget()` re-reads the current index, asks the application virtualizer to realize it, checks the live key and requires a stable rectangle across two layout frames. It never retains an old cell or index. The resolver gets an abort signal; the return budget defaults to 1500 ms, maximum 5000 ms. A deleted/missing/timed-out target completes routing without a shared flight and uses `fallbackFocus`; make that fallback focusable. A current thumbnail focuses its enclosing button/link when present. Route callbacks remain application-owned and must honor cancellation; visual cancellation cannot roll back committed navigation. Realization and image decoding belong in the application callback. Keyboard back, focal zoom, cancelled drag, committed drag, recycling and deletion are demonstrated below. This advances #117 without claiming its remaining native accessibility/device acceptance is complete.

```ts
import { resolveListTarget } from '@rafaelaugusto/jolt/web'
const entry = scope.sharedNavigationEntry(region, {
  tag: photoKey,
  source: () => thumbnailForKey(photoKey),
  detail: () => detailImage,
  back: ({ animated, signal }) => showCollection({ animated, signal }),
  returnTarget: {
    key: photoKey,
    resolve: (context) =>
      resolveListTarget(context, {
        container: list,
        indexOf: (key) => photos.findIndex((photo) => photo.id === key),
        scrollToIndex: (index, { signal }) => realizeRow(index, signal),
        viewForKey: thumbnailForKey,
        keyOf: (element) => element.dataset.key,
      }),
    fallbackFocus: () => collectionHeading,
  },
})
await entry.open(({ animated, signal }) => showPhoto({ animated, signal }))
scope.zoomable(detailImage, {
  viewport,
  onDismiss: (intent) => {
    void entry.returnFrom(intent)
  },
})
backButton.onclick = () => {
  void entry.back()
}
```

<Clip name="web-gallery-parity-chromium" :width="900" caption="Chromium on macOS, English: actual thumbnail opening, focal zoom, pan, cancelled/committed dismissal, virtual scrolling and deleted-photo focus fallback. Original timing." />
<Clip name="gallery-ios" caption="iOS 26.2 simulator, English: actual multi-touch zoom, interrupted double tap, cancelled drag, return after reordering and deletion fallback. Reviewed existing recording at original speed." />

## Validation and reproduction {#validation}

Run `npm run web:parity:typecheck`, `npm run web:parity:test`, `npm run build`, `npm run core:check`, `npm run package:check`, `python3 benchmarks/verify-sensor-math.py --web`, `npm run docs:check-media` and `npm run docs:build`. The new browser suite covers Chromium, Firefox and WebKit. Injected permission/sensor/vibration inputs are explicitly test fixtures, not physical-device proof. Reproduce actual browser media with `node benchmarks/web-parity/record.mjs`; native capture instructions remain in `CONTRIBUTING.md`. Mavis adoption stays in its own workstream.
