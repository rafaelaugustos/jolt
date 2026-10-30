<script setup lang="ts">
import {
  Application,
  File,
  getCurrentFontScale,
  isAndroid,
  isIOS,
  knownFolders,
  Utils,
  type Image,
  type Label,
  type Page,
  type View,
} from '@nativescript/core'
import { nextTick, onUnmounted, ref, watch } from 'nativescript-vue'
import { useRoute, useRouter } from 'vue-router-ns'
import { zoomable, type PhotoDismissal, type Zoomable } from '@rafaelaugusto/jolt'
import { usePreviewI18n } from './i18n'
import { refreshAndroidText } from './text-scale'
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
  chrome = ref(),
  root = ref(),
  header = ref(),
  footer = ref(),
  title = ref(),
  note = ref(),
  closeButton = ref(),
  zoomButton = ref(),
  resetButton = ref(),
  moveButton = ref(),
  removeButton = ref()
const auditEnabled = launchArgument('gallery-audit') !== undefined
const topInset = ref(72),
  bottomInset = ref(204),
  footerLimit = ref(204)
let fontRefresh: ReturnType<typeof setTimeout> | undefined
let disposed = false
function measureChrome() {
  const top = header.value?.nativeView?.getActualSize().height,
    bottom = footer.value?.nativeView?.getActualSize().height,
    height = chrome.value?.nativeView?.getActualSize().height
  // Keep an actual gesture viewport in short landscape windows; overflowing
  // controls remain reachable through their own bounded native ScrollView.
  if (height > 0 && top > 0) {
    const limit = Math.max(64, Math.min(height * 0.55, height - top - 120))
    if (Math.abs(limit - footerLimit.value) > 0.1) footerLimit.value = limit
  }
  if (top > 0 && Math.abs(top - topInset.value) > 0.1) topInset.value = top
  if (bottom > 0 && Math.abs(bottom - bottomInset.value) > 0.1) bottomInset.value = bottom
}
function refreshText() {
  clearTimeout(fontRefresh)
  fontRefresh = setTimeout(() => {
    fontRefresh = undefined
    if (!disposed && root.value?.nativeView) refreshAndroidText(root.value.nativeView)
  }, 0)
}
const status = ref('Pinch to explore. Pull down to return.')
let viewer: Zoomable | undefined,
  closing = false
