<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { animate } from '@rafaelaugusto/jolt'

const each = ref()
const whole = ref()
const keyframes = { y: [0, -80, -32, 0] }
const timing = { duration: 1400, ease: 'easeOut', times: [0, 0.4, 0.7, 1] } as const

function play() {
  animate(each.value, keyframes, timing)
  animate(whole.value, keyframes, { ...timing, easeTrack: true })
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Track easing" />
    <Label
      class="muted"
      textWrap="true"
      text="{ ease: 'easeOut', easeTrack: true, times: [0, 0.4, 0.7, 1] }"
    />

    <GridLayout columns="*, *" rows="*, auto" class="stage" height="170">
      <Label
        ref="each"
        class="ball"
        width="40"
        height="40"
        verticalAlignment="bottom"
        marginBottom="8"
      />
      <Label
        ref="whole"
        col="1"
        class="ball"
        width="40"
        height="40"
        verticalAlignment="bottom"
        marginBottom="8"
      />
      <Label row="1" class="caption" text="Each segment" />
      <Label row="1" col="1" class="caption" text="Whole track" />
    </GridLayout>

    <Label
      class="note"
      textWrap="true"
      text="Same keyframes and times. On the right, one easeOut runs over the whole bounce, like React Native's interpolate."
    />
    <Button class="button" text="Bounce" @tap="play" />
  </StackLayout>
</template>
