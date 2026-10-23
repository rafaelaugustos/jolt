<script setup lang="ts">
import {
  Application,
  Color,
  isIOS,
  knownFolders,
  type EventData,
} from '@nativescript/core'
import { onUnmounted, ref, registerElement } from 'nativescript-vue'
import {
  animate,
  motionValue,
  motionScope,
  timeline,
  type PlaybackAnimation,
  type TimelineAnimation,
} from '@rafaelaugusto/jolt'
import {
  sceneKitFieldOfView,
  sceneKitMaterialDiffuse,
  sceneKitLightIntensity,
  type NativeProperty,
} from '@rafaelaugusto/jolt/native'
import { NativeLightingDemo } from '../scene-lighting'
import { checkSceneCamera } from '../../../benchmarks/scene-camera'
import { launchArgument } from '../launch'
registerElement('NativeCameraDemo', () => NativeLightingDemo)
const emit = defineEmits<{ back: [] }>()
const visible = ref(true),
  checking = ref(false)
const status = ref('Fixed camera position. Zoom changes only the viewing angle.')
let scope = motionScope(),
  source = motionValue(0),
  lightSource = motionValue(0)
let fov: NativeProperty<number> | undefined, target: NativeLightingDemo | undefined
let group: TimelineAnimation | undefined,
  tracks: PlaybackAnimation[] = []
const properties: { dispose(): void }[] = []
const own = <T extends { dispose(): void }>(p: T): T => {
  properties.push(p)
  return p
}
const navigation: { players: number; cameras: number; appearance: number }[] = []
function release() {
  scope.dispose()
  for (const p of properties.splice(0)) p.dispose()
  fov = undefined
  group = undefined
  tracks = []
}
function loaded(event: EventData) {
  target = event.object as NativeLightingDemo
  if (!isIOS || checking.value || properties.length) return
  scope = motionScope()
  const camera = own(sceneKitFieldOfView(target.camera.camera!))
  fov = camera
  const paint = own(sceneKitMaterialDiffuse(target.paint))
  const light = own(sceneKitLightIntensity(target.keyLight))
  scope.use(() => camera.bind(source, (p) => 70 - p * 38))
  scope.use(() =>
    paint.bind(
      source,
      (p) =>
        new Color(
          255,
          Math.round(40 + p * 180),
          Math.round(90 + p * 65),
          Math.round(230 - p * 190),
        ),
    ),
  )
  scope.use(() => light.bind(lightSource, (p) => 550 + p * 350))
}
function clear() {
  release()
  target = undefined
  source = motionValue(0)
  lightSource = motionValue(0)
}
function unloaded() {
  if (!Application.suspended) clear()
}
function zoom(to: number) {
  if (!fov || checking.value) return
  scope.resume()
  group?.stop()
  tracks = []
  const remember = (run: PlaybackAnimation) => {
    tracks.push(run)
    return run
  }
  group = scope.add(
    timeline([
      {
        at: 0,
        run: () => remember(animate(source, to, { duration: 6000, ease: 'sineInOut' })),
      },
      {
        at: 0,
        run: () => remember(animate(lightSource, to, { duration: 6000, ease: 'linear' })),
      },
    ]),
  )
  status.value = to
    ? 'Zooming in to 32°; paint and light follow.'
    : 'Reversing toward 70° from the current framing.'
}
function pause() {
  scope.suspend()
  status.value = 'Camera, paint and light paused.'
}
function resume() {
  scope.resume()
  status.value = 'Camera, paint and light resumed.'
}
function seek() {
  for (const run of tracks) run.progress = 0.5
  status.value = 'Child playbacks moved to 50%.'
}
function replace() {
  if (!fov || checking.value) return
  const current = fov.get()
  scope.suspend()
  group?.stop()
  source = motionValue((70 - current) / 38)
  scope.resume()
  zoom(1)
  status.value = 'New source attached at the current angle; zoom continues.'
}
function toggle() {
  clear()
  if (isIOS && visible.value && launchArgument('scene-camera') !== undefined) {
    navigation.push({
      players: JoltPropertyPlayer.activeCount(),
      cameras: JoltReferenceProperties.sceneCameraSinkCount(),
      appearance: JoltReferenceProperties.sceneAppearanceSinkCount(),
    })
    void knownFolders
      .documents()
      .getFile('jolt-camera-navigation.json')
      .writeText(
        JSON.stringify(
          {
            passed: navigation.every((n) => !n.players && !n.cameras && !n.appearance),
            navigation,
          },
          null,
          2,
        ),
      )
  }
  visible.value = !visible.value
  status.value = visible.value ? 'Camera scene recreated.' : 'Camera scene disposed.'
}
async function checks() {
  if (!target || checking.value) return
  release()
  checking.value = true
  try {
    await checkSceneCamera(
      target,
      (message) => {
        status.value = message
      },
      launchArgument('camera-checks') ?? 'all',
    )
  } catch (error) {
    status.value = `FAILED: ${error}`
  } finally {
    checking.value = false
  }
}
function suspend() {
  if (!checking.value) scope.suspend()
}
Application.on(Application.suspendEvent, suspend)
onUnmounted(() => {
  Application.off(Application.suspendEvent, suspend)
  clear()
})
</script>
<template>
  <StackLayout class="section">
    <Button text="Back to animations" class="button" @tap="emit('back')" />
    <Label text="SceneKit camera zoom" class="heading" />
    <Label
      text="70° wide → 32° close. Same camera position."
      class="muted"
      textWrap="true"
    />
    <NativeCameraDemo
      v-if="visible"
      height="300"
      marginTop="12"
      @loaded="loaded"
      @unloaded="unloaded"
    />
    <Label v-else text="Native camera released" height="300" textAlignment="center" />
    <GridLayout v-if="isIOS" columns="*,*,*">
      <Button text="Zoom in" class="button" @tap="zoom(1)" />
      <Button col="1" text="Zoom out" class="button" @tap="zoom(0)" />
      <Button col="2" text="Swap source" class="button" @tap="replace" />
    </GridLayout>
    <GridLayout v-if="isIOS" columns="*,*,*">
      <Button text="Pause camera" class="button" @tap="pause" />
      <Button col="1" text="Resume camera" class="button" @tap="resume" />
      <Button col="2" text="Seek camera" class="button" @tap="seek" />
    </GridLayout>
    <GridLayout v-if="isIOS" columns="*,*">
      <Button
        :text="visible ? 'Leave camera' : 'Enter camera'"
        class="button"
        @tap="toggle"
      />
      <Button
        col="1"
        text="Check camera"
        class="button"
        :isEnabled="!checking"
        @tap="checks"
      />
    </GridLayout>
    <Label :text="status" class="muted" textWrap="true" marginTop="12" />
  </StackLayout>
</template>
