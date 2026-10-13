<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { animate, type SpringName } from '@rafaelaugusto/jolt'

const BALL = 48

const lane = ref()
const ball = ref()
const right = ref(false)
const springNames: SpringName[] = ['smooth', 'snappy', 'bouncy']

function toss(spring: SpringName) {
  right.value = !right.value
  const width = lane.value.nativeView.getActualSize().width
  animate(ball.value, { x: right.value ? width - BALL : 0 }, spring)
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Springs" />
    <Label
      class="muted"
      textWrap="true"
      text="Tap again while the ball is moving: it turns around without losing its speed."
    />

    <GridLayout ref="lane" class="lane" height="56">
      <Label
        ref="ball"
        class="ball"
        :width="BALL"
        :height="BALL"
        horizontalAlignment="left"
      />
    </GridLayout>

    <GridLayout columns="*, *, *">
      <Button
        v-for="(spring, index) in springNames"
        :key="spring"
        :col="index"
        class="button"
        :text="spring"
        @tap="toss(spring)"
      />
    </GridLayout>
  </StackLayout>
</template>
