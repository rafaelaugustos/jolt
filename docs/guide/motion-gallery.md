# The motion collection

The [Jolt homepage](/) and [recipe collection](/recipes/) combine an interactive Web playground with recordings from the native Motion Studio app. Search by name, filter by category, then open a recipe to watch its recording, copy the core API example, inspect the complete NativeScript Vue demo or copy an adaptation prompt.

## Try it in the browser

The opening combines oversized type with a chrome sculpture that follows the pointer, spins on click or keyboard activation, and keeps its momentum after a horizontal drag. Its small WebGL renderer belongs to this website; Jolt supplies motion values, springs, pointer following and inertial drag. A vector sculpture remains available when WebGL is unavailable or its context is lost. Rendering stops while the sculpture is offscreen or the document is hidden. Morrow’s two phones move with the scroll position, and the main action responds to the pointer. The playground runs spring, stagger and drag/snap through the existing experimental Jolt Web runtime. Its code is loaded with the homepage; regular reference pages do not load that runtime.

<Clip name="motion-site-chromium" :width="960" caption="Chromium on macOS arm64: actual pointer and keyboard interaction with the Jolt website, including the chrome sculpture and inertial drag, scroll-linked Morrow phones and playback, native-video preview, spring interruption, stagger, drag/snap, recipe search and copy actions. Original-speed browser recording. Recipe videos come from the iOS simulator; Morrow is a creator-supplied iOS capture with an unspecified capture device. This browser recording is not native-performance evidence." />

Each mounted interaction owns its runtime and disposes it when leaving the page. The sculpture observes geometry changes when the viewport resizes. The operating system's reduced-motion preference is respected; the footer also offers a persistent Reduce motion switch. Reduced motion prevents automatic recipe previews. Videos load on hover or focus and pause when leaving the card, viewport or document. Full recordings have standard playback controls.

## Native recordings

The gallery reuses reviewed native footage. The new clips below are trimmed from the Motion Studio recordings, without changing timing or synthesizing frames. The original recordings remain in the repository. Captions on every recipe identify the capture platform and limitations.

<Clip name="showcase-springs-ios" caption="iOS 26 simulator: real XCTest taps interrupt and retarget the native spring. Original playback speed; not a physical-device performance measurement." />
<Clip name="motion-recipe-drag-ios" caption="iOS 26 simulator: actual XCTest drag and release move the card and sheet into their snap positions. A continuous excerpt from showcase-touch-ios, at original speed. No physical-device performance claim." />
<Clip name="motion-recipe-gradients-ios" caption="iOS 26 simulator: actual XCTest input changes the native gradient composition. A continuous excerpt from showcase-visual-ios, at original speed. No physical-device performance claim." />

The circular reveal recipe retains the demo's selected 1600 ms duration. The confetti recipe includes native emitter playback and a confetti burst. Neither recording demonstrates physical haptics. The film and automotive example retain their original captions and playback controls. Older release notes and their recordings are preserved in [release history](./release-history).

## Code and prompts

Each core snippet is extracted from its versioned API guide at build time. It illustrates the animation API; the linked native demo contains the surrounding views, controls and lifecycle setup. Adaptation prompts include the package version, documented entry point, source reference, capture limitations, reduced motion and cleanup requirements. The native API and experimental Web API are not interchangeable.

The collection and its detail pages are available in English, Brazilian Portuguese, Spanish and Simplified Chinese. Filtering and search are represented in the URL. Language switching keeps the selected recipe.

## Reproduce the review

Run `npm run docs:check-media` and `npm run docs:build`. Start `npm run docs:preview -- --port 5181`, then run `npm run docs:test-site`. The browser review covers Chromium and WebKit, actual interactions, native MP4 playback, clipboard actions, filtering, four locales, desktop/mobile widths, reduced motion and navigation/remounting. Browser review artifacts default to `/tmp/jolt-motion-site-review`. Analytics are blocked and the existing community-list endpoint returns an empty fixture during this visual review; it does not test the production community service.

`scripts/motion-recipe-captures.json` records the original source clips and exact trim ranges. `node scripts/prepare-motion-recipe-media.mjs` reproduces the derived native clips and posters with FFmpeg. `node scripts/record-motion-site.mjs` records the site with real Playwright input; use the captioned MP4 above for the review, not screenshots as a substitute.

This site consumes existing Jolt Web APIs. It adds no engine capability and does not change Mavis application code.

The homepage includes an [exploratory physical-device study](./performance-study), with CPU, post-run PSS and presentation waiting in the same panel. All three metrics use the default cohort; the chart animates stored measurements. Its compact footer links to recipes, the showcase, the study, installation and the API, alongside reduced motion and back-to-top controls.

The Jolt Drive feature links to the public [project repository](https://github.com/rafaelaugustos/jolt-drive) and its [showcase](./showcase#jolt-drive). The published entrance preview keeps every source frame timestamp. The older Jolt Car walkthrough remains available below the homepage project card; its original recording is preserved.

<Clip name="jolt-drive-entrance-ios" :width="280" caption="Jolt Drive on iOS: the garage entrance from the published project GIF, converted to MP4 preserving all 113 frames and their timestamps. Capture device unspecified; not a rendering-performance measurement." />

## Take the motion with you

Four recipes from the real project: coordinated cockpit, spring-driven atmosphere selection, a charge sheet with background blur, and the camera journey into the cabin. Each includes native playback, reviewed source and an adaptation prompt.

[Explore the 4 recipes](/recipes/?q=Jolt%20Drive) · [Read the integration guide](./drive-recipes)
