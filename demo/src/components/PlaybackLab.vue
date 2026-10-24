<script setup lang="ts">
import { Application, isIOS, type EventData, type View } from '@nativescript/core'
import { ref, onUnmounted, registerElement } from 'nativescript-vue'
import {
  animate,
  bind,
  imageEffect,
  motionScope,
  motionValue,
  playbackProgress,
  set,
  timeline,
  type TimelineAnimation,
  type PlaybackAnimation,
} from '@rafaelaugusto/jolt'
import {
  mapKitCoordinate,
  mapKitCamera,
  mapLibreCoordinate,
  mapLibreCamera,
  sceneKitPose,
  type NativeProperty,
  type Coordinate,
  type ScenePose,
} from '@rafaelaugusto/jolt/native'
import { NativeMapDemo, NativeSceneDemo } from '../native-demo'
import { checkPlaybackAdapters } from '../../../benchmarks/playback-adapters'
import { launchArgument } from '../launch'

registerElement('NativeMapDemo', () => NativeMapDemo)
registerElement('NativeSceneDemo', () => NativeSceneDemo)
const emit = defineEmits<{ back: [] }>()
const mode = ref(launchArgument('playback-lab') || 'timeline')
const status = ref('Ready'),
  meters = ref(100),
  percentage = ref(0)
const checksHost = ref()
const checking = ref(false)
const car = ref(),
  bar = ref(),
  halo = ref(),
  effect = ref(),
  delayed = ref()
const scope = motionScope()
let scene: TimelineAnimation | undefined, drive: PlaybackAnimation | undefined
let marker: NativeProperty<Coordinate> | undefined,
  camera: NativeProperty<any> | undefined,
  pose: NativeProperty<ScenePose> | undefined
const paused = ref(false),
  ready = ref(false)
const begin = { latitude: 37.772, longitude: -122.423 },
  end = { latitude: 37.78, longitude: -122.415 }
