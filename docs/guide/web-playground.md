# The Web playground

[Open the playground](/#playground)

53 experiments, seven categories, one live demo at a time. Search by name or API, choose a demo, interact with it, and copy its core code. The selected experiment stays in the URL and survives language switching.

## Explore

- [Motion & physics · 12](/?play=spring#playground): Springs, stagger, keyframes, presets, gravity, decay, timelines, sequences, seeking, states, values and circle physics.
- [Touch & gestures · 7](/?play=gestures#playground): Press, drag/snap, inertia, simultaneous gestures, pointer following, image zoom and reorder.
- [Scroll & layout · 9](/?play=scroll#playground): Vertical and horizontal/RTL scroll, viewport entrances, keyed items, layout, automatic size, shared layout, collapsing headers and nested scrolling.
- [Visual effects · 12](/?play=gradient#playground): Linear/radial/conic gradients, particles, confetti, blur, glass, shapes, SVG drawing, liquid images, image effects, reveal/conceal, shimmer and loaders.
- [Type & symbols · 3](/?play=text#playground): Word/letter animation, rolling numbers and layered symbol effects.
- [Surfaces & navigation · 5](/?play=sheet#playground): Bottom sheets, interactive dialogs, shared navigation, interactive back and gallery return, including a removed thumbnail.
- [Device & browser · 5](/?play=sensor-rotation#playground): Rotation and gravity sensors, haptics, keyboard observation/following and playback/lifecycle inspection.

## What actually runs

All previews use the existing experimental Jolt Web runtime. Only the selected experiment is mounted. Leaving the viewport suspends its scope; returning recreates it. Switching demos or leaving the page disposes listeners, effects and DOM ownership. Resizing rebuilds geometry-dependent bounds. The site and operating system reduced-motion preferences remain respected.

Code snippets show the core integration and assume mounted DOM refs. The linked API guide supplies markup requirements, lifecycle details and limitations. Shared navigation changes a local demo scene; the application still owns its routes. The Vue adapter is documented in [Web integration](./web-vue). No engine capability or native API changed in this site update.

Sensors request permission only after an explicit action and require real readings before reporting active. Unsupported or denied devices stay clearly labeled. Haptic requests report browser acceptance, not proof of vibration. A desktop keyboard normally reports zero covered pixels; try the keyboard demo on a compatible phone. Glass and image effects expose their real rendering backend. Reduced motion may suppress playback.

## Real browser walkthroughs

<Clip :autoplay="false" name="web-playground-motion-chromium" :width="960" caption="Chromium on macOS arm64, English UI, original speed, silent. Real pointer and keyboard interaction with the playground. Browser capture, not a native performance measurement." />

<Clip :autoplay="false" name="web-playground-effects-chromium" :width="960" caption="Chromium on macOS arm64, English UI, original speed, silent. Real pointer and keyboard interaction with the playground. Browser capture, not a native performance measurement." />

<Clip :autoplay="false" name="web-playground-platform-chromium" :width="960" caption="Chromium on macOS arm64, English UI, original speed, silent. Real pointer and keyboard interaction with the playground. Browser capture, not a native performance measurement." />

## Reviewed native references

These existing native recordings remain separate from the browser previews. The linked API guides include the additional native counterparts and their platform-specific limits.

<Clip :autoplay="false" name="showcase-springs-ios" caption="iOS 26 simulator: real XCTest taps interrupt and retarget the native spring. Original speed; not a physical-device performance measurement." />

<Clip :autoplay="false" name="gesture-composition-ios" caption="iOS simulator: existing native simultaneous gesture composition and tap demo. Original speed; not a physical device." />

<Clip :autoplay="false" name="web-native-gradients-ios" caption="iPhone 17 simulator, iOS 26: English native Vue demo, actual XCTest interaction with gradients. Original speed; not a physical device." />

<Clip :autoplay="false" name="interactive-modal-ios" caption="iOS simulator, English native demo: interactive modal presentation, return and dismissal. Original speed; not a physical device." />

## Review and coverage

Run `npm run docs:check-playground`, `npm run docs:check-media` and `npm run docs:build`. With the site running, use `JOLT_SITE_URL=http://127.0.0.1:5184 npm run docs:test-playground`. The review exercises every experiment in Chromium and WebKit, followed by gesture, keyboard, responsive, locale, reduced-motion and cleanup checks. The API coverage check fails when a public Web runtime method has no demo or documented host responsibility. It tracks coverage, not universal browser support.
