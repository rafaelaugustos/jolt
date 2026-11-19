# Collections and scroll continuity

**Source candidate; not included in 0.1.0-rc.15.** Covers [#495](https://github.com/rafaelaugustos/jolt/issues/495), [#496](https://github.com/rafaelaugustos/jolt/issues/496) and [#510](https://github.com/rafaelaugustos/jolt/issues/510), [#511](https://github.com/rafaelaugustos/jolt/issues/511), [#512](https://github.com/rafaelaugustos/jolt/issues/512), [#513](https://github.com/rafaelaugustos/jolt/issues/513). Rebuild the native app with the containing version. SwiftUI remains Beta on iOS 17+ and macOS 14+.

## CollectionView adapters {#collections}

`collectionViewListAdapter` and `collectionViewReorderAdapter` support the optional `@nativescript-community/ui-collectionview` plugin (tested with 6.1.3), with one vertical span, stable keys and no reverse layout or plugin `reorderEnabled`. They use actual realized native geometry and do not import the plugin into Jolt. Grids, sections and cross-list transfers are outside this adapter contract.

`listChanges` captures the visible rows, applies an immutable update, preserves the first visible key and intra-row offset, then animates the new native layout. Send every structural change through `update`; do not animate the same rows with another layout owner. Recycled views restore their previous state before receiving another identity. Exit copies and interrupted transitions use the existing bounded lifetime. See [values, scroll and lists](./values-scroll-lists).

The reorder adapter uses native pickup, previews, edge scrolling and recycled-cell restoration. Commits contain the stable key and insertion key; the application updates its data once. On Android, make the collection the only child of a `ReorderSurface`. For a parent panel, put that surface inside `GestureSurface`. Declare the panel's `waitFor` relation after mounting both controllers: movement before long-press recognition scrolls normally; recognized reorder owns the drag. Relations must be recreated after remount.

```ts
import { collectionViewListAdapter, listChanges } from '@rafaelaugusto/jolt'
import { collectionViewReorderAdapter, reorder } from '@rafaelaugusto/jolt/reorder'
import { gestures, scrollHandoff, gestureRelations } from '@rafaelaugusto/jolt/gestures'

const changes = listChanges(collection, {
  key: (item: Item) => item.id,
  adapter: collectionViewListAdapter<Item>(collection),
})
changes.update(nextItems)
// Dispose changes before switching ownership to interactive reorder.
changes.dispose()
const sorting = reorder(collectionViewReorderAdapter<Item>(collection), {
  key: (item) => item.id,
  onCommit: (move) => commitByKey(move.key, move.beforeKey),
})
const panel = gestures(surface, {
  pan: { axis: 'y', bounds: { top: 0, bottom: 180 } },
  scrollView: scrollHandoff(collection),
})
const links = gestureRelations([{ gesture: panel, other: sorting, relation: 'waitFor' }])
// Teardown: links.dispose(); panel.dispose(); sorting.dispose().
```

## Continuous handoff {#handoff}

`scrollHandoff(view, { axis })` extends the existing `gestures(..., { scrollView })` and `bottomSheet` input contract to Core ListView, linear CollectionView and horizontal Core ScrollView. The panel and scroller must share an axis, and the scroller must descend from the surface. Supply explicit panel bounds in DIPs. Core ListView and bottom sheets remain vertical; CollectionView requires a matching linear axis and one span. Expand the panel before consuming content; reverse by draining content before collapsing. Only the final owner receives release velocity, in DIPs/second.

Replacing items cancels the current contact. Layout-contract changes dispose the gesture controller; recreate it after changing orientation, spans, row/column sizing or layout style. Cancellation, unload, suspension and disposal release native input/delegate leases; preserve the application's existing listeners. No per-frame application JavaScript is required for native handoff or reorder. Custom scroll widgets still need a supported native backend; an arbitrary view is not a portable adapter.

`JoltBottomSheet` now transfers the same SwiftUI contact between panel and content on iOS and macOS. The existing model owns snap points and the finite release clock. UIKit pan input and AppKit mouse/wheel input feed that model; wheel momentum is not applied twice. Content taps, text entry, keyboard controls and Reduced Motion remain supported. Nested UIKit scroll views keep their own input. Scene inactivity, remount and disposal cancel the borrowed scroll connection. These are in-app sheets, not system presentations; physical trackpad feel is not established by XCTest wheel events.

## Horizontal order and scroll values {#horizontal}

Native realized rows accept `axis: 'x'` and `direction: 'ltr' | 'rtl'`; item arrays stay in logical order, and measured targets must follow that direction without overlap. Widths may differ. RTL affects horizontal order, not the meaning of vertical indices. Use the existing Web `reorder` with `axis: 'x'` and the container's CSS `direction`; RTL previews now follow logical order. Edge scrolling, cancellation and lifecycle retain their existing contracts.

Native `scrollValue` supports Core horizontal/vertical scroll and linear CollectionView. For Android recycled lists, `rowHeight` means the **actual fixed item stride in DIPs** (width for x), including spacing; it is not necessarily the plugin's requested size. This run measured 49.524 DIP rows despite a requested 64 DIP on Android. iOS reads content offset plus adjusted inset directly. Horizontal native offsets have physical-left zero even in RTL; iOS bounce may be negative, while Android's accepted scroll range clamps. These are scroll units, not item indices.

The internal benchmark compares the producer cost of native and JavaScript sources with the same five bound properties. It excludes later graph evaluation, rendering and whole-app CPU/PSS. Simulator/emulator timings do not establish physical-device performance. See the [acceptance report](https://github.com/rafaelaugustos/jolt/blob/feat/rc16-collections-scroll/benchmarks/collections-scroll/README.md).

## Web and lifecycle limits {#web}

Reuse Web `listChanges`, its explicit virtualizer adapter, `scrollValue` and nested-scroll gestures. Browser execution stays on browser scheduling; no native-thread or identical-pixel promise is made. Reorder operates on the supplied realized window: replacing a key or DOM target during contact cancels before a stale commit. Pin that window if continuous dragging must survive virtualization; Jolt does not provide a browser virtualizer. Existing button/keyboard alternatives and Reduced Motion remain available; this batch adds no accessibility workstream.

## Real recordings {#evidence}

<Clip name="collection-motion-ios" caption="iPhone 17 Pro · iOS 27 simulator; real XCTest input. Collection updates, recycled reorder, edge reversal and cancellation." />

<Clip name="collection-motion-android" caption="Pixel 7 · Android API 36 emulator; real OS touches. Collection updates, recycled reorder, edge reversal and cancellation." />

<Clip name="scroll-handoff-ios" caption="iPhone 17 Pro · iOS 27 simulator; real XCTest input. One contact expands, scrolls and reverses with ListView, CollectionView and horizontal ScrollView." />

<Clip name="scroll-handoff-android" caption="Pixel 7 · Android API 36 emulator; real OS touches. One contact expands, scrolls and reverses with ListView, CollectionView and horizontal ScrollView." />

<Clip name="horizontal-reorder-edges-ios" caption="iPhone 17 Pro · iOS 27 simulator; real XCTest input. Variable-width LTR/RTL order, both edges, reversal, cancellation and Reduced Motion." />

<Clip name="horizontal-reorder-edges-android" caption="Pixel 7 · Android API 36 emulator; real OS touches. Variable-width LTR/RTL order, both edges, reversal, cancellation and Reduced Motion." />

<Clip name="scroll-source-ios" caption="iPhone 17 Pro · iOS 27 simulator; real XCTest input. Five bound properties, native/JS offset comparison, horizontal RTL and CollectionView." />

<Clip name="scroll-source-android" caption="Pixel 7 · Android API 36 emulator; real OS touches. Five bound properties, native/JS offset comparison, horizontal RTL and CollectionView." />

<Clip name="swiftui-sheet-continuity-ios" caption="iOS 27 simulator: Actual input: continuous sheet/content handoff, action buttons and remount. English UI; original speed." />

<Clip name="swiftui-sheet-continuity-macos" caption="Native macOS app: Actual input: continuous sheet/content handoff, action buttons and remount. English UI; original speed." />

<Clip name="horizontal-reorder-web" caption="Chromium on macOS: real mouse input shows LTR/RTL commit, edge reversal and Escape cancellation. English UI." />
