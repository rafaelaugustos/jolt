<script setup lang="ts">
import {
  Application,
  File,
  isAndroid,
  isIOS,
  knownFolders,
  Utils,
  type Image,
  type Page,
  type View,
} from '@nativescript/core'
import { nextTick, onUnmounted, ref, watch } from 'nativescript-vue'
import { useRoute, useRouter } from 'vue-router-ns'
import { zoomable, type PhotoDismissal, type Zoomable } from '@rafaelaugusto/jolt'
import { usePreviewI18n } from './i18n'
import { launchArgument } from '../launch'
import {
  collectionPhotos,
  selectedPhoto,
  collectionEntry,
  collectionReady,
  collectionStatus,
  collectionList,
  photoTag,
  moveSelected,
  removeSelected,
  setCollectionGate,
  auditCollection,
  galleryEvents as events,
} from './photo-collection'
const { t } = usePreviewI18n(),
  router = useRouter(),
  route = useRoute()
const photo =
  selectedPhoto.value?.key === route.params.key
    ? selectedPhoto.value
    : collectionPhotos.value.find((p) => p.key === route.params.key)
const page = ref(),
  image = ref(),
  viewport = ref(),
  backdrop = ref(),
  chrome = ref()
const status = ref('Pinch to explore. Pull down to return.')
let viewer: Zoomable | undefined,
  closing = false
