<script lang="ts" setup>
import { liquid, type Animation, type LiquidEffect } from '@rafaelaugusto/jolt'
import type { EventData, View } from '@nativescript/core'
import { onBeforeUnmount, onMounted, ref } from 'nativescript-vue'
import Icon from './Icon.vue'
import { Motion, reducedMotion } from './motion'
const emit = defineEmits<{ chat: []; interact: [] }>()
const paused = ref(false)
const orb = ref()
const ring = ref()
const motion = new Motion()
const breathing = new Motion()
let copy: Animation | undefined
let flow: LiquidEffect | undefined
function startFlow(event: EventData) {
  flow?.stop()
  flow = liquid(event.object as View, { intensity: 0.9, duration: 7200 })
  if (paused.value) flow.pause()
}
function transcribe(event: EventData) {
  if (copy) return
  copy = motion.text(event.object as View, {
    by: 'letter',
    duration: 200,
    stagger: 25,
    delay: 240,
    y: 3,
  })
}
function breathe() {
  if (reducedMotion() || paused.value) return
  breathing.play(
    orb.value,
    {
      scale: [null, 1.035, 0.985, 1.02, 1],
      rotate: [null, 7, -5, 4, 0],
      y: [null, -4, 2, -2, 0],
    },
    { duration: 5200, repeat: Infinity, ease: 'easeInOut' },
  )
  breathing.play(
    ring.value,
    { scale: [null, 1.12, 1], opacity: [null, 0.55, 1] },
    { duration: 1600, repeat: Infinity, ease: 'easeInOut' },
  )
}
function togglePause() {
  emit('interact')
  paused.value = !paused.value
  if (paused.value) {
    breathing.cancel()
    copy?.stop()
    flow?.pause()
  } else {
    flow?.resume()
    breathe()
  }
}
onMounted(async () => {
  motion.play(
    orb.value,
    { opacity: [0, 1], scale: [0.82, 1], y: [14, 0] },
    { type: 'spring', duration: 700, bounce: 0.1, opacity: { duration: 500 } },
  )
  if (await motion.wait(650)) breathe()
})
onBeforeUnmount(() => {
  motion.dispose()
  breathing.dispose()
  flow?.stop()
})
defineExpose({ togglePause, paused })
</script>
<template>
  <GridLayout rows="*, auto, 94" class="assistant-voice">
    <StackLayout class="assistant-orb-stage">
      <Label class="assistant-listening" :text="paused ? 'Paused' : 'Listening…'" />
      <GridLayout ref="orb" class="assistant-orb" accessible="false">
        <Image
          src="~/assistant/assets/voice-orb.png"
          stretch="aspectFit"
          opacity="0.96"
          accessible="false"
          @loaded="startFlow"
        />
      </GridLayout>
    </StackLayout>
    <Label
      row="1"
      class="assistant-transcript"
      minHeight="108"
      textWrap="true"
      accessible="true"
      accessibilityLabel="Hello, I need to find an invoice for October 2024. There was also a calculation for the iScanner."
      @layoutChanged="transcribe"
    >
      <FormattedString>
        <Span text="Hello, I need to find an invoice for October 2024. " />
        <Span text="There was also a calculation for the iScanner." fontWeight="600" />
      </FormattedString>
    </Label>
    <GridLayout row="2" columns="44, *, 44" class="assistant-voice-controls">
      <GridLayout
        class="assistant-round-button assistant-pause"
        accessible="true"
        accessibilityRole="button"
        :accessibilityLabel="paused ? 'Resume voice preview' : 'Pause voice preview'"
        @loaded="motion.press"
        @tap="togglePause"
      >
        <Icon :name="paused ? 'play' : 'pause'" :size="17" />
      </GridLayout>
      <GridLayout col="1" class="assistant-mic-ring">
        <GridLayout ref="ring" class="assistant-mic-halo" />
        <GridLayout
          class="assistant-dark-button"
          accessible="true"
          accessibilityRole="button"
          accessibilityLabel="Finish voice preview and open chat"
          @loaded="motion.press"
          @tap="emit('chat')"
          ><Icon name="mic" :size="25" color="#fffaf2"
        /></GridLayout>
      </GridLayout>
    </GridLayout>
  </GridLayout>
</template>
