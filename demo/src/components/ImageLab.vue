<script setup lang="ts">
import {
  ImageSource,
  isAndroid,
  knownFolders,
  Utils,
  type EventData,
  type Image,
  type GestureEventData,
} from '@nativescript/core'
import { $navigateTo, nextTick, onUnmounted, ref, shallowRef } from 'nativescript-vue'
import PhotoViewer from './PhotoViewer.vue'
import {
  configure,
  imageEffect,
  zoomable,
  type ImageEffect,
  type PhotoDismissal,
  type Zoomable,
} from '@rafaelaugusto/jolt'
import { launchArgument } from '../launch'

const props = defineProps<{ embedded?: boolean }>()
const emit = defineEmits<{ back: [] }>()

const mode = ref(launchArgument('image-lab') === 'zoom' ? 'zoom' : 'effects')
const photo = ref(),
  viewport = ref(),
  backdrop = ref()
const status = ref('Ready'),
  reduced = ref(false),
  closed = ref(false)
let effect: ImageEffect | undefined,
  zoom: Zoomable | undefined,
  dismissal: PhotoDismissal | undefined
let source: ImageSource | undefined, destination: ImageSource | undefined
const fixture = (name: string) =>
  ImageSource.fromFileSync(`${knownFolders.currentApp().path}/assets/${name}.png`)
source = fixture(props.embedded ? 'studio/cove' : 'image-grid')
destination = fixture(props.embedded ? 'studio/dunes' : 'image-target')
const current = shallowRef(source)
const size = ref(props.embedded ? 'aspectFill' : 'aspectFit')
const decorated = ref(false)
function report(name: string, value: unknown) {
  const line = name + ' ' + JSON.stringify(value)
  if (isAndroid) android.util.Log.i('JoltImageLab', line)
  else NSLog('%@', line)
}

function target() {
  return photo.value?.nativeView as Image | undefined
}
function stop() {
  effect?.stop()
  effect = undefined
  zoom?.dispose()
  zoom = undefined
  dismissal = undefined
}
function describe() {
  if (effect)
    status.value = `${effect.effect} · ${effect.diagnostics.backend} · ${Math.round(effect.progress * 100)}%`
}
function run(
  name: 'ripple' | 'distortion' | 'dissolve',
  origin?: { x: number; y: number },
  paused = false,
) {
  const image = target()
  if (!image) return
  effect?.stop()
  effect = imageEffect(image, name, {
    origin,
    duration: name === 'dissolve' ? 2400 : 1400,
    amplitude: 16,
    radius: 110,
    to: destination,
    paused,
  })
  const active = effect
  void Promise.resolve().then(describe)
  void active.finished.then((completed) => {
    if (effect !== active) return
    status.value = `${name} · ${active.diagnostics.backend} · ${completed ? 'finished' : 'stopped'}${active.diagnostics.detail ? ' · ' + active.diagnostics.detail : ''}`
    report('JOLT_IMAGE_EFFECT', { effect: name, completed, ...active.diagnostics })
  })
}
function stretch() {
  clear()
  const modes = ['aspectFit', 'aspectFill', 'fill', 'none']
  size.value = modes[(modes.indexOf(size.value) + 1) % modes.length]
}
function tapRipple(event: GestureEventData) {
  if (mode.value !== 'effects' || effect?.effect === 'distortion') return
  const position = isAndroid
    ? {
        x: Utils.layout.toDeviceIndependentPixels(event.android.getX()),
        y: Utils.layout.toDeviceIndependentPixels(event.android.getY()),
      }
    : event.ios.locationInView(target()!.nativeViewProtected)
  run('ripple', { x: position.x, y: position.y })
}
function pause() {
  effect?.pause()
  describe()
}
function play() {
  effect?.play()
  describe()
}
function reverse() {
  if (effect?.effect !== 'distortion') effect?.reverse()
  describe()
}
function middle() {
  if (effect && effect.effect !== 'distortion') {
    effect.pause()
    effect.progress = 0.5
  }
  describe()
}
function clear() {
  stop()
  current.value = source
  const image = target()
  if (image) image.imageSource = new ImageSource(source!.getNativeSource())
  status.value = 'Restored'
  if (mode.value === 'zoom') attachZoom()
}
function replaceSource() {
  const image = target()
  if (!image) return
  // NativeScript wraps src in a new ImageSource, so wrapper identity cannot
  // identify which fixture is displayed.
  const next = current.value === source ? destination : source
  current.value = next
  image.imageSource = new ImageSource(next!.getNativeSource())
}
function toggleReduced() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
  clear()
}
async function select(next: string) {
  stop()
  closed.value = false
  mode.value = next
  status.value = 'Ready'
  current.value = source
  await nextTick()
  const image = target()
  if (image) image.imageSource = new ImageSource(source!.getNativeSource())
  if (next === 'zoom') attachZoom()
}
function attachZoom() {
  const image = target()
  if (!image || !viewport.value || mode.value !== 'zoom' || closed.value) return
  zoom?.dispose()
  zoom = zoomable(image, {
    viewport: viewport.value,
    backdrop: backdrop.value,
    scale: [1, 5],
    doubleTap: 2.5,
    dismiss: 'vertical',
    onSettled: (state) => {
      status.value = `Zoom ${state.scale.toFixed(2)} · ${Math.round(state.x)}, ${Math.round(state.y)}`
      report('JOLT_ZOOM_SETTLED', state)
    },
    onDismiss: (intent) => {
      dismissal = intent
      status.value = 'Dismissal pending — cancel or accept'
      report('JOLT_ZOOM_DISMISS', intent.state)
    },
  })
}
function loaded(_event: EventData) {
  if (mode.value === 'zoom') setTimeout(attachZoom, 0)
}
function cancelDismiss() {
  dismissal?.cancel()
  dismissal = undefined
  status.value = 'Dismissal cancelled'
}
function acceptDismiss() {
  if (!dismissal?.complete()) return
  dismissal = undefined
  zoom = undefined
  closed.value = true
  status.value = 'Closed — reopen to test cleanup'
}
function reopen() {
  closed.value = false
  status.value = 'Ready'
}
function zoomIn() {
  zoom?.zoomTo(Math.min(5, (zoom.state.scale ?? 1) + 1))
}
function openViewer() {
  stop()
  $navigateTo(PhotoViewer, { animated: false })
}
onUnmounted(() => {
  stop()
  configure({ reducedMotion: 'user' })
})
</script>

