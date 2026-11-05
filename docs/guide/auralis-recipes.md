# Motion recipes from Auralis

Two patterns from [Auralis](https://github.com/rafaelaugustos/auralis), reviewed at commit `e533eae13cbf5a78d59dcadc4e61f45f28de88f2` with NativeScript-Vue 3 and Jolt **0.1.0-rc.11**. Each recipe provides the complete source file and an adaptation prompt. The video shows the creator’s real iOS app; the capture device was not specified.

<Clip name="auralis-native-ios" :width="320" caption="Auralis on iOS: creator-provided recording of the animated launch, floating glass cards, three onboarding scenes and page controls. Original speed, no audio; the first 4.25 seconds of the system home and launch transition are omitted. Capture device unspecified; not a performance measurement. Accounts and services are illustrative." />

## Into the light. {#cards}

[Explore this recipe](/recipes/auralis-cards) · [GitHub](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/scene/choreography.ts)

The outgoing cards converge behind the lower horizon and fade before their replacements emerge. Entry uses a small overshoot and 42 ms stagger; exit reverses the order with 26 ms stagger. The helpers calculate motion only. AuroraView owns the masks, visibility, particles, timeline and cleanup.

NativeScript-Vue 3 and Jolt RC.11. These functions return keyframes and options; AuroraView schedules them in a scoped timeline. Supply CardLayout, the lower of both scenes’ visible boundaries (the larger y coordinate), and card index/count. Geometry uses a 402-point canvas with center x=201: adapt or scale it for your scene. Keep transition transforms on card.view and idle motion on card.art. Preserve the renderer’s reduced-motion fades, lifecycle guards and scope disposal. The helpers do not draw glass, text or particles; read aurora-view.ts and artwork.ts. iOS is the recorded platform.

## One clock. Every scene. {#clock}

[Explore this recipe](/recipes/auralis-clock) · [GitHub](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/composables/useCarouselClock.ts)

One motion value runs from 0 to 1 over 4000 ms. It fills the active indicator and calls advance when finished. useOnboarding stops it before changing scenes and restarts it after the new scene settles. toggle suspends or resumes the scope; a generation guard rejects callbacks from replaced timers.

Call useCarouselClock during NativeScript-Vue setup with an async advance callback. Bind progress to the indicator’s scaleX with originX=0, as in PageIndicator.vue. Call hold before navigation and start after the scene settles; wire playing/toggle to a labeled control. The hook defaults to paused if reduced motion or a screen reader is enabled at setup. Keep its generation guard, motion scope and unmount cleanup. Pausing holds the current timer; manual navigation resets the next reading interval. This hook supplies no views, swipe navigation or changing-settings listener. Read useOnboarding.ts for coordination.

The recording demonstrates launch, scene transitions, indicator progress and navigation. Background/resume and accessibility modes are described from the reviewed source and are not demonstrated by this video. The native APIs and geometry are not a Web implementation.

## Source and integration

- [aurora-view.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/scene/aurora-view.ts)
- [artwork.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/scene/artwork.ts)
- [useOnboarding.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/composables/useOnboarding.ts)
- [PageIndicator.vue](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/components/PageIndicator.vue)
- [onboarding.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/onboarding.ts)
- [README.md](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/README.md)

## The website in motion

<Clip name="auralis-site-chromium" :width="960" caption="Chromium on macOS arm64: browser walkthrough of the Auralis home feature, showcase, native playback and two recipe pages, including code and prompt copying. Original speed. The embedded native footage is the creator’s iOS recording, device unspecified. The unchanged community listing uses an empty local review fixture." />