function audit(event: string, extra?: unknown) {
  if (launchArgument('gallery-audit') === undefined) return
  const current = image.value?.nativeView as Image | undefined
  const frame = (page.value?.nativeView as Page)?.frame ?? collectionList?.page?.frame
  const native = isAndroid ? current?.android : undefined
  const rect = (ref: any) => {
    const view = ref.value?.nativeView as View | undefined,
      parent = root.value?.nativeView as View | undefined
    if (!view?.isLoaded || !parent?.isLoaded) return undefined
    return { ...view.getLocationRelativeTo(parent), ...view.getActualSize() }
  }
  const text = (ref: any) => {
    const view = ref.value?.nativeView as Label | undefined
    if (!view?.nativeViewProtected || !view.isLoaded) return undefined
    const size = view.getActualSize()
    if (isIOS)
      return {
        ...rect(ref),
        text: view.text,
        font: (view.ios as UILabel).font.pointSize,
        requiredHeight: (view.ios as UILabel).textRectForBoundsLimitedToNumberOfLines(
          CGRectMake(0, 0, size.width, 10000),
          0,
        ).size.height,
      }
    const label = view.android as android.widget.TextView,
      density = label.getResources().getDisplayMetrics().density,
      layout = label.getLayout()
    return {
      ...rect(ref),
      text: view.text,
      font: label.getTextSize() / density,
      requiredHeight: layout
        ? (layout.getHeight() +
            label.getCompoundPaddingTop() +
            label.getCompoundPaddingBottom()) /
          density
        : 0,
      ellipsized: layout
        ? Array.from({ length: layout.getLineCount() }, (_, i) =>
            layout.getEllipsisCount(i),
          ).some(Boolean)
        : false,
    }
  }
  events.push({
    event,
    time: Date.now(),
    state: viewer?.state,
    ready: viewer?.ready ?? false,
    route: frame?.currentPage.id,
    depth: frame?.backStack.length,
    viewport: (viewport.value?.nativeView as View)?.getActualSize(),
    typography: {
      systemScale: isIOS
        ? UIApplication.sharedApplication.preferredContentSizeCategory
        : Application.android.context.getResources().getConfiguration().fontScale,
      title: text(title),
      note: text(note),
      close: text(closeButton),
      zoom: text(zoomButton),
      reset: text(resetButton),
      move: text(moveButton),
      remove: text(removeButton),
    },
    layout: {
      root: rect(root),
      header: rect(header),
      footer: rect(footer),
      viewport: rect(viewport),
    },
    native: native
      ? {
          scale: native.getScaleX(),
          x: Utils.layout.toDeviceIndependentPixels(native.getTranslationX()),
          y: Utils.layout.toDeviceIndependentPixels(native.getTranslationY()),
          visible: native.getVisibility() === 0,
          alpha: native.getAlpha(),
        }
      : current?.ios
        ? {
            scale: (current.ios as UIImageView).transform.a,
            x: (current.ios as UIImageView).transform.tx,
            y: (current.ios as UIImageView).transform.ty,
            visible: !(current.ios as UIImageView).hidden,
            alpha: (current.ios as UIImageView).alpha,
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
if (isAndroid) {
  getCurrentFontScale()
  Application.on(Application.fontScaleChangedEvent, refreshText)
}
onUnmounted(() => {
  disposed = true
  clearTimeout(fontRefresh)
  Application.off(Application.fontScaleChangedEvent, refreshText)
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
    <GridLayout
      ref="root"
      backgroundColor="#F0EEE6"
      iosAccessibilityAdjustsFontSize="true"
    >
      <GridLayout
        ref="backdrop"
        backgroundColor="#102B25"
        isUserInteractionEnabled="false"
      />
      <GridLayout
        ref="chrome"
        rows="auto,*,auto"
        isPassThroughParentEnabled="true"
        iosOverflowSafeAreaEnabled="false"
        @layoutChanged="measureChrome"
      >
        <GridLayout
          ref="header"
          minHeight="72"
          @layoutChanged="measureChrome"
          columns="auto,*,auto"
          padding="12 24"
          isPassThroughParentEnabled="true"
        >
          <Label
            ref="closeButton"
            text="×"
            minWidth="44"
            minHeight="44"
            padding="2 10"
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
            textWrap="true"
            margin="0 8"
            fontSize="9"
            letterSpacing="0.12"
            color="#B3C2AA"
            textAlignment="center"
            verticalAlignment="middle"
          />
          <Label
            v-if="auditEnabled"
            col="2"
            text="Snapshot"
            automationText="gallery-snapshot"
            fontSize="9"
            color="#D7EDA8"
            minHeight="44"
            verticalAlignment="middle"
            @tap="audit('text-snapshot')"
          />
          <Label
            v-else
            col="2"
            text="↗"
            fontSize="28"
            color="#D7EDA8"
            verticalAlignment="middle"
          />
        </GridLayout>
        <ScrollView
          ref="footer"
          row="2"
          :maxHeight="footerLimit"
          verticalAlignment="bottom"
          automationText="gallery-controls"
          @layoutChanged="measureChrome"
        >
          <StackLayout padding="18 24 20">
            <GridLayout columns="*,auto">
              <StackLayout
                ><Label
                  ref="title"
                  automationText="gallery-title"
                  textWrap="true"
                  :text="t(photo?.title ?? 'Your place')"
                  color="#F3F1E4"
                  fontSize="28"
                  fontWeight="700" /><Label
                  ref="note"
                  textWrap="true"
                  :text="t(photo?.note ?? '')"
                  color="#B3C2AA"
                  fontSize="11"
                  marginTop="4"
              /></StackLayout>
              <Label col="1" text="✦" color="#D7EDA8" fontSize="32" />
            </GridLayout>
            <GridLayout columns="*,*,*,*" marginTop="18">
              <Label
                :text="t('Zoom in')"
                ref="zoomButton"
                textWrap="true"
                minHeight="44"
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
                ref="resetButton"
                textWrap="true"
                minHeight="44"
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
                ref="moveButton"
                textWrap="true"
                minHeight="44"
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
                ref="removeButton"
                textWrap="true"
                minHeight="44"
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
              textWrap="true"
              :text="t(status)"
              automationText="gallery-status"
              color="#B3C2AA"
              fontSize="10"
              textAlignment="center"
              marginTop="13"
            />
            <Label
              textWrap="true"
              :text="t(collectionStatus)"
              color="#8FA18C"
              fontSize="9"
              textAlignment="center"
              marginTop="4"
            />
          </StackLayout>
        </ScrollView>
      </GridLayout>
      <GridLayout
        ref="viewport"
        :marginTop="topInset"
        :marginBottom="bottomInset"
        clipToBounds="true"
        marginLeft="18"
        marginRight="18"
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
