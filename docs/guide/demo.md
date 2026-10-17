# Demo app

The NativeScript-Vue app in [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) uses the local Jolt build. On iOS and Android it opens an assistant with three screens:

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

`ns run android` opens the same assistant. Its icons come from the Material Icons font instead of SF Symbols, the system adjusts the window for the keyboard instead of a keyboard observer, and the orb keeps its breathing motion without the liquid deformation.

The animation playground opens with `--playground` on iOS and `--es playground true` on Android. Both include every section; the iOS one adds the iOS-only helpers.

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

Terminate the running app before launching with different arguments. Without arguments, the assistant opens Home.

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
