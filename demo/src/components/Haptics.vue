<script lang="ts" setup>
import { isIOS } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { animate, type Animation, type HapticStyle } from '@rafaelaugusto/jolt'

const lane = ref()
const ball = ref()
const bouncing = ref()
const right = ref(false)
const styles: HapticStyle[] = ['light', 'medium', 'heavy']
let spring: Animation | undefined
let bounce: Animation | undefined

function toss(haptic: HapticStyle) {
  right.value = !right.value
  const width = lane.value.nativeView.getActualSize().width
  spring = animate(
    ball.value,
    { x: right.value ? width - 48 : 0 },
    {
      type: 'spring',
      duration: 550,
      bounce: 0.3,
      haptic,
    },
  )
}

function jump() {
  bounce?.stop()
  bouncing.value.nativeView.translateY = 0
  bounce = animate(bouncing.value, 'bounce', {
    haptic: { style: 'light', times: [0.6, 1] },
  })
}

function cancel() {
  spring?.stop()
  bounce?.stop()
}

onUnmounted(cancel)
</script>

<template>
  <StackLayout v-if="isIOS" class="section">
    <Label class="heading" text="Haptics" />
    <Label
      class="muted"
      textWrap="true"
      text="Feel the spring arrive on an iPhone. Tap again to interrupt it; only the new arrival gets feedback."
    />
    <GridLayout ref="lane" class="lane" height="56">
      <Label ref="ball" class="ball" width="48" height="48" horizontalAlignment="left" />
    </GridLayout>
    <GridLayout columns="*, *, *">
      <Button
        v-for="(style, index) in styles"
        :key="style"
        :col="index"
        class="button"
        :text="style"
        @tap="toss(style)"
      />
    </GridLayout>
    <Label class="muted" text="Two bounces, two light taps." />
    <GridLayout class="lane" height="80">
      <Label
        ref="bouncing"
        class="ball"
        width="48"
        height="48"
        verticalAlignment="bottom"
      />
    </GridLayout>
    <GridLayout columns="*, *">
      <Button class="button" text="Bounce" @tap="jump" />
      <Button col="1" class="button" text="Stop" @tap="cancel" />
    </GridLayout>
  </StackLayout>
</template>
