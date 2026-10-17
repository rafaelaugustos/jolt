<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { configure, sequence } from '@rafaelaugusto/jolt'

const card = ref()
const speeds = [
  { label: '1×', value: 1 },
  { label: '½×', value: 0.5 },
  { label: '⅕×', value: 0.2 },
]
const speed = ref(1)

function setSpeed(value: number) {
  speed.value = value
  configure({ timeScale: value })
}

function play() {
  sequence([
    [card.value, 'popIn'],
    [card.value, 'shake', { at: '+100' }],
  ])
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Tuning" />
    <Label class="muted" textWrap="true" text="configure({ timeScale: 0.2 })" />
    <Label
      class="muted"
      textWrap="true"
      text="Applies to every section below. Tap the card to compare."
    />

    <GridLayout class="stage" height="160">
      <GridLayout ref="card" class="card" width="110" height="110" @tap="play">
        <Label class="card-label" text="tap" />
      </GridLayout>
    </GridLayout>

    <WrapLayout>
      <Label
        v-for="option in speeds"
        :key="option.value"
        class="chip"
        :class="{ active: option.value === speed }"
        :text="option.label"
        @tap="setSpeed(option.value)"
      />
    </WrapLayout>
  </StackLayout>
</template>
