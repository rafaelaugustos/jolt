<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'nativescript-vue'
import { animate, type PlaybackAnimation } from '@rafaelaugusto/jolt'
const plane = ref()
const stage = ref()
const span = ref(280)
const mode = ref<'curve' | 'orbit'>('curve')
const orient = ref(true)
const paused = ref(false)
const status = ref('Follow the curve, then try the orbit.')
let current: PlaybackAnimation | undefined
let ended = true
let generation = 0
const radius = 60
const path = computed(() =>
  mode.value === 'curve'
    ? `M0 0 C${(80 * span.value) / 280} -120 ${(200 * span.value) / 280} -120 ${span.value} 0`
    : `M${span.value / 2 + radius} -60 A${radius} ${radius} 0 1 1 ${span.value / 2 - radius} -60 A${radius} ${radius} 0 1 1 ${span.value / 2 + radius} -60`,
)
const dots = computed(() =>
  Array.from({ length: 33 }, (_, i) => {
    const t = i / 32,
      u = 1 - t
    return mode.value === 'curve'
      ? {
          x:
            ((3 * u * u * t * 80 + 3 * u * t * t * 200 + t * t * t * 280) * span.value) /
            280,
          y: -360 * u * t,
        }
      : {
          x: span.value / 2 + radius * Math.cos(t * 2 * Math.PI),
          y: -60 + radius * Math.sin(t * 2 * Math.PI),
        }
  }),
)
function replay() {
  current?.stop()
  if (!orient.value) plane.value.nativeView.rotate = 0
  const own = ++generation
  paused.value = false
  ended = false
  current = animate(
    plane.value,
    { path: path.value, orient: orient.value },
    { duration: 2400, ease: 'linear' },
  )
  status.value = orient.value
    ? 'Following the path and its tangent.'
    : 'Following the path with a fixed heading.'
  void current.finished.then((finished) => {
    if (generation !== own) return
    ended = true
    paused.value = false
    status.value = finished ? 'Finished — replay or choose another path.' : 'Stopped'
  })
}
function choose(next: 'curve' | 'orbit') {
  mode.value = next
  replay()
}
function toggleOrient() {
  orient.value = !orient.value
  replay()
}
function togglePause() {
  if (!current || ended) {
    replay()
    return
  }
  if (paused.value) {
    current.play()
    status.value = 'Playing'
  } else {
    current.pause()
    status.value = 'Paused'
  }
  paused.value = !paused.value
}
function freeze() {
  current?.stop()
}
function layout() {
  const width = stage.value?.nativeView?.getActualSize().width ?? 0
  if (!width) return
  const next = Math.min(280, Math.max(120, Math.floor(width - 36)))
  if (next !== span.value) {
    span.value = next
    replay()
  }
}
onMounted(replay)
onUnmounted(() => {
  generation++
  freeze()
})
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        text="THE SCENIC ROUTE"
        class="ex-kicker"
        verticalAlignment="top" /><GridLayout
        ref="stage"
        height="225"
        @layoutChanged="layout"
        verticalAlignment="middle"
        ><GridLayout
          width="112"
          height="112"
          borderRadius="56"
          backgroundColor="#35483B"
          verticalAlignment="top"
          marginTop="18" /><Label
          text="N"
          fontSize="10"
          color="#8B9C7C"
          verticalAlignment="top"
          horizontalAlignment="center" /><Label
          v-for="(dot, index) in dots"
          :key="index"
          width="4"
          height="4"
          borderRadius="2"
          backgroundColor="#8D9C6D"
          horizontalAlignment="left"
          verticalAlignment="top"
          marginLeft="22"
          marginTop="160"
          :translateX="dot.x"
          :translateY="dot.y" /><GridLayout
          ref="plane"
          width="24"
          height="24"
          horizontalAlignment="left"
          verticalAlignment="top"
          marginLeft="12"
          marginTop="150"
          ><GridLayout
            backgroundColor="#E3FC62"
            :style="{
              clipPath: 'polygon(0% 0%, 100% 50%, 0% 100%, 25% 50%)',
            }" /></GridLayout></GridLayout
      ><Label
        :text="mode === 'curve' ? 'Take a different path.' : 'Come full circle.'"
        fontSize="23"
        fontWeight="bold"
        color="#E6ECD9"
        verticalAlignment="bottom" /></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*,*"
        ><Button col="0" text="Curve" @tap="choose('curve')" class="ex-primary" /><Button
          col="1"
          text="Orbit"
          @tap="choose('orbit')" /><Button
          col="2"
          :text="orient ? 'Orient: on' : 'Orient: off'"
          @tap="toggleOrient" /></GridLayout
      ><GridLayout columns="*,*,*"
        ><Button col="0" text="Replay" @tap="replay" /><Button
          col="1"
          :text="paused ? 'Resume' : 'Pause'"
          @tap="togglePause" /><Button
          col="2"
          text="Stop"
          @tap="freeze" /></GridLayout></StackLayout
    ><Label :text="status" class="ex-note" textWrap="true" />
  </StackLayout>
  <template v-else>
    <StackLayout class="section" @unloaded="freeze">
      <Label class="heading" text="Motion along a path" />
      <Label
        class="muted"
        text="A curve or an orbit. Pause anywhere along the way."
        textWrap="true"
      />
      <GridLayout ref="stage" class="stage" height="225" @layoutChanged="layout">
        <GridLayout
          v-for="(dot, index) in dots"
          :key="index"
          width="4"
          height="4"
          borderRadius="2"
          backgroundColor="#b8b8bf"
          horizontalAlignment="left"
          verticalAlignment="top"
          marginLeft="22"
          marginTop="160"
          :translateX="dot.x"
          :translateY="dot.y"
        />
        <GridLayout
          ref="plane"
          width="24"
          height="24"
          horizontalAlignment="left"
          verticalAlignment="top"
          marginLeft="12"
          marginTop="150"
        >
          <GridLayout
            backgroundColor="#5f4bda"
            :style="{ clipPath: 'polygon(0% 0%, 100% 50%, 0% 100%, 25% 50%)' }"
          />
        </GridLayout>
      </GridLayout>
      <GridLayout columns="*, *, *">
        <Button class="button" text="Curve" @tap="choose('curve')" />
        <Button col="1" class="button" text="Orbit" @tap="choose('orbit')" />
        <Button
          col="2"
          class="button"
          :text="orient ? 'Orient: on' : 'Orient: off'"
          @tap="toggleOrient"
        />
      </GridLayout>
      <GridLayout columns="*, *, *">
        <Button class="button" text="Replay" @tap="replay" />
        <Button
          col="1"
          class="button"
          :text="paused ? 'Resume' : 'Pause'"
          @tap="togglePause"
        />
        <Button col="2" class="button" text="Stop" @tap="freeze" />
      </GridLayout>
      <Label class="muted" :text="status" textWrap="true" />
    </StackLayout>
  </template>
</template>
