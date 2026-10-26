# Demo app

The NativeScript-Vue app in [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) uses the local Jolt build. A normal launch opens **Jolt Motion Studio**: an animated brand splash, a moving home, and a searchable collection of 69 experiments grouped by Motion, Touch, Visual, Type, Layout, State and SceneKit.

<Clip name="showcase-splash-ios" caption="Real iOS 26 simulator cold launch: the system launch screen leads into the native animated brand splash and Studio. Captured without XCTest launch synchronization; original timing. Not physical-device performance evidence." />

<Clip name="showcase-ios" caption="Real iOS 26 simulator recording: springs, native gestures, category filtering, search, SceneKit playback and return navigation. Actual XCTest input; original timing. Cold relaunch and the installed icon are also checked outside this clip." />

[Vue Router NS](https://vue-router-ns.rafaelaugusto.dev/guide/splash) drives the home, collection and example pages through native page stacks. Back returns to the existing search/filter state. The first page mounts underneath the splash; the splash never enters navigation history. Jolt animates its logo, wordmark and exit, and skips those animations for Reduced Motion. The iOS system launch screen uses the same solid background before JavaScript starts.

Home animations stop when navigating away. Detail pages mount only the selected experiment and release it when leaving. Demo-specific timing controls reset on leaving a detail, and SceneKit-only experiments show an availability message on Android. This walkthrough validates the new shell on iOS; it is not Android native-validation evidence.

The iOS app resources now live in the repository, including the **Jolt** display name and icon. Launching from the installed icon opens Studio without special arguments. The app requires Core 9.1.3+ and installs `vue-router-ns@0.1.0-rc.2` for this preview.

## Light, dark or your device

Tap **◐** in the Studio header to choose **Light**, **Dark**, or **System**. The choice updates the splash, Studio, collection, search, language page and experiment controls immediately, and stays saved after closing the app. **System** follows the device’s appearance, including changes while the app is open.

On iOS, a circular Jolt reveal opens the new theme from the selected control, with the previous appearance underneath. System changes reveal from the center of the visible page. Reduced Motion applies the final theme immediately; Android currently switches immediately because circular reveal is iOS-only.

The native artwork and animation stages retain their own palettes; changing the interface theme does not restart a running experiment or change its animation settings.

<Clip name="showcase-appearance-ios" caption="iOS 26.2 simulator: real XCTest taps reveal light → dark from the selected control, browse and search the collection, play with springs, return to light, then follow live system appearance changes. Original timing. Additional native checks verify persistence after relaunch and Portuguese labels. This does not establish Android or physical-device validation." />

## Language

Studio follows the phone language by default: Portuguese uses Brazilian Portuguese, Spanish variants use Spanish, and Chinese variants use Simplified Chinese; unsupported languages use English. Tap **Language** at the top of Studio to choose **Follow device**, **English**, **Português**, **Español**, or **简体中文**. Changes apply immediately and the choice persists after closing the app. Choosing **Follow device** removes the override; the preferred language is read again when the app resumes.

The splash, collection, all 69 experiment presentations, controls, status messages and accessibility labels are localized. Search accepts translated or English names, with or without accents. Rolling account numbers use the selected language’s separators. Animation API identifiers such as `popIn` remain unchanged; the isolated technical playground keeps its English fixtures.

<Clip name="showcase-language-ios" caption="iOS 26 simulator: real XCTest taps switch English → Portuguese, search for camera without an accent, operate the native camera lens, and switch back to English. Original timing. Separate native checks verify persistence and automatic language selection using iOS preferred-language launch settings; this does not validate Android or a physical device." />

<Clip name="showcase-portuguese-ios" caption="All 54 collection entries in Brazilian Portuguese on the iOS 26 simulator, with representative native interactions. A montage of separate captures at their original speed, including the optional local car model. Not every technical control is exercised." />

<Clip name="showcase-splash-pt-ios" caption="Real cold launch in Portuguese on the iOS 26 simulator, including the animated splash and localized Studio. Original timing, captured separately from XCTest startup synchronization." />

## Motion Studio interiors

The collection now presents each experiment as an interactive composition: a playlist for stagger, an account for rolling digits, a record player for drag values, tactile cards for press feedback, and coordinated signals for value bindings. The four automotive entries keep their SceneKit studio. The showcase has a focused set of controls; the isolated playground still exposes the detailed probes and technical options.

The splash opens with expanding rings, an orbiting accent, the Jolt mark and a staggered wordmark before revealing Studio. It respects Reduced Motion and waits for the initial route. The images in the gallery and gesture card are generated editorial artwork bundled with the app; the image tests still use their original grid fixtures. These are motion demonstrations, not a banking, music or travel service.

<div class="clips">
<Clip name="showcase-springs-ios" caption="iOS 26 simulator: taps interrupt the spring and hand off to another response. Original timing." />
<Clip name="showcase-presets-ios" caption="iOS 26 simulator: pop, shake, bounce and pulse on the native poster. Real taps; original timing." />
<Clip name="showcase-colors-ios" caption="iOS 26 simulator: background, lettering and border interpolate through three palettes. Original timing." />
<Clip name="showcase-forms-ios" caption="iOS 26 simulator: corners, border, rotation and shadow, including stopping mid-transition. Original timing." />
</div>

The following montages join separate native captures between examples. All interactions use real XCTest input on the iOS 26 simulator; playback timing is unchanged. They do not establish physical-device performance or Android behavior.

<Clip name="showcase-motion-ios" caption="Momentum, stagger, paths, timelines, playback, loops, pauses, organic timing, track easing, easing curves and motion settings. The settings example explicitly selects half speed and Reduced Motion." />
<Clip name="showcase-touch-ios" caption="Press-and-hold feedback, live springs, a draggable music sheet, haptic requests, photo gestures, carousel/scroll handoff, drag/snap and a keyboard-following composer. A simulator shows haptic requests, not physical vibration." />
<Clip name="showcase-visual-ios" caption="Linear/radial/conic gradients, reactive gradient moods and values, shimmer, particles, loaders, reveals, fade/overflow and light trails. Reveal explicitly selects 1600 ms; light trails explicitly selects the app’s slow-motion mode." />
<Clip name="showcase-type-ios" caption="Animated letters and words, rolling amounts, changes in digit count and type size, and native SF Symbol effects." />
<Clip name="showcase-layout-ios" caption="Inserting/reordering/resizing cards, actual layout dimensions, remounting, animated list rows and an album header linked to native scrolling." />
<Clip name="showcase-state-ios" caption="A coordinated sheet/backdrop, observers, value layers, layered motion, upload states, per-target transitions, Vue directives and spring comparison. Busy JavaScript shows its Android availability message only." />
<Clip name="showcase-images-ios" caption="Real ripple and dissolve effects on the bundled artwork, followed by native photo zoom and reset. iOS 26 simulator; original timing." />

### Automotive studio · iOS

The three SceneKit experiments share a reflective studio. **Camera lens** animates field of view while the camera stays in place. **Lights & materials** changes lighting and body finish. **Environment & shaders** binds a motion value to environment intensity, key-light intensity, a glass-shading uniform and a headlamp-color uniform. These are native Jolt adapters; JavaScript selects the destination and swaps the environment image on a tap, without an observer setting SceneKit properties every frame.

<div class="clips">
<Clip name="showcase-atelier-ios" caption="iOS 26 simulator: lens transitions, seeking halfway, resuming and changing body finish. Real native SceneKit rendering and XCTest input; local detailed model; original timing." />
<Clip name="showcase-lighting-ios" caption="iOS 26 simulator: daylight, warm studio light, copper paint and night lighting. Local detailed model; original timing." />
<Clip name="showcase-shaders-ios" caption="iOS 26 simulator: environment and glass/headlamp shader uniforms driven by a shared motion value. Local detailed model; original timing. This demonstrates shading, not a cabin interior or fluid simulation." />
</div>

**Maps & 3D → Timeline** follows a curved route through an illustrated waterfront. Travel, destination pulse, progress and the delayed checkpoint share the timeline and pause together. The Native map tab still animates the real map adapter.

<Clip name="showcase-journey-ios" caption="iOS 26 simulator: the redesigned coordinated journey, pause/resume, the native map and return to the automotive camera. Real XCTest input; original timing; the car uses the optional local model." />

**Maps & 3D → 3D camera** uses the same automotive studio in Motion Studio. Its native pose adapter moves the camera between two views of the car, with pause, resume, stop and replay. Switching tabs resets the displayed progress and recreates the scene bindings when returning.

<Clip name="showcase-camera-orbit-ios" caption="iOS 26 simulator: the actual Maps & 3D camera tab, moving around the detailed car, pausing/resuming, replaying, stopping and returning from Timeline. Real XCTest input; original timing; optional local model. Not physical-device performance evidence." />

<Clip name="showcase-native-reentry-ios" caption="iOS 26 simulator: opening and reopening all four automotive entries in one app session. Each return mounts the native studio again, including the 3D camera tab. Real XCTest navigation; local detailed model; original timing." />

The detailed car in these recordings is a local preview asset from the separate `jolt-car` project. It is **not distributed in this repository** while its source/redistribution terms are unrecorded. To use an authorized model with the same material layout locally, place it at `demo/App_Resources/iOS/preview-car.usdz`; otherwise the demo uses its procedural car. The studio environment is drawn in code. These simulator clips are not physical-device performance evidence.

## Assistant example

The earlier assistant is still available with `--screen=home` (iOS) or `--es screen home` (Android). It has three screens:

<div class="clips">
<Clip name="assistant-flow" caption="The assistant replaying its flow on the iOS simulator." />
<Clip name="assistant-flow-android" caption="The same flow on the Android emulator." />
</div>

<div class="clips">
<Clip name="assistant-chat" caption="The audio bubble counting down with rollTo() on iOS." />
<Clip name="assistant-chat-android" caption="The countdown on Android." />
</div>

- **Home:** a letter-by-letter greeting, spring-driven document cards and a pulsing search button. Tap a card or swipe across the fan to change the selection. The search button opens Voice.
- **Voice:** a floating orb, a staggered transcript and pause/resume controls. Tap the microphone to open Chat.
- **Chat:** messages and document cards enter in stages. Open a document preview, play the waveform preview and watch its time roll down second by second, or send a message. Sent messages stay in memory while you switch screens.

Screens change through a short cross-fade, one leaving before the next enters. Open the question-mark button on Home, then **Watch demo**, to replay Voice → Chat → Home → Voice. Navigation, swiping, sending a message or opening a preview interrupts the replay.

## Run

Install the [NativeScript CLI](https://docs.nativescript.org/setup/), then run:

```sh
# Repository root, in one terminal
npm install
npm run dev

# In another terminal
cd demo
npm install
ns run ios
```

`ns run android` opens the collection. In the assistant example, icons come from the Material Icons font instead of SF Symbols, the system adjusts the window for the keyboard instead of a keyboard observer, and the orb keeps its breathing motion without the liquid deformation.

The animation playground opens with `--playground` on iOS and `--es playground true` on Android. This retains the earlier single-page gallery for isolated recordings and probes; normal launches use Motion Studio.

Open **Image effects and photo zoom** in the playground for ripple, distortion, dissolve and the native photo viewer. Launch it directly with `--image-lab=effects` or `--image-lab=zoom` on iOS; use `--es image-lab effects` or `--es image-lab zoom` on Android. The fixture has a colored grid and a transparent destination corner so displacement, cropping and alpha are visible. The viewer includes zoom/reset/close buttons, cancellation and repeated reattachment controls.

For an installed iOS Simulator build, pass a preview argument when launching:

```sh
xcrun simctl launch booted org.nativescript.jolt --autoplay
xcrun simctl launch booted org.nativescript.jolt --screen=voice
xcrun simctl launch booted org.nativescript.jolt --screen=chat
xcrun simctl launch booted org.nativescript.jolt --playground
```

On Android the same names go in as string extras of the start intent:

```sh
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es autoplay true
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es screen chat
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es playground true
```

Terminate the running app before launching with different arguments. Without arguments, the app opens Motion Studio. Use `--screen=home` for the assistant.

Two more arguments help a review or a recording reach a point without touching the screen. `--tap=<text>[,<text>...]` works in both demos: it fires the tap of the first view whose text or accessibility label equals each entry, climbing to the nearest ancestor with a tap handler, one every `--every` milliseconds (1200 by default). `--section=<heading>` is for the playground and scrolls to the first section whose heading starts with that text, ignoring case:

```sh
xcrun simctl launch booted org.nativescript.jolt --playground --section=text --tap=Letters
xcrun simctl launch booted org.nativescript.jolt --playground --section=rolling "--tap=+ 1.10,Random" --every=2000
xcrun simctl launch booted org.nativescript.jolt --screen=home "--tap=Help,Watch demo" --every=2000
```

The Android form adds `playground`:

```sh
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es playground true --es section text --es tap Letters
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es tap "Help,Watch demo"
```

## Motion

The assistant uses public Jolt APIs: `animate()` for transforms and opacity, `animateText()` for the greeting and transcript, [`rollTo()`](./rolling) for the audio countdown, and the [Vue entry](./vue) for the rest: `v-press` on every button, and `JoltTransition` for the screen changes (`mode="out-in"`) and for the document sheet, which fades out before Vue removes it. Card selection snaps on release; it does not bind animation progress to the gesture.

Native animation handles and stage timers belong to each mounted screen. Unmounting or suspending the app cancels its work. Returning to the foreground rebuilds the current screen. Reduce Motion is Jolt's job through the default [`reducedMotion: 'user'`](./configure): text appears immediately, transforms jump and fades still play. The demo only adds content decisions on top, showing the staged chat at once and skipping its decorative loops; a setting change refreshes the current screen.

## Sample content

This is a local UI demo. It does not record speech, search files, play audio or contact a service. Document previews and the 37-second waveform are simulated; typed messages last only for the current app session.

The orb uses one transparent bitmap. On iOS, [`liquid()`](./liquid) deforms its texture with a native repeating warp while `animate()` controls its scale, rotation, position and opacity; on Android only the `animate()` motion plays. Pause freezes both motions. The colored folds come from the artwork; this is texture deformation rather than a fluid simulation.

The iOS icons are SF Symbols. On Android, `Icon.vue` draws the Material Icons glyph of the same meaning from a font bundled with the demo (Apache License 2.0).

The tuning section at the top of the playground sets the global [time scale and reduced-motion preference](./configure), so every section below can be watched in slow motion or with transforms jumping to their end.

The playground also includes [playback controls](./playback): pause a card, choose a frame with a slider, and continue, with an independent pulse running beside it.

The [scroll-linked header](./scroll-linked) moves and fades the large heading as the main ScrollView advances, revealing a fixed compact title. Scrolling back restores it.

The Keyboard section shows a composer pinned to the bottom of the playground; [`followKeyboard()`](./keyboard) lifts it with the software keyboard and lets it back down when the keyboard hides.

The [timeline demo](./sequences) compares overlapping entrances, one-at-a-time arrivals and fixed start times, with replay and stop controls.

The [list rows demo](./lists) scrolls sixty rows that fade in as they appear, with a toggle for animating each item once and a button that swaps in new items.

The [path playground](./paths) follows a cubic curve or an arc-based orbit, with orientation, replay, pause/resume and stop controls.

<Clip name="reorder-pt-ios" caption="New in this checkout: the 55th experiment, list reordering, in Portuguese on the iOS simulator. Real drag, native neighbour movement and the button alternative." />

[Shared layouts](./shared-layout) is experiment 56 in this checkout: move a tab indicator and an album cover between different view trees.

[Interaction replay](./interaction-replay) is experiment 57: record a spring or a cancelled drag, accept a frozen engine baseline, replay through the native probe and detect a deliberately wrong checkpoint.

[Curve precision](./transitions#adaptive-keyframes) is experiment 58: compare adaptive and fixed-rate native playback, inspect point counts and run the native precision checks.

[Motion inspector](./motion-inspector) is experiment 59: select a view without changing it, compare native observations, identify property owners, tune/replay a spring and copy TypeScript.

[Shared navigation](./shared-navigation) is experiment 60: open a photo or day-pass card in another route, then return to its current source with native Jolt motion.

[Interactive navigation](./interactive-navigation) is experiment 61: peek back with an edge drag, cancel, then commit the return on iOS.

[Predictive back](./predictive-back) is experiment 62: native Android edge progress, cancellation, guarded return and a bilingual dusk scene.

[Shared gestures](./shared-gestures) is experiment 63: image and card follow native back gestures, with cancellation and an accessible button.

<Clip name="showcase-languages-ios" caption="iOS 26.2 simulator: real touches select Spanish and Simplified Chinese, open the translated collection and native scroll composition, then return to the language selector. Separate checks cover saved choices and device-language selection. Original speed; no physical-device claim." />
