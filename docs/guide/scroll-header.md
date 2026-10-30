# One scroll, a complete page

`scrollHeader()` connects a Core ListView to a measured hero, parallax artwork, a compact toolbar and one pinned section. Open **Made to scroll** in the bilingual preview: eighty recycled tracks, an asynchronously loaded cover with a taller title, insertion above the viewport and native scroll-to-item controls.

Available since **0.1.0-rc.1**. Rebuild the native app.

<Clip name="scroll-header-ios" caption="iOS 26.2 simulator, English: real drag, overscroll stretch, reversal, fling, a taller cover/title, insertion and programmatic return. Original speed; simulator correctness, not physical-device performance." />
<Clip name="scroll-header-ios-pt" caption="iOS simulator, Portuguese: the same native composition with actual OS input and translated controls." />
<Clip name="scroll-header-android" caption="Android 16 emulator, English: real scrolling through recycled rows, anchored layout changes and native scroll-to-item. This adapter uses ordinary Android overscroll without decorative hero stretch." />
<Clip name="scroll-header-android-pt" caption="Android emulator, Portuguese: actual input and the same page in Portuguese. Touch indicators show real gestures; footage is not accelerated." />
<Clip name="scroll-header-lifecycle-ios" caption="iOS 26.2 simulator, English: taller cover, native list unload/reload, portrait/landscape rotation, leaving during a fling and reopening the page. Actual OS input at original speed; no physical-device performance claim." />
<Clip name="scroll-header-lifecycle-android" caption="Android 16 emulator, English: anchored cover resize, native unload/reload, rotation, fling followed by navigation and a fresh scroll after reentry. Actual ADB input at original speed; emulator correctness only." />

## Build the supported layout

Use a single flat **Core ListView**, with a non-accessible spacer as row zero and fixed-height data rows after it. The list fills a bounded GridLayout. Draw the retained hero, section and toolbar above it as siblings, in that order. The artwork and expanded title belong to the hero; the compact title belongs to the toolbar. Do not wrap this list in a vertical ScrollView.

```ts
import { scrollHeader } from '@rafaelaugusto/jolt'

const page = scrollHeader(list, {
  header,
  artwork,
  title,
  toolbar,
  toolbarTitle,
  section,
  rowHeight: 76, // DIPs; every data row has this height
  setSpacerHeight(height) {
    spacerHeight = height
    list.refresh()
  },
  keys: () => tracks.map((track) => track.id), // excludes the spacer
  parallax: 48,
  titleFade: [0, 0.7], // fractions of the measured collapse range
  toolbarFade: [0.55, 0.95],
  stretch: true, // iOS; Android has a no-stretch fallback
  onState(state) {
    // Phase/layout boundaries, never an animation-frame driver.
    console.log(state.phase)
  },
})

await page.remeasure()
await page.preserveAnchor(() => {
  tracks.unshift(newTrack)
  list.refresh()
})
page.scrollToItem(35, true) // data index, excluding the spacer
page.scrollToTop(true)
// When the screen is no longer owned:
page.dispose()
```

The row template must actually enforce its size. Core 9.1.3 Android resets a root cell's `height` when the list has automatic row sizing: set the root's **minHeight and maxHeight** to the fixed row height, and the spacer's min/max to `spacerHeight`. Keep the ListView's own `rowHeight` automatic so row zero can have a different height. Do not add vertical row margins. The adapter includes Android divider pixels and physical-pixel rounding in its offset math.

See the complete [Vue screen](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/components/ScrollHeaderLab.vue) and [recycled cell templates](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/showcase/scroll-header-cells.ts). The composition supplies motion and scroll geometry; the app owns data, templates, imagery and routing. Overlay backgrounds should pass touches through except their controls; the reference uses `isPassThroughParentEnabled` and non-interactive decorative labels.

## Offset, geometry and anchors

The hero height is measured after layout; the toolbar supplies its minimum height. Explicit `expandedHeight` and `minimumHeight` override these measurements. The collapse range is `expanded − minimum`, and row zero occupies `expanded + section`. The section moves from the hero's bottom to the toolbar's bottom. Once pinned, scrolling continues through the virtualized list without a second scroll owner.

The canonical offset is in DIPs. iOS uses `contentOffset.y + adjustedContentInset.top`, including negative bounce. Android derives it from the first visible row's index and top, padding, spacer height and row/divider stride. Keep the sibling overlays in the same safe-area-adjusted parent as the list. This first adapter expects no additional app-owned top content inset/padding inside that viewport; it does not take ownership of system bars or change the list's insets.

When a collapsed header resizes, the offset follows the change in collapse range (`expanded − minimum`), keeping the same row at the same distance below the pinned toolbar/section. A growing compact title therefore does not cover that row. While partially expanded, the spacer-height difference preserves the rows’ screen position. At the absolute top, the offset stays zero. `preserveAnchor()` additionally follows the stable key of the first row under the pinned section. If that key disappears, it uses the nearest surviving data index. Offsets clamp to the actual content bounds; short/empty content can therefore return toward the top. Changes are serialized; wait for one update before starting another. For reactive data, await the framework update inside the callback. A top-of-page insertion intentionally shows the new first item.

