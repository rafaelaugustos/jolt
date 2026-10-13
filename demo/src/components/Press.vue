<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { press } from '@rafaelaugusto/jolt'

const plain = ref()
const dim = ref()
const tilt = ref()
let removers: (() => void)[] = []

onMounted(() => {
  removers = [
    press(plain.value),
    press(dim.value, { scale: 0.94, opacity: 0.6 }),
    press(tilt.value, { scale: 0.9, rotate: -4 }, 'bouncy'),
  ]
})

onUnmounted(() => removers.forEach((remove) => remove()))
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Press" />
    <Label
      class="muted"
      textWrap="true"
      text="press(card), press(card, { scale: 0.94, opacity: 0.6 })"
    />

    <GridLayout columns="*, *, *" class="tiles">
      <Label ref="plain" class="tile" text="press()" />
      <Label ref="dim" col="1" class="tile" text="dim" />
      <Label ref="tilt" col="2" class="tile" text="tilt" />
    </GridLayout>
  </StackLayout>
</template>
