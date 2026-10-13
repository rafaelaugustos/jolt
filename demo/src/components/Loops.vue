<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { animate, type Animation } from '@rafaelaugusto/jolt'

const spinner = ref()
const heart = ref()
const running = ref(false)
let playing: Animation[] = []

function toggle() {
  if (running.value) {
    playing.forEach((animation) => animation.stop())
    playing = []
  } else {
    playing = [
      animate(spinner.value, 'spin', { repeat: Infinity }),
      animate(heart.value, 'heartbeat', { repeat: Infinity }),
    ]
  }
  running.value = !running.value
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Loops" />
    <Label
      class="muted"
      textWrap="true"
      text="animate(spinner, 'spin', { repeat: Infinity })"
    />

    <GridLayout columns="*, *" class="stage" height="120">
      <GridLayout ref="spinner" class="spinner">
        <Label class="spinner-dot" />
      </GridLayout>
      <Label ref="heart" col="1" class="heart" text="♥" />
    </GridLayout>

    <Button class="button" :text="running ? 'Stop' : 'Play'" @tap="toggle" />
  </StackLayout>
</template>