const startPose: ScenePose = {
  position: [0, 3, 9],
  orientation: [-Math.sin(0.15), 0, 0, Math.cos(0.15)],
}
const endPose: ScenePose = {
  position: [6, 3, 6],
  orientation: [
    -Math.sin(0.15) * Math.cos(0.4),
    Math.sin(0.4) * Math.cos(0.15),
    Math.sin(0.4) * Math.sin(0.15),
    Math.cos(0.4) * Math.cos(0.15),
  ],
}
function clear() {
  scope.reset()
  scene = undefined
  drive = undefined
  paused.value = false
}
function select(next: string) {
  clear()
  mode.value = next
  status.value = 'Ready'
  ready.value = false
}
function observe(animation: PlaybackAnimation) {
  const value = playbackProgress(animation)
  scope.use(() =>
    value.subscribe((p) => {
      percentage.value = Math.round(p * 100)
      meters.value = Math.ceil(100 * (1 - p))
    }),
  )
  if (mode.value === 'timeline') scope.use(() => bind(bar.value, { scaleX: value }))
}
function play() {
  clear()
  status.value = 'Playing'
  const duration = 8000
  if (mode.value === 'timeline') {
    const pulse = motionValue(0)
    scope.use(() =>
      bind(halo.value, {
        opacity: pulse.to([0, 1], [0.15, 0.8]),
        scale: pulse.to([0, 1], [1, 1.5]),
      }),
    )
    set(delayed.value, { opacity: 0 })
    set(car.value, { x: 0, y: 0, rotate: 0 })
    scene = scope.timeline([
      {
        at: 0,
        run: () => {
          drive = animate(
            car.value,
            { path: 'M0 0 L230 0 L230 80 L0 80', orient: true },
            { duration, ease: 'linear' },
          )
          observe(drive)
          return drive
        },
      },
      [
        pulse,
        1,
        { duration: 1000, ease: 'sineInOut', repeat: 7, repeatType: 'reverse', at: 0 },
      ],
      {
        at: 0,
        run: () =>
          imageEffect(effect.value, 'ripple', { duration, amplitude: 14, radius: 140 }),
      },
      [delayed.value, { opacity: [0, 1] }, { duration: 500, at: 4000 }],
    ])
  } else if (mode.value === 'map' && marker && camera) {
    marker.set(begin)
    camera.set(
      isIOS
        ? { ...begin, altitude: 1800, pitch: 15, heading: 0 }
        : { ...begin, zoom: 14, tilt: 10, bearing: 0 },
    )
    scene = scope.timeline([
      {
        at: 0,
        run: () => {
          drive = marker!.animate(end, { duration, ease: 'linear' })
          observe(drive)
          return drive
        },
      },
      {
        at: 0,
        run: () =>
          camera!.animate(
            isIOS
              ? { ...end, altitude: 1300, pitch: 45, heading: 50 }
              : { ...end, zoom: 15, tilt: 45, bearing: 50 },
            { duration, ease: 'sineInOut' },
          ),
      },
    ])
  } else if (pose) {
    pose.set(startPose)
    scene = scope.timeline([
      {
        at: 0,
        run: () => {
          drive = pose!.animate(endPose, { duration, ease: 'sineInOut' })
          observe(drive)
          return drive
        },
      },
    ])
  }
  const current = scene
  void current?.finished.then(
    (completed) => {
      if (scene === current) status.value = completed ? 'Finished' : 'Stopped'
    },
    (error) => {
      status.value = String(error)
    },
  )
}
function toggle() {
  if (!scene) return
  paused.value = !paused.value
  if (paused.value) scene.pause()
  else scene.play()
  status.value = paused.value ? 'Paused' : 'Playing'
}
async function checks() {
  clear()
  checking.value = true
  try {
    await checkPlaybackAdapters(checksHost.value.nativeView, (text) => {
      status.value = text
    })
  } finally {
    checking.value = false
  }
}
function stop() {
  clear()
  status.value = 'Stopped'
}
function mapLoaded(event: EventData) {
  const view = event.object as NativeMapDemo
  view.whenReady(() => {
    if (marker && camera) {
      ready.value = true
      return
    }
    marker = (isIOS ? mapKitCoordinate : mapLibreCoordinate)(view.marker)
    camera = (isIOS ? mapKitCamera : mapLibreCamera)(view.map)
    ready.value = true
  })
}
function mapUnloaded() {
  if (Application.suspended) return
  clear()
  marker?.dispose()
  camera?.dispose()
  marker = camera = undefined
}
function sceneLoaded(event: EventData) {
  if (!isIOS) return
  pose ??= sceneKitPose((event.object as NativeSceneDemo).camera)
  ready.value = true
}
function sceneUnloaded() {
  if (Application.suspended) return
  clear()
  pose?.dispose()
  pose = undefined
}
function suspend() {
  if (scene && !paused.value) toggle()
}
Application.on(Application.suspendEvent, suspend)
onUnmounted(() => {
  clear()
  marker?.dispose()
  camera?.dispose()
  pose?.dispose()
  scope.dispose()
  Application.off(Application.suspendEvent, suspend)
})
const props = defineProps<{ embedded?: boolean }>()
</script>
<template>
  <GridLayout
    class="playback-lab"
    rows="auto,auto,*,auto,auto,auto"
    backgroundColor="#101827"
    color="#edf2ff"
    padding="20"
  >
    <GridLayout v-if="!props.embedded" columns="*,auto" marginBottom="12">
      <StackLayout
        ><Label text="One clock. Every detail." fontSize="24" fontWeight="bold" /><Label
          text="Native playback · Jolt"
          color="#9caec7"
          marginTop="4"
      /></StackLayout>
      <Button col="1" text="Back" @tap="emit('back')" />
    </GridLayout>
    <GridLayout row="1" columns="*,*,*" marginBottom="16">
      <Button text="Timeline" @tap="select('timeline')" /><Button
        col="1"
        text="Native map"
        @tap="select('map')"
      /><Button col="2" text="3D camera" @tap="select('scene')" />
    </GridLayout>
    <GridLayout row="2" borderRadius="16" clipToBounds="true" backgroundColor="#1d2b40">
      <StackLayout v-if="mode === 'timeline'" padding="20">
        <Label text="PICKUP ROUTE" color="#95a9c5" fontSize="12" marginBottom="16" />
        <GridLayout height="140" width="264" horizontalAlignment="left">
          <GridLayout
            width="230"
            height="80"
            horizontalAlignment="left"
            verticalAlignment="top"
            margin="16"
            borderColor="#60738f"
            borderWidth="2"
            borderRadius="4"
          />
          <Label
            ref="car"
            text="➤"
            width="32"
            height="32"
            color="#4fe2b0"
            fontSize="28"
            horizontalAlignment="left"
            verticalAlignment="top"
          />
          <Label
            ref="halo"
            width="24"
            height="24"
            backgroundColor="#8b7ff5"
            borderRadius="12"
            horizontalAlignment="left"
            verticalAlignment="top"
            marginTop="84"
          />
        </GridLayout>
        <GridLayout height="8" backgroundColor="#35445c" marginBottom="18"
          ><GridLayout ref="bar" originX="0" scaleX="0" backgroundColor="#4fe2b0"
        /></GridLayout>
        <Label
          ref="delayed"
          text="Halfway checkpoint"
          opacity="0"
          color="#4fe2b0"
          marginBottom="12"
        />
        <Image
          ref="effect"
          src="~/assets/image-grid.png"
          height="120"
          stretch="aspectFill"
        />
        <Label
          text="Car, pulse and ripple pause together. The checkpoint waits for timeline time."
          textWrap="true"
          color="#95a9c5"
          marginTop="12"
        />
      </StackLayout>
      <NativeMapDemo
        v-else-if="mode === 'map'"
        @loaded="mapLoaded"
        @unloaded="mapUnloaded"
      />
      <NativeSceneDemo v-else @loaded="sceneLoaded" @unloaded="sceneUnloaded" />
    </GridLayout>
    <GridLayout row="3" columns="*,auto" marginTop="16" marginBottom="12">
      <StackLayout
        ><Label :text="status" fontSize="20" /><Label
          :text="
            mode === 'timeline'
              ? `${meters} m remaining · constant speed`
              : 'Native property adapter'
          "
          color="#95a9c5"
          marginTop="5"
      /></StackLayout>
      <Label col="1" :text="`${percentage}%`" fontSize="28" color="#4fe2b0" />
    </GridLayout>
    <GridLayout row="4" columns="*,*,*">
      <Button
        text="Play scene"
        :isEnabled="mode === 'timeline' || ready"
        @tap="play"
      /><Button
        col="1"
        :text="paused ? 'Resume scene' : 'Pause scene'"
        @tap="toggle"
      /><Button col="2" text="Stop scene" @tap="stop" />
    </GridLayout>
    <GridLayout row="5" ref="checksHost" height="40"
      ><Button text="Run native checks" :isEnabled="!checking" @tap="checks"
    /></GridLayout>
  </GridLayout>
</template>

<style scoped>
.playback-lab Button {
  background-color: #31425c;
  color: #edf2ff;
  border-radius: 10;
  font-size: 12;
  padding: 8 5;
  margin: 3;
}
</style>
