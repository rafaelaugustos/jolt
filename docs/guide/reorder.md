# Reorder a list

Hold a row handle, move it through a list, and let go. Neighbours make room while the list scrolls near its edges. The lifted row stays in a native snapshot even after its original cell leaves the recycled viewport.

Available since **0.1.0-beta.17**, in the core package. Install `@rafaelaugusto/jolt@0.1.0-rc.2` and rebuild the native app to include the input and rendering classes. No optional native-property plugin is needed.

<Clip name="reorder-ios" caption="iOS simulator, real XCTest input: drag between unequal-height rows, move with buttons, and hold at the bottom edge to continue through recycled cells. Original timing; no physical-device claim." />

<Clip name="reorder-android" caption="Android emulator, real OS touch input: reorder a 200-item Core ListView and keep the lifted row under the finger while edge scrolling recycles its source cell. Original timing." />

## One committed move

Import from `@rafaelaugusto/jolt/reorder`. The first adapter supports a **flat vertical NativeScript Core ListView with variable row heights**. Put the list as the only direct child of a `ReorderSurface`; on Android this retains the pointer stream above the recycled cells without replacing Core's touch listener. On iOS the surface is an ordinary GridLayout.

Register `ReorderSurface` and `ReorderHandle` once at Vue app startup:

```ts
import { registerElement } from 'nativescript-vue'
import { ReorderSurface, ReorderHandle } from '@rafaelaugusto/jolt/reorder'

registerElement('ReorderSurface', () => ReorderSurface)
registerElement('ReorderHandle', () => ReorderHandle)
```

In the component, keep the array in application state:

```ts
import { ref, onUnmounted } from 'nativescript-vue'
import type { EventData, ListView } from '@nativescript/core'
import { reorder, type Reorder } from '@rafaelaugusto/jolt/reorder'

type Track = { id: string; title: string }
const tracks = ref<Track[]>(/* your tracks */ [])
let sorting: Reorder<string> | undefined

function loaded(event: EventData) {
  sorting?.dispose()
  sorting = reorder<Track, string>(event.object as ListView, {
    key: (track) => track.id,
    handle: 'dragHandle',
    onCommit({ key, beforeKey }) {
      const moved = tracks.value.find((track) => track.id === key)!
      const next = tracks.value.filter((track) => track.id !== key)
      const index =
        beforeKey === null
          ? next.length
          : next.findIndex((track) => track.id === beforeKey)
      next.splice(index, 0, moved)
      tracks.value = next
    },
  })
}
onUnmounted(() => sorting?.dispose())
```

```vue
<ReorderSurface>
  <ListView :items="tracks" @loaded="loaded">
    <template #default="{ item }">
      <GridLayout columns="*,44" padding="12">
        <Label :text="item.title" textWrap="true" />
        <ReorderHandle
          id="dragHandle"
          col="1"
          text="☷"
          :accessibilityLabel="`Reorder ${item.title}`"
        />
      </GridLayout>
    </template>
  </ListView>
</ReorderSurface>
```

For an explicit height per item, size an inner container as the demo does; Core owns the row root and resets its height on Android when `rowHeight` is automatic. Natural text-driven heights also work.

Keys must be unique strings or finite numbers. They identify data, not recycled view instances or current array positions. `onCommit` runs once for a changed drop and supplies `{ key, beforeKey, fromIndex, toIndex }`. `beforeKey: null` means append; indices describe the original position and the final position after removal. Jolt never rearranges the application array during pointer movement. Apply the move synchronously for an immediate result, or keep the existing order to reject it.

After a committed move, the Core adapter resolves the stable key again, reveals it with native scrolling if needed (centred on iOS when clipped at an edge), and returns focus to its handle. This happens once after the app rebinds, including when estimated iOS row heights change.

## Cancellation and changes

Replacing `list.items`, or an observable source emitting `change`, cancels a pending drag before a stale index can commit. Removing the lifted identity reports `removed`; filtering, replacement, insertion or content changes report `data-changed`. For **in-place changes to a plain array**, update/refresh the list and call `sorting.refresh()`. Also call it when changing row geometry without changing the items. The identities are checked again at commit.

```ts
sorting.cancel() // keep the application order
sorting.pause() // cancel and disable input
sorting.play() // enable input again
sorting.dispose() // restore cells and remove native input/actions
```

An unchanged drop emits no commit. `onStart(key)` and `onCancel({ key, reason })` are optional lifecycle callbacks. Cancellation reasons also include `cancelled`, `unchanged`, `unloaded`, `disposed`, `disabled` and `geometry-changed`. Leaving the page, backgrounding the app, changing the viewport size, or disposing releases the overlay and native frame work. A controller survives an unload/reload by attaching to the newly loaded native list; `dispose()` is final.

## Keyboard and accessibility

Handles receive native **Move up** and **Move down** accessibility actions. Supply translated labels through `accessibility: { moveUp, moveDown }`. A focused `ReorderHandle` supports **Option/Alt + ↑/↓**. The controller also exposes `moveUp(key)`, `moveDown(key)` and `move(key, beforeKey)`, so an app can offer ordinary keyboard-focusable buttons without requiring drag input. These follow the same commit contract and return `false` for an unchanged or missing item.

Neighbour springs and the drop transition respect Jolt's Reduced Motion setting. Direct finger tracking and edge scrolling remain available. Configure the activation and edge behaviour with `longPress` (150–2000 ms, default 350) and `edge: { size, speed }` (defaults 72 DIPs and 640 DIPs/second).

## Native boundary and supported content

Gesture tracking, snapshots, spring displacement and edge scrolling run in compiled UIKit/Android code. Lifecycle decisions, data changes, accessibility/keyboard moves and normal Core cell creation/binding use JavaScript. There is no Jolt pointer/frame subscription to JavaScript; this does **not** make the UI immune to JavaScript blocking its main thread.

The initial path supports static text, images and ordinary row containers. A snapshot is a still image: do not use live camera/video/Metal surfaces as drag previews. Jolt owns the realized row container's translation and opacity during the operation; put unrelated animations on an inner view. Built-in sections, sticky headers and search are rejected. Grids, horizontal lists, cross-list dragging and third-party CollectionView plugins are outside this adapter's support.

`ReorderAdapter<T>` is the extension contract for another list implementation: provide `view`, `items()`, `subscribe(changed)` and `attach(config)`. Its driver owns native input, measured geometry, snapshot lifetime, recycled-cell restoration and scrolling, and emits only start/commit/cancel lifecycle events. Publishing an adapter requires validating that list's recycling and accessibility behaviour; accepting an arbitrary view is not equivalent to supporting it.
