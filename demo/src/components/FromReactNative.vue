<script lang="ts" setup>
import type { View } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import { animate, origamiSpring, type OrigamiSpring } from '@rafaelaugusto/jolt'

const BALL = 40

const configs: { label: string; config: OrigamiSpring }[] = [
  { label: 'friction 7 · tension 40', config: { friction: 7, tension: 40 } },
  { label: 'friction 3 · tension 40', config: { friction: 3, tension: 40 } },
  { label: 'friction 12 · tension 80', config: { friction: 12, tension: 80 } },
]
const lanes: { nativeView: View }[] = []
const balls: { nativeView: View }[] = []
const right = ref(false)

function toss() {
  right.value = !right.value
  configs.forEach(({ config }, i) => {
    const width = lanes[i]!.nativeView.getActualSize().width
    animate(balls[i]!, { x: right.value ? width - BALL - 8 : 0 }, origamiSpring(config))
  })
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="From React Native" />
    <Label class="muted" textWrap="true" text="origamiSpring({ friction, tension })" />

    <StackLayout v-for="({ label }, i) in configs" :key="label">
      <Label class="caption rn-caption" :text="label" />
      <GridLayout
        :ref="(el) => (lanes[i] = el as never)"
        class="lane rn-lane"
        height="48"
      >
        <Label
          :ref="(el) => (balls[i] = el as never)"
          class="ball"
          :width="BALL"
          :height="BALL"
          horizontalAlignment="left"
        />
      </GridLayout>
    </StackLayout>

    <Label
      class="note"
      textWrap="true"
      text="The springs Animated.spring plays for friction and tension, converted with the same Origami formulas."
    />
    <Button class="button" text="Toss springs" @tap="toss" />
  </StackLayout>
</template>
