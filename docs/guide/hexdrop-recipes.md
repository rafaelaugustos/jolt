# The Hexdrop motion recipe

[Hexdrop](https://github.com/rafaelaugustos/hexdrop) turns a file card into an ingredient for a native potion. This recipe preserves the complete `useIngredientDrag.ts` from commit `ebdc02a2652051c982779ea43ba3d76cf99bb538`, using NativeScript-Vue 3 and Jolt **0.1.0-rc.11**.

## A drag with a destination {#ingredient-drag}

[Get the drag recipe](/recipes/hexdrop-drag) · [GitHub](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/composables/useIngredientDrag.ts)

Jolt `drag()` tracks the card and `snap: [0]` springs it home after a rejected drop. The app scales it to 0.86, tilts it with horizontal travel, and compares its transformed bounding rectangle with the vial in window coordinates. An accepted drop pauses the gesture controller and absorbs the card over 200 ms before calling `onDrop`.

<Clip name="hexdrop-native-ios" :width="320" caption="Hexdrop · iPhone 17 Pro simulator, iOS 26.2. Real idb drags: spring return, accepted drop, ignition, fill and stopper swing. English UI, original speed, silent capture. Local interaction demo; no file is uploaded. Not a physical-device performance measurement." />

Call `useIngredientDrag` during component setup. Connect its `loaded` and `tap` handlers to the native card. Supply `disabled`, a `target()` returning window-space bounds, and the `onStart`, `onHover` and `onDrop` callbacks. Copy `transformedRect`, `intersects` and the `Rect` type from the pinned geometry module; read the panel for the complete integration. Jolt supplies the drag mechanics; the app supplies the drop rule.

Keep the gesture controller separate from the animation scope: resetting visual feedback must not remove input. Preserve the generation guard around absorption, the final-release hit test, the tap suppression after dragging, and the background/unmount cleanup. A canceled or disposed drop must not start a later brew. The tap and labeled Brew potion button provide alternatives to dragging; keep them when adapting the pattern.

The copied hook does not render the potion or upload a file. The full native scene lives in `potion-view.ts`: a 540 ms ignition, an 8.4 second fill driven by a motion value, liquid path morphs, particles and a spider transferred to the stopper pivot. Its lifecycle and reduced-motion handling belong to that scene. Run the full project for this artwork. The recording verifies iOS simulator playback only; Android and Web are not demonstrated.

## An entrance with a shared clock {#launch}

[A little opening spell.](/recipes/hexdrop-launch) · [GitHub](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/launch/launch-animation.ts)

The 1550 ms timeline overlaps the floating mark, radial glows, a drawn hexagonal stroke, particles and staggered title/caption. After reveal mounts the real content, a 320 ms fade removes the overlay. With Reduce Motion, it skips the effects and uses a brief hold and fade. Copy the complete source with the component structure and asset linked below.

<Clip name="hexdrop-launch-ios" :width="320" caption="Hexdrop launch on iOS: the 3.8–7.0 second excerpt of the creator-provided recording. Floating mark, traced seal, particles, light wave and app reveal. English UI, original speed, no audio. Capture device unspecified; not a performance measurement." />

NativeScript-Vue 3 and Jolt RC.11. Supply the measured, mounted native GridLayout and child IDs from LaunchScreen.vue, its styles and hexdrop-mark.png. Keep drawing surfaces at fixed bounds and transform their containers. The reveal callback mounts app content and awaits nextTick before the overlay fades. Own the returned handle, await finished and call dispose on permanent unload; preserve the reduced-motion branch and failure fallback. The system launch screen is static; this timeline starts after NativeScript is ready. iOS simulator playback only.

[LaunchScreen.vue](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/components/LaunchScreen.vue) · [App.vue](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/App.vue) · [hexdrop-mark.png](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/assets/hexdrop-mark.png)

## Source and integration

- [useIngredientDrag.ts](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/composables/useIngredientDrag.ts)
- [geometry.ts](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/potion/geometry.ts)
- [IngredientPanel.vue](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/components/IngredientPanel.vue)
- [potion-view.ts](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/potion/potion-view.ts)
- [README](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/README.md)

## The site in motion

<Clip name="hexdrop-site-chromium" :width="960" caption="Chromium on macOS arm64. Actual pointer and keyboard interaction with the Hexdrop home feature, showcase and recipe, including source and prompt copying. Original speed. Embedded footage includes the creator’s iOS recording (device unspecified) and the drag recipe on an iPhone 17 Pro simulator; these are not Web ports. The unchanged community listing is isolated with an empty local test fixture." />

<Clip name="hexdrop-creator-ios" :width="320" caption="Hexdrop on iOS: creator-provided recording of the animated launch, dragging, brewing, document picker and replay. Original speed, no audio; the first 3.8 seconds of the system home and launch transition are omitted. Capture device unspecified. Local demo; no file is uploaded." />
