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
  set,
  stop,
  motionValue,
  motionScope,
  timeline,
  type PlaybackAnimation,
  type TimelineAnimation,
} from '@rafaelaugusto/jolt'
import {
  sceneKitPose,
  sceneKitLightIntensity,
  sceneKitLightColor,
  sceneKitMaterialDiffuse,
  sceneKitMaterialEmission,
  sceneKitMaterialTransparency,
} from '@rafaelaugusto/jolt/native'
import { NativeLightingDemo } from '../scene-lighting'
import { checkSceneAppearance } from '../../../benchmarks/scene-appearance'
import { launchArgument } from '../launch'
registerElement('NativeLightingDemo', () => NativeLightingDemo)
const emit = defineEmits<{ back: [] }>()
const visible = ref(true),
  checking = ref(false),
  pulsing = ref(false)
const status = ref('A shared value controls the camera, paint and lighting.')
const properties: { dispose(): void }[] = []
const own = <T extends { dispose(): void }>(p: T): T => {
  properties.push(p)
  return p
}
function release() {
  scope.dispose()
  for (const p of properties.splice(0)) p.dispose()
}
let scope = motionScope(),
  target: NativeLightingDemo | undefined,
  run: TimelineAnimation | undefined
let tracks: PlaybackAnimation[] = []
const navigation: { active: number; sinks: number }[] = []
const progress = motionValue(0),
  lightValue = motionValue(0)
const unit = (v: number) => Math.max(0, Math.min(1, v))
const rgb = (r: number, g: number, b: number) =>
  new Color(
    255,
    Math.round(unit(r) * 255),
    Math.round(unit(g) * 255),
    Math.round(unit(b) * 255),
  )
function loaded(event: EventData) {
  target = event.object as NativeLightingDemo
  if (!isIOS || checking.value || properties.length) return
  scope = motionScope()
  const pose = own(sceneKitPose(target.camera)),
    intensity = own(sceneKitLightIntensity(target.keyLight)),
    light = own(sceneKitLightColor(target.keyLight))
  const diffuse = own(sceneKitMaterialDiffuse(target.paint)),
    emission = own(sceneKitMaterialEmission(target.charge)),
    opacity = own(sceneKitMaterialTransparency(target.glass))
  scope.use(() =>
    pose.bind(progress, (p) => ({
      position: [p * 1.4, 3.3 - p * 0.6, 8.5 - p * 1.4],
      orientation: [-Math.sin(0.16), 0, 0, Math.cos(0.16)],
    })),
  )
  scope.use(() =>
    diffuse.bind(progress, (p) => rgb(0.15 + p * 0.65, 0.35 + p * 0.25, 0.9 - p * 0.75)),
  )
  scope.use(() => opacity.bind(progress, (p) => 1 - unit(p) * 0.65))
  scope.use(() =>
    light.bind(progress, (p) => rgb(1 - p * 0.45, 0.8 + p * 0.2, 0.65 + p * 0.35)),
  )
  scope.use(() => intensity.bind(lightValue, (p) => 400 + Math.max(0, p) * 1600))
  scope.use(() =>
    emission.bind(lightValue, (p) =>
      rgb(0.02, 0.08 + unit(p) * 0.9, 0.12 + unit(p) * 0.7),
    ),
  )
}
function clear() {
  release()
  run = undefined
  tracks = []
  target = undefined
  set(progress, 0)
  set(lightValue, 0)
  pulsing.value = false
}
function unloaded() {
  if (!Application.suspended) clear()
}
function play() {
  if (!target || checking.value) return
  scope.resume()
  run?.stop()
  stop(lightValue, { layer: 'charge' })
  pulsing.value = false
  set(progress, 0)
  set(lightValue, 0)
  tracks = []
  const remember = (track: PlaybackAnimation) => {
    tracks.push(track)
    return track
  }
  run = scope.add(
    timeline([
      {
        at: 0,
        run: () => remember(animate(progress, 1, { duration: 10000, ease: 'linear' })),
      },
      {
        at: 0,
        run: () =>
          remember(animate(lightValue, 0.6, { duration: 10000, ease: 'linear' })),
      },
    ]),
  )
  status.value = 'Base running: camera, paint, glass and light move together.'
}
function pulse() {
  if (!target || checking.value || scope.suspended) return
  pulsing.value = !pulsing.value
  stop(lightValue, { layer: 'charge' })
  if (pulsing.value)
    scope.animate(lightValue, [0, 0.5, 0], {
      duration: 1100,
      ease: 'sineInOut',
      repeat: Infinity,
      layer: 'charge',
    })
  status.value = pulsing.value
    ? 'Charge pulse added; base lighting continues.'
    : 'Charge pulse removed; base lighting preserved.'
}
function pause() {
  scope.suspend()
  status.value = 'Paused together.'
}
function resume() {
  scope.resume()
  status.value = 'Resumed together.'
}
function seek() {
  for (const track of tracks) track.progress = 0.5
  status.value = 'Base at 50%.'
}
function toggle() {
  clear()
  if (isIOS && visible.value && launchArgument('scene-lighting') !== undefined) {
    navigation.push({
      active: JoltPropertyPlayer.activeCount(),
      sinks: JoltReferenceProperties.sceneAppearanceSinkCount(),
    })
    void knownFolders
      .documents()
      .getFile('jolt-scene-navigation.json')
      .writeText(
        JSON.stringify({
          passed: navigation.every((n) => n.active === 0 && n.sinks === 0),
          navigation,
        }),
      )
  }
  visible.value = !visible.value
  status.value = visible.value ? 'Scene recreated. Ready.' : 'Scene disposed.'
}
async function checks() {
  if (!target || checking.value) return
  release()
  run = undefined
  set(progress, 0)
  set(lightValue, 0)
  pulsing.value = false
  checking.value = true
  try {
    await checkSceneAppearance(
      target,
      (message) => (status.value = message),
      launchArgument('scene-checks') ?? 'all',
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
    <Label text="SceneKit lighting" class="heading" />
    <Label
      text="One scene. Shared light, paint and charge."
      class="muted"
      textWrap="true"
    />
    <NativeLightingDemo
      v-if="visible"
      height="320"
      marginTop="16"
      @loaded="loaded"
      @unloaded="unloaded"
    />
    <Label v-else text="Native scene released" height="320" textAlignment="center" />
    <GridLayout v-if="isIOS" columns="*,*,*">
      <Button text="Play scene" class="button" @tap="play" />
      <Button col="1" text="Pause scene" class="button" @tap="pause" />
      <Button col="2" text="Resume scene" class="button" @tap="resume" />
    </GridLayout>
    <GridLayout v-if="isIOS" columns="*,*,*">
      <Button
        :text="pulsing ? 'Remove pulse' : 'Charge pulse'"
        class="button"
        @tap="pulse"
      />
      <Button col="1" text="Seek 50%" class="button" @tap="seek" />
      <Button
        col="2"
        :text="visible ? 'Leave scene' : 'Enter scene'"
        class="button"
        @tap="toggle"
      />
    </GridLayout>
    <Button
      v-if="isIOS"
      text="Check SceneKit"
      class="button"
      :isEnabled="!checking"
      @tap="checks"
    />
    <Label :text="status" class="muted" textWrap="true" marginTop="12" />
  </StackLayout>
</template>
