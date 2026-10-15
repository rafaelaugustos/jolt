<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import type { TouchGestureEventData } from '@nativescript/core'
import { animate, type PlaybackAnimation } from '@rafaelaugusto/jolt'
const card = ref()
const marker = ref()
let pulse: PlaybackAnimation | undefined
let ended = true
const status = ref('Play, pause, then drag the slider.')
const slider = ref(0)
let current: PlaybackAnimation | undefined
let generation = 0
function create() {
  current?.stop()
  const animation = animate(
    card.value,
    {
      x: [-100, 100],
      rotateY: [-45, 45],
      scale: [0.8, 1.1],
      borderRadius: [8, 40],
      backgroundColor: ['#263b27', '#38273f'],
    },
    { duration: 4000, ease: 'easeInOut' },
  )
  current = animation
  ended = false
  const own = ++generation
  void animation.finished.then((finished) => {
    if (generation === own) {
      ended = true
      status.value = finished ? 'Finished — Play starts a new animation' : 'Stopped'
    }
  })
  return animation
}
function play() {
  if (!current || ended) create()
  else current.play()
  status.value = 'Playing'
}
function pause() {
  current?.pause()
  status.value = 'Paused'
}
function begin() {
  if (!current || ended) create()
  current!.pause()
}
function scrub(event: { value: number }) {
  slider.value = event.value
  if (!current) return
  begin()
  current!.progress = event.value / 100
  status.value = `Paused at ${Math.round(event.value)}%`
}
function touch(event: TouchGestureEventData) {
  if (event.action === 'down') begin()
}
function freeze() {
  current?.stop()
}
onMounted(() => {
  create().pause()
  status.value = 'Paused — drag the slider or Play'
  pulse = animate(
    marker.value,
    { opacity: [0.2, 1, 0.2] },
    { duration: 1000, repeat: Infinity },
  )
})
onUnmounted(() => {
  generation++
  current?.stop()
  pulse?.stop()
})
</script>
<template>
  <StackLayout class="section">
    <Label class="heading" text="Playback controls" />
    <Label
      class="muted"
      text="Pause and scrub a native animation. Other views keep moving."
      textWrap="true"
    />
    <GridLayout columns="20, *" marginTop="8"
      ><Label ref="marker" text="●" color="#b6ee64" /><Label
        col="1"
        class="muted"
        text="Independent animation"
    /></GridLayout>
    <GridLayout height="190" marginTop="12" backgroundColor="#eeeeea">
      <GridLayout
        ref="card"
        width="110"
        height="110"
        borderRadius="8"
        backgroundColor="#263b27"
      >
        <Label
          text="Jolt"
          color="#d5ff91"
          fontSize="24"
          textAlignment="center"
          verticalAlignment="middle"
        />
      </GridLayout>
    </GridLayout>
    <Slider
      :value="slider"
      minValue="0"
      maxValue="100"
      @valueChange="scrub"
      @touch="touch"
    />
    <GridLayout columns="*, *, *">
      <Button class="button" text="Play" @tap="play" />
      <Button col="1" class="button" text="Pause" @tap="pause" />
      <Button col="2" class="button" text="Stop" @tap="freeze" />
    </GridLayout>
    <Label class="muted" :text="status" textWrap="true" />
  </StackLayout>
</template>
