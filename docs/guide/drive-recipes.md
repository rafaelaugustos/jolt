# Motion recipes from Jolt Drive

Four reusable patterns from [Jolt Drive](https://github.com/rafaelaugustos/jolt-drive), reviewed at commit `2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f`. The recipe pages provide the complete source file, an adaptation prompt and a new native recording for each interaction. The files use Jolt RC.10 and NativeScript-Vue 3; they are project code with the dependencies listed below.

The recordings below show the actual application on an iPhone 17 Pro simulator with iOS 26.2, using real idb input at original speed. They are not physical-device performance evidence. The charge-sheet build differs from the published source only in erased TypeScript type imports; the interaction code matches.

## Panel, camera and card reveals {#cockpit}

[Open recipe and copy the source](/recipes/drive-cockpit) · [Source in the project](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/pages/Home/useCockpitGesture.ts)

The gesture hook binds a vertical pan to the panel and copies its position into the shared offset. Home maps that offset to camera framing; ControlSheet maps it to the arrow, summaries and staggered card reveals. Release projects position using velocity × 0.18 before choosing open or closed.

<Clip name="drive-cockpit-ios" :width="320" caption="Jolt Drive · iPhone 17 Pro simulator, iOS 26.2. Real idb interaction in the native app, original speed. English UI; not a physical-device recording or performance measurement." />

**Setup.** Use NativeScript-Vue template refs named root (GestureSurface) and scrollContent (ScrollView), an offset motion value, measured height/closed positions and active state. Home and ControlSheet map that offset to the camera and cards; the gesture hook alone does not create a 3D scene.

**Lifecycle and adaptation.** Call useCockpitGesture during component setup. Keep root and scrollContent mounted when its hooks run. Feed active from the page lifecycle. The hook pauses input when inactive and releases its position subscription, binding and gesture controller on unmount. Read Home/index.vue and ControlSheet.vue for the shared progress consumers.

## Selection driven by a spring {#atmosphere}

[Open recipe and copy the source](/recipes/drive-atmosphere) · [Source in the project](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/pages/Home/AtmosphereOption.vue)

One target switches between 0 and 1. A spring with stiffness 420, damping 30 and mass 1 drives background color, border color, corner radius and text color together. The parent changes selected; it owns the application theme.

<Clip name="drive-atmosphere-ios" :width="320" caption="Jolt Drive · iPhone 17 Pro simulator, iOS 26.2. Real idb interaction in the native app, original speed. English UI; not a physical-device recording or performance measurement." />

**Setup.** Provide name, color and selected props, handle the select event, and install the Jolt Vue plugin for v-press. Copy or replace the project’s springs.snap and withAlpha helpers. The parent owns which option is selected; SceneKit is not required.

**Lifecycle and adaptation.** Keep the Jolt Vue plugin and useMotionScope: the component’s follower and bindings belong to its scope. Replace the two @/themes imports with local equivalents or copy the matching helpers. Use selection as state; do not create a new spring on every tap. The existing Jolt reduced-motion policy applies.

## A sheet over a blurred background {#charge-sheet}

[Open recipe and copy the source](/recipes/drive-charge-sheet) · [Source in the project](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/pages/Home/EnergyPlan.vue)

Only the garage background is blurred. The sheet is a sharp sibling with content and 90% snap points, a scroll view and a backdrop. When blur has no backend, the example increases backdrop opacity. Save and close share the same dismissal path.

<Clip name="drive-charge-sheet-ios" :width="320" caption="Jolt Drive · iPhone 17 Pro simulator, iOS 26.2. Real idb interaction in the native app, original speed. English UI; not a physical-device recording or performance measurement." />

**Setup.** Register GestureSurface and Jolt’s Vue directives. Supply accent, level, limit and the mounted garage background view; render the sheet as its sibling. Adapt Icon, safeArea and theme helpers. Handle save/close without unmounting before dismissal finishes.

**Lifecycle and adaptation.** Keep the sheet outside the blurred background’s subtree. onDismiss waits for blur to clear before emitting close, with a disposed guard. Preserve useMotionScope and dispose the blur owner on unmount. If adapting to a modal, the host must also own focus restoration, semantics and page lifecycle.

## From orbit to the cabin {#cabin}

[Open recipe and copy the source](/recipes/drive-cabin) · [Source in the project](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/components/scene/Car3D.vue)

The camera first aligns with the doorway, then inside moves from 0 to 1 over 1900 ms; leaving takes 1400 ms. The renderer binds position, focus, field of view, lighting and materials to this progress. The doorway path is a quadratic interpolation in the camera rig’s coordinates.

<Clip name="drive-cabin-ios" :width="320" caption="Jolt Drive · iPhone 17 Pro simulator, iOS 26.2. Real idb interaction in the native app, original speed. English UI; not a physical-device recording or performance measurement." />

**Setup.** iOS only. Requires the project’s SceneView/createCarStage renderer, camera-path helpers, model, materials and ClimatePanel, plus @rafaelaugusto/jolt-native. Use your own scene measurements. Car3D is the complete source, not a standalone camera helper or a Web implementation.

**Lifecycle and adaptation.** Read Car3D.vue together with car-stage.ios.ts and camera-path.ts. Adapt doorway, eye and focus to your model instead of copying its coordinates. Preserve revision guards, reduced-motion checks, active/foreground handling and the distinction between long-lived native property owners and recreated bindings. SceneKit is iOS-only; this is not the Web API.

## Recordings and source provenance {#provenance}

Source files are stored as reviewed snapshots and checked by SHA-256. The source button points to the pinned commit, so the recipe does not silently change with main. Run the full project for the surrounding interface and assets.
