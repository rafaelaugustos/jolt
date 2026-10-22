<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import type { View } from '@nativescript/core'
import { animate, type EasingName } from '@rafaelaugusto/jolt'

const curves: EasingName[] = [
  'quadOut',
  'cubicOut',
  'quartOut',
  'quintOut',
  'sineOut',
  'expoOut',
]
const dots: { nativeView: View }[] = []
const dot = (i: number) => (el: unknown) => {
  if (el) dots[i] = el as { nativeView: View }
}
const logo = ref()
let across = false

function play() {
  across = !across
  for (const [i, ball] of dots.entries()) {
    const travel = (ball.nativeView.parent as View).getActualSize().width - 20
    animate(ball, { x: across ? travel : 0 }, { duration: 900, ease: curves[i] })
  }
  animate(
    logo.value,
    { scale: [0.6, 1.08, 1], opacity: [0, 1, 1] },
    { duration: 900, ease: 'easeInOut', opacity: { times: [0, 0.3, 1] } },
  )
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Easing curves" />
    <Label class="muted" textWrap="true" text="ease: 'cubicOut' · opacity: { times }" />

    <GridLayout columns="*, auto" class="stage" padding="12 16">
      <StackLayout>
        <GridLayout v-for="(name, i) in curves" :key="name" columns="76, *" height="30">
          <Label :text="name" class="easing-name" />
          <GridLayout col="1">
            <Label class="easing-rail" />
            <Label
              :ref="dot(i)"
              class="ball"
              width="20"
              height="20"
              horizontalAlignment="left"
            />
          </GridLayout>
        </GridLayout>
      </StackLayout>
      <Label ref="logo" col="1" class="logo" text="J" marginLeft="16" />
    </GridLayout>

    <Label
      class="note"
      textWrap="true"
      text="Six named curves over 900 ms. The J's opacity only sets times, so it keeps the 900 ms easeInOut and is fully visible by 30%."
    />
    <Button class="button" text="Play curves" @tap="play" />
  </StackLayout>
</template>
