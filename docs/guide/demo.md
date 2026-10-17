# Demo app

The NativeScript-Vue app in [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) uses the local Jolt build. On iOS it opens an assistant with three screens:

- **Home:** a letter-by-letter greeting, spring-driven document cards and a pulsing search button. Tap a card or swipe across the fan to change the selection. The search button opens Voice.
- **Voice:** a floating orb, a staggered transcript and pause/resume controls. Tap the microphone to open Chat.
- **Chat:** messages and document cards enter in stages. Open a document preview, toggle the waveform preview or send a message. Sent messages stay in memory while you switch screens.

Open the question-mark button on Home, then **Watch demo**, to replay Voice → Chat → Home → Voice. Navigation, swiping, sending a message or opening a preview interrupts the replay.

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

Android opens the animation playground with `ns run android`. The iOS playground includes the same sections plus iOS-only helpers.

For an installed iOS Simulator build, pass a preview argument when launching:

```sh
xcrun simctl launch booted org.nativescript.jolt --autoplay
xcrun simctl launch booted org.nativescript.jolt --screen=voice
xcrun simctl launch booted org.nativescript.jolt --screen=chat
xcrun simctl launch booted org.nativescript.jolt --playground
```

Terminate the running app before launching with different arguments. Without arguments, the assistant opens Home.

## Motion

The assistant uses public Jolt APIs: `animate()` for transforms and opacity, `animateText()` for the greeting and transcript, and `press()` for touch feedback. Card selection snaps on release; it does not bind animation progress to the gesture.

Native animation handles, stage timers and touch bindings belong to each mounted screen. Unmounting or suspending the app cancels its work. Returning to the foreground rebuilds the current screen. Reduce Motion displays text immediately, removes movement and disables decorative loops; a setting change refreshes the current screen.

## Sample content

This is a local UI demo. It does not record speech, search files, play audio or contact a service. Document previews and the 37-second waveform are simulated; typed messages last only for the current app session.

The orb uses one transparent bitmap. [`liquid()`](./liquid) deforms its texture with a native repeating warp while `animate()` controls its scale, rotation, position and opacity. Pause freezes both motions. The colored folds come from the artwork; this is texture deformation rather than a fluid simulation.

The playground also includes [playback controls](./playback): pause a card, choose a frame with a slider, and continue, with an independent pulse running beside it.

The [scroll-linked header](./scroll-linked) moves and fades the large heading as the main ScrollView advances, revealing a fixed compact title. Scrolling back restores it.

The [timeline demo](./sequences) compares overlapping entrances, one-at-a-time arrivals and fixed start times, with replay and stop controls.

The [list rows demo](./lists) scrolls sixty rows that fade in as they appear, with a toggle for animating each item once and a button that swaps in new items.

The [path playground](./paths) follows a cubic curve or an arc-based orbit, with orientation, replay, pause/resume and stop controls.
