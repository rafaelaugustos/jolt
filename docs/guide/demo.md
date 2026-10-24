# Demo app

The NativeScript-Vue app in [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) uses the local Jolt build. A normal launch opens **Jolt Motion Studio**: an animated brand splash, a moving home, and a searchable collection of 54 experiments grouped by Motion, Touch, Visual, Type, Layout, State and SceneKit.

<Clip name="showcase-splash-ios" caption="Real iOS 26 simulator cold launch: the system launch screen leads into the native animated brand splash and Studio. Captured without XCTest launch synchronization; original timing. Not physical-device performance evidence." />

<Clip name="showcase-ios" caption="Real iOS 26 simulator recording: springs, native gestures, category filtering, search, SceneKit playback and return navigation. Actual XCTest input; original timing. Cold relaunch and the installed icon are also checked outside this clip." />

[Vue Router NS](https://vue-router-ns.rafaelaugusto.dev/guide/splash) drives the home, collection and example pages through native page stacks. Back returns to the existing search/filter state. The first page mounts underneath the splash; the splash never enters navigation history. Jolt animates its logo, wordmark and exit, and skips those animations for Reduced Motion. The iOS system launch screen uses the same solid background before JavaScript starts.

Home animations stop when navigating away. Detail pages mount only the selected experiment and release it when leaving. Demo-specific timing controls reset on leaving a detail, and SceneKit-only experiments show an availability message on Android. This walkthrough validates the new shell on iOS; it is not Android native-validation evidence.

The iOS app resources now live in the repository, including the **Jolt** display name and icon. Launching from the installed icon opens the collection without special arguments. The app requires Core 9.1.3+ and installs `vue-router-ns@0.1.0-rc.2` for this preview.

## Motion Studio interiors

Springs, presets, colors and decorations each have a dedicated interactive stage. The remaining experiments share the collection's typography, spacing and controls; the embedded gesture and live-spring pages use the collection header.

<div class="clips">
<Clip name="showcase-springs-ios" caption="iOS 26 simulator: real taps interrupt the spring and hand off to a different response. Original timing." />
<Clip name="showcase-presets-ios" caption="iOS 26 simulator: pop, shake, bounce and pulse on the native poster. Real XCTest taps; original timing." />
<Clip name="showcase-colors-ios" caption="iOS 26 simulator: background, lettering and border interpolate together through three palettes. Original timing." />
<Clip name="showcase-forms-ios" caption="iOS 26 simulator: animated corners, border, rotation and shadow, including stopping mid-transition. Original timing." />
</div>

<Clip name="showcase-interiors-ios" caption="iOS 26 simulator: native interactions in drag values, layout, dimensions, image effects, playback and light trails, plus the Android-only experiment message. Separate captures joined between examples; interaction timing unchanged. Light trails explicitly selects the app’s 0.2× slow-motion mode. No physical-device performance claim." />

### Automotive studio · iOS

The three SceneKit experiments share a reflective studio. **Camera lens** animates field of view while the camera stays in place. **Lights & materials** changes lighting and body finish. **Environment & shaders** binds a motion value to environment intensity, key-light intensity, a glass-shading uniform and a headlamp-color uniform. These are native Jolt adapters; JavaScript selects the destination and swaps the environment image on a tap, without an observer setting SceneKit properties every frame.

<div class="clips">
<Clip name="showcase-atelier-ios" caption="iOS 26 simulator: lens transitions, seeking halfway, resuming and changing body finish. Real native SceneKit rendering and XCTest input; local detailed model; original timing." />
<Clip name="showcase-lighting-ios" caption="iOS 26 simulator: daylight, warm studio light, copper paint and night lighting. Local detailed model; original timing." />
<Clip name="showcase-shaders-ios" caption="iOS 26 simulator: environment and glass/headlamp shader uniforms driven by a shared motion value. Local detailed model; original timing. This demonstrates shading, not a cabin interior or fluid simulation." />
</div>

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
