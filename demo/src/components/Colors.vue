<script lang="ts" setup>
import { onUnmounted, ref } from 'nativescript-vue'
import { animate, stop, type Animation } from '@rafaelaugusto/jolt'

const card = ref()
const status = ref('Tap a palette. Try another before it finishes.')
const palettes = [
  { backgroundColor: '#263b27', borderColor: '#b6ee64', color: '#d5ff91' },
  { backgroundColor: '#38273f', borderColor: '#e5a1ff', color: '#f4caff' },
  { backgroundColor: '#21394a', borderColor: '#85d7ff', color: '#bdeaff' },
]
let current: Animation | undefined

async function palette(index: number) {
  const animation = animate(card.value, palettes[index]!, {
    duration: 1600,
    ease: 'easeInOut',
  })
  current = animation
  status.value = 'Changing colors…'
  const finished = await animation
  if (current === animation) {
    current = undefined
    status.value = finished ? 'Ready — pick another palette' : 'Stopped at this color'
  }
}

function freeze() {
  stop(card.value, ['backgroundColor', 'borderColor', 'color'])
}
onUnmounted(() => current?.stop())
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Colors" />
    <Label
      class="muted"
      text="Background, border and text. One native animation."
      textWrap="true"
    />
    <Label
      ref="card"
      :text="'A little change\ngoes a long way.'"
      textWrap="true"
      textAlignment="center"
      height="160"
      marginTop="16"
      padding="20"
      fontSize="28"
      fontWeight="bold"
      backgroundColor="#263b27"
      borderColor="#b6ee64"
      color="#d5ff91"
      borderWidth="3"
      borderRadius="24"
    />
    <GridLayout columns="*, *, *">
      <Button class="button" text="Moss" @tap="palette(0)" />
      <Button col="1" class="button" text="Orchid" @tap="palette(1)" />
      <Button col="2" class="button" text="Sky" @tap="palette(2)" />
    </GridLayout>
    <Button class="button" text="Stop here" @tap="freeze" />
    <Label class="muted" :text="status" textWrap="true" />
  </StackLayout>
</template>