function audit(event: string, extra?: unknown) {
  if (launchArgument('gallery-audit') === undefined) return
  const current = image.value?.nativeView as Image | undefined
  const frame = (page.value?.nativeView as Page)?.frame ?? collectionList?.page?.frame
  const native = isAndroid ? current?.android : undefined
  events.push({
    event,
    time: Date.now(),
    state: viewer?.state,
    ready: viewer?.ready ?? false,
    route: frame?.currentPage.id,
    depth: frame?.backStack.length,
    viewport: (viewport.value?.nativeView as View)?.getActualSize(),
    native: native
      ? {
          scale: native.getScaleX(),
          x: Utils.layout.toDeviceIndependentPixels(native.getTranslationX()),
          y: Utils.layout.toDeviceIndependentPixels(native.getTranslationY()),
          visible: native.getVisibility() === 0,
          alpha: native.getAlpha(),
        }
      : undefined,
    extra,
  })
  const directory = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
  File.fromPath(directory + '/jolt-gallery.json').writeTextSync(
    JSON.stringify({
      events,
      image: current
        ? { loaded: current.isLoaded, size: current.getActualSize() }
        : undefined,
    }),
  )
  if (frame) auditCollection(frame)
}
let layoutAuditQueued = false
function auditLayout() {
  if (launchArgument('gallery-audit') === undefined || layoutAuditQueued) return
  layoutAuditQueued = true
  void nextTick(() => {
    layoutAuditQueued = false
    audit('layout')
  })
}
function bind() {
  const target = image.value?.nativeView as Image | undefined
  if (
    !target?.isLoaded ||
    closing ||
    (collectionEntry &&
      collectionEntry.state !== 'idle' &&
      collectionEntry.state !== 'disposed')
  )
    return
  if (viewer?.ready) return
  viewer?.dispose()
  viewer = zoomable(target, {
    viewport: viewport.value,
    backdrop: backdrop.value,
    chrome: chrome.value,
    dismiss: 'vertical',
    onDismiss: (value) => {
      void dismiss(value)
    },
    onSettled(state) {
      status.value =
        state.scale > 1.01
          ? 'Explore every detail.'
          : 'Pinch to explore. Pull down to return.'
      audit('settled')
    },
    onError(error) {
      status.value = 'Photo unavailable'
      audit('error', error.message)
    },
  })
  setCollectionGate(() => {
    const state = viewer?.state
    if (closing || state?.pending) return false
    if (state && state.scale > 1.01) {
      // Android's committed Back first resets zoom; another Back can leave.
      if (isAndroid) viewer?.reset()
      return false
    }
    return !state || (Math.abs(state.x) < 1 && Math.abs(state.y) < 1)
  })
  void nextTick(() => audit('bound'))
}
async function ordinaryBack() {
  if ((page.value.nativeView as Page).frame.canGoBack())
    await router.back({ animated: false })
  else await router.replace('/example/gallery', { animated: false })
}
async function dismiss(intent: PhotoDismissal) {
  if (closing) {
    intent.cancel()
    return
  }
  closing = true
  audit('released', { pose: intent.state, velocity: intent.velocity })
  const owner = collectionEntry
  try {
    if (owner && owner.state !== 'disposed') {
      // The native flight captures the held pose before the router unloads it.
      // Unload releases zoom ownership; rejected navigation leaves it available to cancel.
      const result = await owner.returnToSource({
        velocity: { x: 0, y: intent.velocity },
      })
      audit('returned', result)
      if (!result.navigated) {
        closing = false
        intent.cancel()
      }
    } else {
      await ordinaryBack()
      audit('ordinary-return')
    }
  } catch (error) {
    closing = false
    intent.cancel()
    audit('route-rejected', String(error))
  }
}
function close() {
  if (closing) return
  if (viewer?.ready) viewer.requestDismiss()
  else if (collectionEntry && collectionEntry.state !== 'disposed') collectionEntry.back()
  else void ordinaryBack()
}
function unload() {
  viewer?.dispose()
  audit('unloaded')
  viewer = undefined
}
function suspend() {
  closing = false
  audit('suspended')
}
function resume() {
  void nextTick(() => audit('resumed'))
}
watch(collectionReady, () => {
  void nextTick(bind)
})
Application.on(Application.suspendEvent, suspend)
Application.on(Application.resumeEvent, resume)
onUnmounted(() => {
  unload()
  setCollectionGate(() => true)
  Application.off(Application.suspendEvent, suspend)
  Application.off(Application.resumeEvent, resume)
})
</script>
<template>
  <Page
    ref="page"
    id="gallery-photo-detail"
    actionBarHidden="true"
    backgroundColor="#F0EEE6"
    androidStatusBarBackground="#102B25"
    statusBarStyle="light"
    @unloaded="unload"
  >
    <GridLayout rows="72,*,204" backgroundColor="#F0EEE6">
      <GridLayout
        ref="backdrop"
        rowSpan="3"
        backgroundColor="#102B25"
        isUserInteractionEnabled="false"
      />
      <GridLayout
        ref="chrome"
        rows="72,*,204"
        rowSpan="3"
        isPassThroughParentEnabled="true"
      >
        <GridLayout
          columns="auto,*,auto"
          padding="12 24"
          isPassThroughParentEnabled="true"
        >
          <Label
            text="×"
            width="44"
            height="44"
            borderRadius="22"
            backgroundColor="#2C463C"
            color="#F3F1E4"
            fontSize="30"
            textAlignment="center"
            accessibilityRole="button"
            :accessibilityLabel="t('Back to the collection')"
            automationText="gallery-close"
            @tap="close"
          />
          <Label
            col="1"
            :text="t('STAY A LITTLE LONGER')"
            fontSize="9"
            letterSpacing="0.12"
            color="#B3C2AA"
            textAlignment="center"
            verticalAlignment="middle"
          />
          <Label
            col="2"
            text="↗"
            fontSize="28"
            color="#D7EDA8"
            verticalAlignment="middle"
          />
        </GridLayout>
        <StackLayout row="2" padding="18 24 20">
          <GridLayout columns="*,auto" height="52">
            <StackLayout
              ><Label
                :text="t(photo?.title ?? 'Your place')"
                color="#F3F1E4"
                fontSize="28"
                fontWeight="700" /><Label
                :text="t(photo?.note ?? '')"
                color="#B3C2AA"
                fontSize="11"
                marginTop="4"
            /></StackLayout>
            <Label col="1" text="✦" color="#D7EDA8" fontSize="32" />
          </GridLayout>
          <GridLayout columns="*,*,*,*" height="40" marginTop="18">
            <Label
              :text="t('Zoom in')"
              automationText="gallery-zoom"
              accessibilityRole="button"
              color="#183D32"
              backgroundColor="#D7EDA8"
              borderRadius="14"
              padding="12 2"
              marginRight="4"
              fontSize="11"
              textAlignment="center"
              @tap="viewer?.zoomTo(2.5)"
            />
            <Label
              col="1"
              :text="t('Reset view')"
              automationText="gallery-reset"
              accessibilityRole="button"
              color="#E8EDDD"
              backgroundColor="#2C463C"
              borderRadius="14"
              padding="12 2"
              marginRight="4"
              fontSize="11"
              textAlignment="center"
              @tap="viewer?.reset()"
            />
            <Label
              col="2"
              :text="t('Move to end')"
              automationText="gallery-move"
              accessibilityRole="button"
              color="#E8EDDD"
              backgroundColor="#2C463C"
              borderRadius="14"
              padding="12 2"
              marginRight="4"
              fontSize="11"
              textAlignment="center"
              @tap="moveSelected"
            />
            <Label
              col="3"
              :text="t('Remove')"
              automationText="gallery-remove"
              accessibilityRole="button"
              color="#EAC7AC"
              backgroundColor="#2C463C"
              borderRadius="14"
              padding="12 2"
              fontSize="11"
              textAlignment="center"
              @tap="removeSelected"
            />
          </GridLayout>
          <Label
            :text="t(status)"
            automationText="gallery-status"
            color="#B3C2AA"
            fontSize="10"
            textAlignment="center"
            marginTop="13"
          />
          <Label
            :text="t(collectionStatus)"
            color="#8FA18C"
            fontSize="9"
            textAlignment="center"
            marginTop="4"
          />
        </StackLayout>
      </GridLayout>
      <GridLayout
        ref="viewport"
        row="1"
        clipToBounds="true"
        margin="0 18"
        @layoutChanged="auditLayout"
      >
        <Image
          ref="image"
          :src="photo?.src"
          stretch="aspectFit"
          borderRadius="18"
          :sharedTransitionTag="photo ? photoTag(photo.key) : undefined"
          automationText="gallery-image"
          :accessibilityLabel="t(photo?.title ?? 'Your place')"
          @loaded="bind"
        />
      </GridLayout>
    </GridLayout>
  </Page>
</template>
