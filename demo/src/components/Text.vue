<script lang="ts" setup>
import { isIOS } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { animateText, type Animation } from '@rafaelaugusto/jolt'
const title = ref()
const slow = ref(false)
const status = ref('One label, one accessible title')
let current: Animation | undefined
async function play(by: 'letter' | 'word') {
  const animation = animateText(title.value, {
    by,
    duration: slow.value ? 1000 : 400,
    stagger: by === 'word' ? 100 : 35,
  })
  current = animation
  status.value = by === 'word' ? 'Word by word…' : 'Letter by letter…'
  const finished = await animation
  if (current === animation) {
    current = undefined
    status.value = finished ? 'Ready' : 'Stopped — full text restored'
  }
}
function stop() {
  current?.stop()
}
onUnmounted(stop)
</script>

<template>
  <StackLayout v-if="isIOS" class="section">
    <Label class="heading" text="Text" />
    <Label
      class="muted"
      text="The whole title keeps its layout. Only the letters move."
      textWrap="true"
    />
    <Label
      ref="title"
      accessible="true"
      :text="'Move a little.\nSay a lot.'"
      height="150"
      padding="16"
      marginTop="16"
      fontSize="32"
      fontWeight="bold"
      textWrap="true"
      textAlignment="center"
      backgroundColor="#27272a"
      borderRadius="16"
    />
    <Label class="muted" :text="status" marginTop="12" />
    <GridLayout columns="*, *, *">
      <Button class="button" text="Letters" @tap="play('letter')" />
      <Button col="1" class="button" text="Words" @tap="play('word')" />
      <Button col="2" class="button" text="Stop" @tap="stop" />
    </GridLayout>
    <Button
      class="button"
      :text="slow ? 'Duration: 1000 ms' : 'Duration: 400 ms'"
      @tap="slow = !slow"
    />
  </StackLayout>
</template>
