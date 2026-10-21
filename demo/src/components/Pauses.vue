<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { animate, set, type Animation } from '@rafaelaugusto/jolt'

const sleep = [ref(), ref(), ref()]
const pill = ref()
const running = ref(false)
let playing: Animation[] = []

function toggle() {
  if (running.value) {
    playing.forEach((animation) => animation.stop())
    playing = []
    sleep.forEach((z) => set(z.value, { y: 0, opacity: 0 }))
    set(pill.value, { x: 0 })
  } else {
    playing = [
      ...sleep.map((z, i) =>
        animate(
          z.value,
          { y: [0, -56], opacity: [0, 1, 0] },
          { duration: 1200, delay: i * 260, repeat: Infinity, repeatDelay: 900 },
        ),
      ),
      animate(
        pill.value,
        { x: [0, 84] },
        {
          duration: 450,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatType: 'reverse',
          repeatDelay: 700,
        },
      ),
    ]
  }
  running.value = !running.value
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Pauses" />
    <Label class="muted" textWrap="true" text="{ repeat: Infinity, repeatDelay: 900 }" />

    <GridLayout columns="*, *" class="stage" height="140">
      <GridLayout paddingLeft="28">
        <Label
          v-for="(z, i) in sleep"
          :key="i"
          :ref="z"
          class="sleep"
          text="z"
          opacity="0"
          :marginLeft="i * 18"
        />
      </GridLayout>
      <GridLayout col="1" class="lane pause-lane" height="48">
        <Label
          ref="pill"
          class="ball"
          width="40"
          height="40"
          horizontalAlignment="left"
        />
      </GridLayout>
    </GridLayout>

    <Label
      class="note"
      textWrap="true"
      text="Each z rests 900 ms between floats. The pill waits 700 ms at both ends."
    />
    <Button
      class="button"
      :text="running ? 'Stop pauses' : 'Play pauses'"
      @tap="toggle"
    />
  </StackLayout>
</template>
