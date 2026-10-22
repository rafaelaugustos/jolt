<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { gradient, type Gradient } from '@rafaelaugusto/jolt'

const linear = ref()
const radial = ref()
const conic = ref()
const playing = ref(false)
const swapped = ref(false)
let glows: Gradient[] = []

const warm = ['#FF5F6D', '#FFC371']
const cool = ['#22D3EE', '#6366F1']

onMounted(() => {
  glows = [
    gradient(linear.value, { type: 'linear', colors: warm, angle: 135 }),
    gradient(radial.value, {
      type: 'radial',
      colors: ['#A78BFA', '#0F172A'],
      center: { x: 0.3, y: 0.3 },
      radius: 0.45,
    }),
    gradient(conic.value, {
      type: 'conic',
      colors: ['#22D3EE', '#A855F7', '#F43F5E', '#22D3EE'],
    }),
  ]
})
onUnmounted(() => glows.forEach((glow) => glow.remove()))

function toggle() {
  const [line, light, sweep] = glows
  if (playing.value) {
    glows.forEach((glow) => glow.stop())
  } else {
    line!.animate(
      { angle: 315 },
      { duration: 1600, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' },
    )
    light!.animate(
      { center: { x: 0.7, y: 0.7 }, radius: 0.9 },
      { duration: 1400, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' },
    )
    sweep!.animate({ angle: 360 }, { duration: 2000, ease: 'linear', repeat: Infinity })
  }
  playing.value = !playing.value
}

function swap() {
  swapped.value = !swapped.value
  glows[0]!.animate({ colors: swapped.value ? cool : warm }, { duration: 700 })
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Gradients" />
    <Label
      class="muted"
      textWrap="true"
      text="gradient(card, { type: 'radial', colors, radius })"
    />

    <GridLayout columns="*, *, *" class="gradient-row" height="130">
      <GridLayout ref="linear" class="gradient-card">
        <Label class="gradient-label" text="linear" />
      </GridLayout>
      <GridLayout ref="radial" col="1" class="gradient-card">
        <Label class="gradient-label" text="radial" />
      </GridLayout>
      <GridLayout ref="conic" col="2" class="gradient-card">
        <Label class="gradient-label" text="conic" />
      </GridLayout>
    </GridLayout>

    <GridLayout columns="*, *">
      <Button
        class="button"
        :text="playing ? 'Stop gradients' : 'Play gradients'"
        @tap="toggle"
      />
      <Button col="1" class="button" text="Swap colors" @tap="swap" />
    </GridLayout>
  </StackLayout>
</template>
