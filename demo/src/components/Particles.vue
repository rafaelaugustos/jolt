<script lang="ts" setup>
import { isIOS } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { confetti, particles, type ParticleOptions } from '@rafaelaugusto/jolt'

const stage = ref()
const celebrate = ref()
const label = ref('Particles')
let stopEmitter: (() => void) | undefined
let stopConfetti: (() => void) | undefined
const effects = {
  Snow: {
    source: 'top',
    angle: 90,
    velocity: 45,
    velocityRange: 15,
    spread: 30,
    rate: 30,
    size: 5,
    lifetime: 5000,
  },
  Sparks: {
    colors: ['#facc15', '#fb923c'],
    velocity: 120,
    velocityRange: 50,
    spread: 360,
    rate: 70,
    size: 3,
    lifetime: 1000,
  },
  Bubbles: {
    shape: 'ring',
    source: 'bottom',
    colors: ['#67e8f9', '#a5f3fc'],
    velocity: 40,
    spread: 20,
    rate: 14,
    size: 18,
    lifetime: 5000,
  },
} satisfies Record<string, ParticleOptions>

function play(name: keyof typeof effects) {
  stopEmitter?.()
  label.value = name
  stopEmitter = particles(stage.value, effects[name])
}
function burst() {
  stopConfetti = confetti(celebrate.value)
}
function stop() {
  stopEmitter?.()
  stopConfetti?.()
  label.value = 'Particles'
}
onUnmounted(stop)
</script>

<template>
  <StackLayout v-if="isIOS" class="section">
    <Label class="heading" text="Particles" />
    <Label
      class="muted"
      text="Native snow, sparks, bubbles and confetti."
      textWrap="true"
    />
    <GridLayout ref="stage" class="particle-stage" height="210">
      <Label
        :text="label"
        color="#71717a"
        horizontalAlignment="center"
        verticalAlignment="middle"
      />
    </GridLayout>
    <GridLayout columns="*, *, *">
      <Button class="button" text="Snow" @tap="play('Snow')" />
      <Button col="1" class="button" text="Sparks" @tap="play('Sparks')" />
      <Button col="2" class="button" text="Bubbles" @tap="play('Bubbles')" />
    </GridLayout>
    <GridLayout columns="*, *">
      <Button ref="celebrate" class="button" text="Confetti" @tap="burst" />
      <Button col="1" class="button" text="Stop" @tap="stop" />
    </GridLayout>
  </StackLayout>
</template>

<style scoped>
.particle-stage {
  margin: 16 0;
  border-radius: 16;
  background-color: #18181b;
}
</style>
