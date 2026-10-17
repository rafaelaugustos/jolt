# Shimmer

Sweep a light band across a loading placeholder:

<Clip name="shimmer" caption="A shimmer over loading placeholders." />

```ts
import { shimmer } from '@rafaelaugusto/jolt'

const stopShimmer = shimmer(placeholder)
// Once the content is ready:
stopShimmer()
```

Pass a view or a ref holding one. Apply it to a container to sweep across all of its skeleton shapes together. The mask changes their opacity, so their colors and the background determine the contrast; light shapes on a dark background make a bright sweep.

## Timing

```ts
const stopShimmer = shimmer(placeholder, { duration: 2000 })
```

`duration` is milliseconds per sweep, including the band entering and leaving the view. The default is `1500`. It must be a positive finite number.

On iOS, a `CAGradientLayer` mask animates its `locations` in Core Animation. Playback repeats natively, with no JavaScript callback per frame. Layout changes resize the mask without restarting the sweep.

## Cleanup

The returned function removes the shimmer and its listeners. Calling it again is harmless. Starting another shimmer on the same view replaces the previous one; its old cleanup function cannot stop the new effect.

Calls made before loading wait for the view and a nonzero layout. Unloading the view removes the native mask and accessibility observer; loading it again starts a new sweep. This also handles backgrounding and returning to the app. Call the returned function to end shimmer permanently, including while the view is unloaded.

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { shimmer } from '@rafaelaugusto/jolt'

const placeholder = ref()
let stop: (() => void) | undefined

onMounted(() => {
  stop = shimmer(placeholder.value)
})
onUnmounted(() => stop?.())
</script>

<template>
  <StackLayout ref="placeholder" />
</template>
```

Existing masks, including NativeScript clip paths, stay in place. Cleanup removes only Jolt's gradient. Shimmer does not change the view's opacity, transform, interaction or accessibility properties. Use `stopShimmer()` to stop it; `stop(view)` controls `animate()` tracks.

## Compatibility

This first implementation is **iOS only**. On Android the placeholder stays unchanged and the cleanup function does nothing.

With Reduce Motion enabled, the placeholder stays static at its normal opacity. Changing that preference while shimmer is active removes or resumes the sweep automatically.
