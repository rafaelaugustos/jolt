<script setup lang="ts">
import { type LayoutBase } from '@nativescript/core'
import { computed, onMounted, onUnmounted, ref } from 'nativescript-vue'
import {
  animate,
  bind,
  motionValue,
  motionScope,
  stop,
  type Gradient,
  type PlaybackAnimation,
} from '@rafaelaugusto/jolt'
import { checkGradientValues } from '../../../benchmarks/gradient-values'
import { launchArgument } from '../launch'

const offset = motionValue(0)
const progress = offset.to([0, 220], [0, 1], { clamp: false })
const tint = progress.to([0, 1], ['#ed4b82', '#45c8f5'])
const angle = progress.to([0, 1], [0, 360], { clamp: false })
const center = {
  x: progress.to([0, 1], [0.15, 0.85]),
  y: progress.to([1, 0], [0.2, 0.8]),
}
const stops = [0, progress.to([0, 1], [0.45, 1])]
const scope = motionScope()
const halo = ref(),
  linear = ref(),
  thumb = ref(),
  checksHost = ref()
const status = ref('Drag the light, then let it travel.'),
  paused = ref(false),
  suspended = ref(false),
  wide = ref(true),
  conic = ref(true),
  checking = ref(false)
const directive = computed(() => ({
  type: conic.value ? ('conic' as const) : ('linear' as const),
  colors: [tint, '#20233c', tint],
  stops: [0, progress.to([0, 1], [0.25, 0.75]), 1],
  angle,
  center,
}))
let radial: Gradient
let run: PlaybackAnimation | undefined
function setup() {
  scope.reset()
  radial = scope.gradient(halo.value, {
    type: 'radial',
    colors: [tint, 'rgba(16,23,43,0)'],
    center,
    radius: progress.to([0, 1], [0.35, 0.9]),
    stops,
  })
  scope.gradient(linear.value, {
    type: 'linear',
    colors: [tint, '#34235a'],
    angle,
    stops,
  })
  scope.use(() =>
    bind(thumb.value, {
      x: offset,
      y: progress.to([0, 1], [45, -45]),
      opacity: progress.to([0, 1], [0.55, 1]),
    }),
  )
  scope.drag(thumb.value, {
    axis: 'x',
    value: offset,
    bounds: { left: 0, right: 220 },
    snap: [0, 110, 220],
    rubberband: true,
    onStart: () => {
      status.value = 'Following your touch'
      paused.value = false
    },
    onRelease: () => {
      status.value = 'Settling on the same value'
    },
  })
}
onMounted(setup)
onUnmounted(() => {
  scope.dispose()
  stop(offset)
})
function travel() {
  if (scope.suspended) {
    scope.resume()
    suspended.value = false
  }
  run = scope.add(
    animate(offset, offset.get() > 110 ? 0 : 220, { duration: 3000, ease: 'easeInOut' }),
  )
  paused.value = false
  status.value = 'Position, light and color travel together'
}
function pause() {
  if (!run) return
  if (run.paused) run.play()
  else run.pause()
  paused.value = run.paused
  status.value = run.paused ? 'Paused' : 'Resumed'
}
function pulse() {
  scope.add(
    animate(offset, [0, 35, 0], { duration: 900, ease: 'sineInOut', layer: 'pulse' }),
  )
  status.value = 'A pulse added to the same value'
}
function suspend() {
  if (scope.suspended) scope.resume()
  else scope.suspend()
  suspended.value = scope.suspended
  status.value = suspended.value ? 'Bindings held' : 'Bindings following again'
}
function rebind() {
  radial.bind({ radius: progress.to([0, 1], [0.25, 1.05]) })
  status.value = 'Radius rebound; angle, center and colors kept'
}
async function checks() {
  if (checking.value) return
  stop(offset)
  checking.value = true
  try {
    await checkGradientValues(
      checksHost.value.nativeView as LayoutBase,
      (text) => (status.value = text),
      launchArgument('gradient-checks') || 'all',
    )
  } catch (error) {
    const details =
      error instanceof AggregateError
        ? error.errors.map(String).join('; ')
        : String(error)
    status.value = `FAILED: ${details}`
    console.error('Gradient checks:', details)
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <StackLayout class="section" backgroundColor="#10172b" padding="20" marginTop="0">
    <Label
      text="A light that follows you"
      color="white"
      fontSize="23"
      fontWeight="bold"
    />
    <Label
      text="One movement. Three gradients."
      color="#a9b7ce"
      fontSize="13"
      marginTop="4"
      marginBottom="18"
    />
    <GridLayout columns="*,12,*" height="96" marginBottom="12">
      <GridLayout ref="linear" borderRadius="18"
        ><Label
          text="LINEAR"
          color="white"
          fontSize="11"
          margin="12"
          verticalAlignment="bottom"
      /></GridLayout>
      <GridLayout col="2" v-gradient="directive" borderRadius="18"
        ><Label
          :text="conic ? 'CONIC · VUE' : 'LINEAR · VUE'"
          color="white"
          fontSize="11"
          margin="12"
          verticalAlignment="bottom"
      /></GridLayout>
    </GridLayout>
    <GridLayout
      ref="halo"
      :height="wide ? 190 : 230"
      borderRadius="22"
      backgroundColor="#172239"
      marginBottom="14"
    >
      <Label
        text="RADIAL"
        color="#bed0e6"
        fontSize="11"
        margin="14"
        verticalAlignment="top"
      />
      <GridLayout
        ref="thumb"
        width="42"
        height="42"
        borderRadius="21"
        backgroundColor="white"
        horizontalAlignment="left"
        marginLeft="16"
        accessibilityLabel="Drag light"
      >
        <Label
          text="↔"
          color="#354261"
          fontSize="22"
          textAlignment="center"
          verticalAlignment="middle"
        />
      </GridLayout>
    </GridLayout>
    <GridLayout columns="*,*,*">
      <Button class="button" text="Travel" @tap="travel" />
      <Button col="1" class="button" :text="paused ? 'Resume' : 'Pause'" @tap="pause" />
      <Button col="2" class="button" text="Seek 70%" @tap="run && (run.progress = 0.7)" />
    </GridLayout>
    <GridLayout columns="*,*,*">
      <Button class="button" text="Pulse" @tap="pulse" />
      <Button
        col="1"
        class="button"
        :text="suspended ? 'Follow' : 'Hold'"
        @tap="suspend"
      />
      <Button col="2" class="button" text="Resize" @tap="wide = !wide" />
    </GridLayout>
    <GridLayout columns="*,*,*">
      <Button class="button" text="Switch type" @tap="conic = !conic" />
      <Button col="1" class="button" text="Rebind" @tap="rebind" />
      <Button
        col="2"
        class="button"
        text="Run checks"
        :isEnabled="!checking"
        @tap="checks"
      />
    </GridLayout>
    <Label :text="status" color="#bdcbe2" fontSize="11" textWrap="true" marginTop="10" />
    <StackLayout ref="checksHost" />
  </StackLayout>
</template>
