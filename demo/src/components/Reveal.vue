<script lang="ts" setup>
import { isIOS } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { reveal, conceal, type Animation } from '@rafaelaugusto/jolt'

const panel = ref()
const slow = ref(false)
const status = ref('Ready')
let current: Animation | undefined

async function play(opening: boolean) {
  const point = { x: 28, y: 28 }
  const duration = slow.value ? 1600 : 500
  const animation = opening
    ? reveal(panel.value, { from: point, duration })
    : conceal(panel.value, { to: point, duration })
  current = animation
  status.value = opening ? 'Revealing…' : 'Concealing…'
  const finished = await animation
  if (current === animation) {
    current = undefined
    status.value = finished ? (opening ? 'Visible' : 'Hidden') : 'Cancelled'
  }
}
function stop() {
  current?.stop()
}
onUnmounted(stop)
</script>

<template>
  <StackLayout v-if="isIOS" class="section">
    <Label class="heading" text="Circular reveal" />
    <Label
      class="muted"
      text="Reveal, conceal, or reverse while the circle is moving."
      textWrap="true"
    />
    <GridLayout
      height="210"
      marginTop="16"
      marginBottom="12"
      backgroundColor="#18181b"
      borderRadius="18"
    >
      <StackLayout ref="panel" class="reveal-card">
        <Label text="A little more detail" fontSize="24" textWrap="true" />
        <Label
          text="The content appears from the top-left corner. Its original cut corner stays in place."
          textWrap="true"
          marginTop="12"
        />
      </StackLayout>
    </GridLayout>
    <Label class="muted" :text="status" />
    <GridLayout columns="*, *, *">
      <Button class="button" text="Reveal" @tap="play(true)" />
      <Button col="1" class="button" text="Conceal" @tap="play(false)" />
      <Button col="2" class="button" text="Stop" @tap="stop" />
    </GridLayout>
    <Button
      class="button"
      :text="slow ? 'Duration: 1600 ms' : 'Duration: 500 ms'"
      @tap="slow = !slow"
    />
  </StackLayout>
</template>

<style scoped>
.reveal-card {
  clip-path: polygon(0% 0%, 100% 0%, 100% 80%, 85% 100%, 0% 100%);
  padding: 24;
  background-color: #dcf71d;
  color: #17230d;
}
</style>
