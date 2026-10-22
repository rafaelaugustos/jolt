<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import type { GradientValue } from '@rafaelaugusto/jolt/vue'

const moods = [
  { name: 'Sunset', colors: ['#FF5F6D', '#FFC371'], angle: 135 },
  { name: 'Ocean', colors: ['#22D3EE', '#6366F1'], angle: 200 },
  { name: 'Forest', colors: ['#A3E635', '#065F46'], angle: 300 },
]
const index = ref(0)
const mood = computed(() => moods[index.value]!)
const value = computed<GradientValue>(() => [
  { type: 'linear', colors: mood.value.colors, angle: mood.value.angle },
  { duration: 700, ease: 'easeInOut' },
])

function next() {
  index.value = (index.value + 1) % moods.length
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Gradient directive" />
    <Label
      class="muted"
      textWrap="true"
      text="v-gradient=&quot;[{ type: 'linear', colors, angle }, { duration: 700 }]&quot;"
    />

    <GridLayout v-gradient="value" class="gradient-banner" height="120">
      <Label class="gradient-banner-label" :text="mood.name" />
    </GridLayout>

    <Label
      class="note"
      textWrap="true"
      text="The directive paints the gradient on mount, animates to the new colors and angle when the value changes, and removes it on unmount."
    />
    <Button class="button" text="Next mood" @tap="next" />
  </StackLayout>
</template>
