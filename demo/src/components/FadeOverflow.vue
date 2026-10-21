<script lang="ts" setup>
import { isAndroid, type EventData, type View } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import { animate } from '@rafaelaugusto/jolt'

const glow = ref()
const faded = ref(false)

// Let the halo draw past its container, as an app does for glows and shadows.
function unclip(event: EventData) {
  if (!isAndroid) return
  let view: View | undefined = event.object as View
  for (
    let depth = 0;
    view && depth < 3;
    depth++, view = view.parent as View | undefined
  ) {
    const native = view.nativeViewProtected as android.view.ViewGroup | undefined
    native?.setClipChildren?.(false)
  }
}

function toggle() {
  faded.value = !faded.value
  animate(glow.value, { opacity: faded.value ? 0.15 : 1 }, { duration: 900 })
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Fade overflow" />
    <Label class="muted" textWrap="true" text="animate(glow, { opacity: 0.15 })" />

    <GridLayout class="stage" height="200">
      <AbsoluteLayout
        ref="glow"
        width="64"
        height="64"
        clipToBounds="false"
        @loaded="unclip"
      >
        <Label class="glow-halo" left="-52" top="-52" width="168" height="168" />
        <Label class="glow-dot" width="64" height="64" />
      </AbsoluteLayout>
    </GridLayout>

    <Label
      class="note"
      textWrap="true"
      text="The halo is larger than the container that fades. It stays round for the whole fade."
    />
    <Button class="button" :text="faded ? 'Fade in' : 'Fade out'" @tap="toggle" />
  </StackLayout>
</template>
