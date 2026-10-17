# List rows

Play an entrance on each row of a `ListView` as it scrolls into view:

```ts
import { animateItems } from '@rafaelaugusto/jolt'

const unlink = animateItems(listView, 'fadeInUp')
```

Every row that the list hands out plays the animation, with the same keyframes, presets and transitions as [`animate()`](./animating). A row that is not on screen yet takes its first keyframe right away and plays once the list lays it out, so nothing flashes at full opacity first.

```ts
animateItems(listView, { opacity: [0, 1], x: [-16, 0] }, { duration: 250 })
animateItems(listView, 'popIn', 'bouncy')
```

Each row animates by itself when it appears, so `stagger` has nothing to space out and is rejected.

## Recycled rows

Lists reuse a handful of row views while you scroll. When a row is reused for another item, Jolt stops whatever it was still playing and starts the entrance again from the first keyframe. The rest of the row's animations, started by your own code, are left alone.

With `once`, each data item animates only the first time it shows up. A row reused for an item that was already shown settles at the end values instead:

```ts
animateItems(listView, 'fadeInUp', { once: true })
```

Items are tracked by identity: an object counts as the same item while you keep the same reference, and a primitive item is remembered by its index. Replacing the items with new objects animates them again.

## Which lists

The target is the core `ListView`, or anything that notifies `itemLoading` with the row's `index` and `view` and lists its realized rows through `eachChildView`, which is the contract of the community CollectionView as well. Sectioned lists report the section with the index. Wrapped targets such as a NativeScript-Vue template ref work the same way as with `animate()`.

## Cleanup

The return value is an idempotent cleanup function:

```ts
unlink() // stop listening and settle every row at its end values
```

Unloading the list removes the effect too, so a cached page needs a new call when it comes back. Rows are stopped at the values they are showing, then moved to the end values the animation would have reached, so no row stays half-faded. End values that depend on the view, such as `null` keyframes, relative animations and motion paths, are left where they stopped.
