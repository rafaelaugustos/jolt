<script setup lang="ts">
import {
  Application,
  ImageSource,
  isAndroid,
  knownFolders,
  type AndroidActivityBackPressedEventData,
  type Image,
  type Page,
  type View,
} from '@nativescript/core'
import { $navigateBack, onUnmounted, ref, shallowRef } from 'nativescript-vue'
import {
  animate,
  zoomable,
  type Animation,
  type PhotoDismissal,
  type Zoomable,
} from '@rafaelaugusto/jolt'

const page = ref(),
  photo = ref(),
  viewport = ref(),
  backdrop = ref()
const status = ref('Pinch a detail, pan, then pull down to close')
const pending = ref(false)
const source = shallowRef(
  ImageSource.fromFileSync(`${knownFolders.currentApp().path}/assets/image-target.png`),
)
let viewer: Zoomable | undefined,
  intent: PhotoDismissal | undefined,
  transition: Animation | undefined
let generation = 0
const nativePage = () => page.value?.nativeView as Page | undefined
const surface = () => viewport.value?.nativeView as View | undefined

function loaded() {
  viewer?.dispose()
  viewer = zoomable(photo.value.nativeView as Image, {
    viewport: viewport.value,
    backdrop: backdrop.value,
    dismiss: 'vertical',
    onSettled(state) {
      status.value = `Route zoom ${state.scale.toFixed(2)}`
    },
    onDismiss(value) {
      intent = value
      pending.value = true
      status.value = 'Close this route?'
    },
    onError(error) {
      status.value = error.message
    },
  })
}
function resetTransition() {
  generation++
  transition?.stop()
  transition = undefined
  const view = surface()
  if (view) view.opacity = 1
}
function cancel() {
  resetTransition()
  intent?.cancel()
  intent = undefined
  pending.value = false
}
async function accept() {
  const current = intent,
    view = surface(),
    route = nativePage()
  if (!current || !view || !route?.frame.canGoBack()) return
  const revision = ++generation
  transition?.stop()
  // The recipe holds the image pose. Navigation owns an ancestor, so its
  // transition does not reset or compete for the image's transform.
  transition = animate(view, { opacity: 0 }, { duration: 180 })
  const finished = await transition.finished
  if (!finished || revision !== generation || current !== intent) return
  const accepted = current.complete()
  intent = undefined
  pending.value = false
  if (!accepted) {
    resetTransition()
    return
  }
  await $navigateBack({ frame: route.frame })
}
function back(event: AndroidActivityBackPressedEventData) {
  const route = nativePage()
  if (route?.isLoaded && route.frame.currentPage === route) {
    event.cancel = true
    viewer?.requestDismiss()
  }
}
function suspend() {
  resetTransition()
  intent = undefined
  pending.value = false
}
function cleanup() {
  resetTransition()
  viewer?.dispose()
  viewer = undefined
  intent = undefined
}
if (isAndroid) Application.android.on('activityBackPressed', back)
Application.on(Application.suspendEvent, suspend)
onUnmounted(() => {
  cleanup()
  if (isAndroid) Application.android.off('activityBackPressed', back)
  Application.off(Application.suspendEvent, suspend)
})
</script>

<template>
  <Page
    ref="page"
    actionBarHidden="true"
    :enableSwipeBackNavigation="false"
    @unloaded="cleanup"
  >
    <GridLayout rows="auto,*,auto,auto" backgroundColor="#fafafa" padding="12">
      <Label text="Photo viewer route" fontSize="23" color="#18181b" />
      <GridLayout ref="viewport" row="1" marginTop="12" marginBottom="12">
        <GridLayout ref="backdrop" backgroundColor="#242438" />
        <Image
          ref="photo"
          :src="source"
          stretch="aspectFit"
          accessibilityLabel="Portrait artwork with a transparent corner"
          @loaded="loaded"
        />
      </GridLayout>
      <GridLayout row="2" rows="auto,auto" columns="*,*,*">
        <Button text="Route zoom in" @tap="viewer?.zoomTo(2.5)" />
        <Button col="1" text="Route reset" @tap="viewer?.reset()" />
        <Button col="2" text="Route close" @tap="viewer?.requestDismiss()" />
        <Button :isEnabled="pending" row="1" text="Keep viewing" @tap="cancel" />
        <Button
          :isEnabled="pending"
          row="1"
          col="1"
          colSpan="2"
          text="Leave viewer"
          @tap="accept"
        />
      </GridLayout>
      <Label
        row="3"
        :text="status"
        textWrap="true"
        color="#52525b"
        accessibilityLiveRegion="polite"
      />
    </GridLayout>
  </Page>
</template>
