# Vena motion recipes

A heart made of light. Two hundred thousand points form a body that reacts, pulses and draws you closer.

Built by Rafael Augusto with NativeScript-Vue and Jolt RC.11. SceneKit draws 160,000 torso points and 40,000 heart points, with an additional heart glow pass. Jolt drives shader uniforms, focus and interface motion. The particle scene is iOS-only. Sample rhythms; no heart-rate measurement or HealthKit connection.

[Explore the two recipes](/recipes/?q=Vena) · [View the project](https://github.com/rafaelaugustos/vena-ns)

<Clip name="vena-native-ios" :autoplay="false" poster="/media/vena-native-ios.jpg" :width="320" caption="Vena on iOS: creator-provided English recording of the opening, particle heartbeat, rhythm collection and heart focus. Original speed, 60 fps export, no audio; the first 3.25 seconds of system home and launch are omitted. Capture device unspecified; not a performance measurement. BPM readings are illustrative." />

## A rhythm of your own. {#opening}

[A rhythm of your own.](/recipes/vena-opening) · [GitHub](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/motion/entrance.ts)

opening coordinates title, caption, skip affordance and strokeEnd on a vector signal. revealInterface brings the header, card, footer and hint into place on one timeline. WelcomeOverlay waits for loaded views, ignores completion after disposal and exposes skip. The heart formation is coordinated separately in App.vue. The recording shows the normal opening; reduced-motion and unload behavior are described from source.

NativeScript-Vue 3 and Jolt RC.11. Call opening with four loaded native views; title, caption and skip start at opacity 0. The rule hosts a 190×30 vector path. WelcomeOverlay.vue shows the completion/skip guard and disposal. revealInterface takes an owned MotionScope and four mounted views. Dispose the returned opening handle and your interface scope on unload. This file animates text, the path and interface entrance; the particle heart needs HeartScene and its assets. Preserve reduced-motion handling. iOS is the recorded platform.

## A heart made of light. {#heart}

[A heart made of light.](/recipes/vena-heart) · [GitHub](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/scene-view.ios.ts)

A motionValue repeats from 0 to 1 in 60000 / bpm milliseconds and binds to the beat uniform. Separate ripple and heartTap values keep tap waves independent of the automatic beat. Springs animate focus, pointer position and orbit. The GPU shader deforms the cloud; JavaScript does not update each point every frame. The clip shows pulsation and focus changes. Suspend/resume, reduced motion and pointer-helper setup were reviewed in source, not demonstrated as separate test cases in this clip.

iOS only: NativeScript-Vue 3, Jolt RC.11, its native companion and SceneKit. This complete HeartScene class depends on shaders.ts, anatomy.ts, cloud-data.ts, heart-space.ts, pointer.ios.ts, simulator-pointer.ios.ts and bundled torso.bin/heart.bin. See the pinned repository for view registration and sceneReady wiring. Jolt drives typed float/float2/float3 shader uniforms, while SceneKit renders the cloud. Preserve hit testing in the animated pose, independent heartbeat/tap clocks, rendering gates, reduced motion, suspend/resume, listener removal and property/scope disposal. Simulator hover uses a development-only Swift helper; it is not phone touch input. Preserve BodyParts3D © DBCLS CC BY 4.0 attribution and MakeHuman CC0 provenance. No Android or Web renderer is supplied by this recipe.

## Source and integration

- [src/App.vue](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/App.vue)
- [src/components/WelcomeOverlay.vue](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/components/WelcomeOverlay.vue)
- [src/scene/shaders.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/shaders.ts)
- [src/scene/anatomy.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/anatomy.ts)
- [src/scene/cloud-data.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/cloud-data.ts)
- [src/scene/heart-space.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/heart-space.ts)
- [src/scene/pointer.ios.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/pointer.ios.ts)
- [src/scene/simulator-pointer.ios.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/simulator-pointer.ios.ts)
- [src/assets/anatomy](https://github.com/rafaelaugustos/vena-ns/tree/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/assets/anatomy)
- [README.md](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/README.md)

## Credits {#credits}

Heart: BodyParts3D © The Database Center for Life Science (DBCLS), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), prepared by OrganUI. Vena sampled the exterior into 40,000 points, omitted cavities, changed scale, position and colors, and added artistic deformation and lighting. Torso: MakeHuman hm08, CC0; posed, cropped and sampled into 160,000 points. This site trims and compresses the recording and crops still frames; it does not modify the anatomical assets. [Full attribution, sources and modification notices](/media/vena-attribution.txt). DBCLS does not endorse this demo.

## The website in motion

<Clip name="vena-site-chromium" :width="960" caption="Chromium on macOS arm64: Vena home scroll motion, native playback, showcase and both recipe pages with code and prompt copying. Original-speed browser recording; embedded iOS footage is the creator’s English recording, capture device unspecified. The community listing uses an empty local review fixture." />