<template>
  <GridLayout v-if="embedded" class="exhibit" rows="auto,*,auto,auto">
    <GridLayout columns="*,*" class="ex-controls" marginBottom="12"
      ><Button
        text="Effects"
        :class="{ 'ex-primary': mode === 'effects' }"
        @tap="select('effects')"
        accessibilityLabel="Image effects" /><Button
        col="1"
        text="Photo zoom"
        :class="{ 'ex-primary': mode === 'zoom' }"
        @tap="select('zoom')" /></GridLayout
    ><GridLayout
      v-if="!closed"
      ref="viewport"
      row="1"
      borderRadius="26"
      clipToBounds="true"
      backgroundColor="#28372F"
      ><GridLayout ref="backdrop" backgroundColor="#28372F" /><Image
        ref="photo"
        :src="current"
        :stretch="size"
        @loaded="loaded"
        @tap="tapRipple"
        accessibilityLabel="Landscape, pinch to zoom or use the zoom controls" /></GridLayout
    ><Button v-else row="1" text="Reopen photo" @tap="reopen" /><StackLayout
      row="2"
      class="ex-controls"
      marginTop="16"
      ><GridLayout v-if="mode === 'effects'" columns="*,*,*"
        ><Button text="Ripple" @tap="run('ripple')" class="ex-primary" /><Button
          col="1"
          text="Drag warp"
          @tap="run('distortion')" /><Button
          col="2"
          text="Dissolve"
          @tap="run('dissolve')" /></GridLayout
      ><GridLayout v-else columns="*,*,*"
        ><Button text="Zoom in" @tap="zoomIn" class="ex-primary" /><Button
          col="1"
          text="Reset zoom"
          @tap="zoom?.reset()" /><Button
          col="2"
          text="Close photo"
          @tap="zoom?.requestDismiss()" /></GridLayout
      ><GridLayout v-if="mode === 'effects'" columns="*,*,*"
        ><Button text="Pause" @tap="pause" /><Button
          col="1"
          text="Play"
          @tap="play" /><Button col="2" text="Restore" @tap="clear" /></GridLayout
      ><GridLayout v-else columns="*,*"
        ><Button text="Cancel close" @tap="cancelDismiss" /><Button
          col="1"
          text="Accept close"
          @tap="acceptDismiss" /></GridLayout></StackLayout
    ><Label
      row="3"
      :text="
        mode === 'effects'
          ? 'Tap a point in the image. Watch the surface respond.'
          : 'Pinch, pan or double-tap to get closer.'
      "
      class="ex-note"
      textWrap="true"
    />
  </GridLayout>
  <template v-else>
    <GridLayout rows="auto,auto,*,auto,auto" backgroundColor="#fafafa" padding="12">
      <Label
        v-if="!props.embedded"
        text="Jolt · Image interactions"
        fontSize="23"
        fontWeight="bold"
        color="#18181b"
        marginBottom="8"
        accessibilityLabel="Back to animation playground"
        @tap="emit('back')"
      />
      <GridLayout row="1" columns="*,*" marginBottom="8">
        <Button
          text="Effects"
          @tap="select('effects')"
          accessibilityLabel="Image effects"
        />
        <Button
          col="1"
          text="Photo zoom"
          @tap="select('zoom')"
          accessibilityLabel="Photo zoom"
        />
      </GridLayout>
      <GridLayout
        v-if="!closed"
        ref="viewport"
        row="2"
        backgroundColor="#18181b"
        borderRadius="12"
      >
        <GridLayout ref="backdrop" backgroundColor="#242438" />
        <Image
          ref="photo"
          :src="current"
          :stretch="size"
          :borderRadius="decorated ? 48 : 0"
          :borderWidth="decorated ? 6 : 0"
          borderColor="#ef5598"
          :padding="decorated ? 12 : 0"
          :backgroundColor="decorated ? '#352452' : 'transparent'"
          accessibilityLabel="Color grid, pinch to zoom or use the zoom controls"
          @loaded="loaded"
          @tap="tapRipple"
        />
      </GridLayout>
      <Button v-else row="2" text="Reopen photo" @tap="reopen" />
      <StackLayout row="3" marginTop="8">
        <GridLayout v-if="mode === 'effects'" rows="auto,auto" columns="*,*,*">
          <Button text="Ripple" @tap="run('ripple')" />
          <Button col="1" text="Drag warp" @tap="run('distortion')" />
          <Button col="2" text="Dissolve" @tap="run('dissolve')" />
          <Button row="1" text="Pause" @tap="pause" />
          <Button row="1" col="1" text="Play" @tap="play" />
          <Button row="1" col="2" text="Reverse" @tap="reverse" />
        </GridLayout>
        <GridLayout v-else rows="auto,auto" columns="*,*,*">
          <Button text="Zoom in" @tap="zoomIn" />
          <Button col="1" text="Reset zoom" @tap="zoom?.reset()" />
          <Button col="2" text="Close photo" @tap="zoom?.requestDismiss()" />
          <Button row="1" text="Cancel close" @tap="cancelDismiss" />
          <Button row="1" col="1" text="Accept close" @tap="acceptDismiss" />
          <Button row="1" col="2" text="Reattach" @tap="attachZoom" />
        </GridLayout>
        <GridLayout columns="*,*,*">
          <Button text="Restore" @tap="clear" />
          <Button
            col="1"
            :text="reduced ? 'Motion off' : 'Motion on'"
            @tap="toggleReduced"
          />
          <Button v-if="mode === 'effects'" col="2" text="Scrub 50%" @tap="middle" />
          <Button v-else col="2" text="Open viewer route" @tap="openViewer" />
        </GridLayout>
        <GridLayout v-if="mode === 'effects'" columns="*,*,*,*">
          <Button text="Prepare ripple" @tap="run('ripple', undefined, true)" />
          <Button col="1" :text="`Stretch: ${size}`" @tap="stretch" />
          <Button
            col="2"
            :text="decorated ? 'Corners on' : 'Corners off'"
            @tap="decorated = !decorated"
          />
          <Button col="3" text="Swap source" @tap="replaceSource" />
        </GridLayout>
      </StackLayout>
      <Label
        row="4"
        :text="status"
        fontSize="12"
        color="#52525b"
        textWrap="true"
        marginTop="4"
        accessibilityLiveRegion="polite"
      />
    </GridLayout>
  </template>
</template>
