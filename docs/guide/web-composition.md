# Web composition experiment

This internal [#280 experiment](https://github.com/rafaelaugustos/jolt/issues/280) uses the portable compiler to play transforms through Web Animations API directly on DOM elements, without a framework. The experimental public [Web runtime](./web-runtime) is available since **0.1.0-rc.5**. Mavis press/reveal migration and the shared application example remain separate work in [#236](https://github.com/rafaelaugustos/jolt/issues/236).

<Clip name="web-composition-chromium" :width="720" caption="Chromium 156 on macOS arm64, actual browser playback at real-time speed. Buttons start x/y, retarget x, set application scale to 1.1, apply a 0.96 press contribution, change the base to 1.2 and release back to 1.2. These buttons exercise composition; full pointer/keyboard press recognition is separate work." />

## What the proof establishes {#what-the-proof-establishes}

One visual `transform` effect combines channels with independent browser clocks. Replacing `x` preserves the clocks of `y` and scale. The source curve provides position and velocity at interruption; ownership tokens prevent a retired callback from changing its replacement. Pause, resume, seek, delay and disposal are exercised separately.

Application scale and the press contribution multiply: `1.1 × 0.96 = 1.056`. Changing the base while held gives `1.2 × 0.96 = 1.152`; releasing only press preserves `1.2`. Two individual `translate` effects using replacement lose an axis. Additive scale works in the tested browsers, but additive transform lists need explicit ordering. Grouping is the initial experiment's choice, not a claim that every alternative is unsuitable.

The 42 checks run in Chromium, Firefox and Playwright WebKit. Explicit local-time samples check position and scale error separately from source-curve velocity. A separate playback check verifies advancement without JavaScript style writes per frame. These are correctness checks, not FPS or compositor-acceleration measurements. Live WebKit style reads can differ from the timeline tick; the precise error assertions use explicitly aligned times. See the [decision and evidence](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-composition.md) for versions and limits.

## Initial CSS policy {#initial-css-policy}

The surface owns `transform` with the fixed order `baseline × translate × rotate × scale`, keeping the original `transform-origin`. The baseline may contain a static 2D matrix. Individual CSS `translate`, `rotate` and `scale`, 3D transforms, existing animations/transitions and inline `!important` transforms are excluded. External CSS changes require disposal and recreation; arbitrary stylesheet or CSS-variable changes are not monitored.

This bounded fixture supports `x`, `y`, `rotate`, `scaleX` and `scaleY`, two contributions and finite tracks up to 15 seconds. Public controls, accessibility preferences, arbitrary keyframes, opacity, packaging and framework lifecycle integration belong to the subsequent runtime work. No native execution path changes here.

## Native composition reference {#native-composition-reference}

The existing native demo shows the composition behavior that motivates the browser work. These reviewed clips are preserved; they do not demonstrate a shared Mavis screen or the browser fixture running natively.

<Clip name="layers-ios" caption="iOS simulator, existing native Layers demo in English. Movement and feedback layers coexist on the card. This is native composition reference footage, not a physical-device recording or the new Web fixture." />

<Clip name="layers-android" caption="Android emulator, existing native Layers demo in English. Movement and feedback layers coexist on the card. This is native composition reference footage, not a physical-device recording or the new Web fixture." />

## Run the experiment {#run-the-experiment}

From the repository, using Node 22:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run web:proof:typecheck
npm run web:proof:test
npm run web:proof
```

Open `http://127.0.0.1:4280`. Stop that server before running the test suite, which starts its own fixture server. Source and recording instructions live in `benchmarks/web-composition/`.