`remeasure()` also runs on relevant layout events, including wrapping and rotation. `pause()` disconnects the scroll source; `play()` samples its current position. List unload releases native listeners and the graph, and reload attaches a fresh owner. `dispose()` restores owned transforms, clipping, accessibility and delegate ownership, plus `originalSpacerHeight` (zero by default). Do not animate these same overlay properties from another controller while the composition owns them.

The `remeasure()` promise includes layout changes requested while a measurement is pending. If unloading cancels it, the promise rejects; a subsequent load still reconnects automatically. `ready` becomes true only after native anchor restoration has completed. On iOS, the adapter also disables automatic section header/footer estimates for this flat list and restores the previous values on disposal, unless the app has changed them.

## Large system text and long titles

The reference opts into iOS Dynamic Type with `iosAccessibilityAdjustsFontSize`. On Android, its Activity handles `fontScale` configuration changes; the screen reapplies each retained Label’s SP size after the Activity updates its resources, and does the same when recycling cells. This uses Android’s own nonlinear font scaling. The listener and pending update are removed on unmount. These are application setup choices, not global changes made by `scrollHeader()`.

The hero measures its full content even when taller than the viewport. Its existing bounded parent clips the native content; the ListView spacer provides the scroll extent. Hero descendants ignore additional iOS safe-area expansion because that parent already owns the safe area. Compact titles wrap, control rows size to content, and row-number/duration columns grow with their text. Data rows remain fixed at 76 DIPs: long track names use one-line ellipsis, with the full name in the accessibility label. Variable-height data rows remain unsupported.

Release checks change the actual system font from normal to an enlarged setting and back while track 36 stays immediately below the pinned section. They also change the cover/title, return to the top, drag, jump, tap the recycled row and leave the screen with zero native sources/nodes. iOS uses `large` → `accessibility-medium`; Android uses `font_scale` 1 → 2. These two settings do not establish coverage of every text size or VoiceOver/TalkBack traversal.

<Clip name="scroll-header-large-text-ios" caption="iOS 26.2, iPhone 17 simulator, English: actual system text enlargement, long-title wrapping, the same anchored track, drag, native jump/tap and restoration. Original speed; simulator validation only." />
<Clip name="scroll-header-large-text-android" caption="Android 16 / API 36 emulator, English: actual font_scale 1 → 2 → 1, wrapped compact title, anchored recycled row, drag and exact native jump. Real ADB input at original speed; no physical-device performance claim." />

## Native inputs and limits

On iOS, KVO observes scroll geometry. A per-list delegate proxy supplies exact spacer/data heights and forwards Core's other delegate methods, preventing estimated-height corrections from moving an anchor during refresh. Disposal restores the previous delegate if the proxy still owns it. Android observes native scroll/layout changes without replacing Core's adapter, scroll listener or item callbacks. Neither platform adds a JS scroll handler. Both update the existing native live-value graph; JS is used for setup, layout/data changes, lifecycle and coarse state callbacks. Cell realization/binding remains normal Core ListView work and may enter JS.

`state` is an on-demand snapshot with `offset`, `phase`, native `updates`, semantic `callbacks` and visible/total row counts. An optional `diagnostic` Label shows those native counts without JS frame updates. This is diagnostic instrumentation, not a performance guarantee. In particular, Android's JS and view work share the UI thread: this API cannot make scrolling immune to UI-thread blocking.

Reduce Motion keeps pinning and scrolling, disables decorative parallax/stretch, uses an immediate title handoff and disables animated programmatic scroll. Only one title participates in accessibility at a time. Fixed-height data templates must be sized appropriately for the app's chosen large-text scale; this first adapter does not support variable-height data rows.

| Combination                                                                   | First adapter contract                                                                                         |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Core 9.1.3 flat ListView, one spacer and fixed data rows                      | Supported reference on both platforms                                                                          |
| Short/empty data                                                              | Real content extent; no forced phantom scroll space                                                            |
| iOS bounce                                                                    | Optional artwork stretch; native list owns the gesture                                                         |
| Android overscroll                                                            | Platform edge behavior, no decorative hero stretch                                                             |
| Pull-to-refresh                                                               | No recognizer is installed; refresh integrations have not been validated and are unsupported in this milestone |
| Core sectioned/sticky-header/search modes                                     | Rejected; this composition owns the pinned geometry                                                            |
| Other list plugins, variable data rows, nested vertical scrolling, paged tabs | Unsupported; no silent JS fallback                                                                             |

The [native validation and reproduction notes](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md) record the simulator/emulator checks accepted for this delivery. Physical-device performance measurements, VoiceOver/TalkBack traversal and refresh integration are outside this correctness update; broader adapter work is tracked in #116.
