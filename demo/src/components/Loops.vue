<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { animate, type Animation } from '@rafaelaugusto/jolt'

const spinner = ref()
const heart = ref()
const running = ref(false)
let playing: Animation[] = []

function toggle() {
  if (running.value) {
    playing.forEach((animation) => animation.stop())
    playing = []
  } else {
    playing = [
      animate(spinner.value, 'spin', { repeat: Infinity }),
      animate(heart.value, 'heartbeat', { repeat: Infinity }),
    ]
  }
  running.value = !running.value
}
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        text="THE RHYTHM SECTION"
        class="ex-kicker"
        verticalAlignment="top" /><GridLayout columns="*,*" verticalAlignment="middle"
        ><GridLayout
          ref="spinner"
          width="104"
          height="104"
          borderRadius="52"
          borderWidth="1"
          borderColor="#5C7352"
          ><Label
            width="22"
            height="22"
            borderRadius="11"
            backgroundColor="#E3FC62"
            horizontalAlignment="center"
            verticalAlignment="top"
            marginTop="0" /><GridLayout
            width="64"
            height="64"
            borderRadius="32"
            borderWidth="1"
            borderColor="#455B40" /></GridLayout
        ><Label
          ref="heart"
          col="1"
          text="♥"
          fontSize="88"
          color="#EBAA99"
          textAlignment="center" /></GridLayout
      ><GridLayout columns="*,*" verticalAlignment="bottom"
        ><Label text="ROUND &amp; ROUND" class="ex-kicker" textAlignment="center" /><Label
          col="1"
          text="BEAT BY BEAT"
          class="ex-kicker"
          textAlignment="center" /></GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="running ? 'Stop' : 'Play'"
          @tap="toggle"
          class="ex-primary" /></GridLayout></StackLayout
    ><Label text="Two rhythms. No finish line." class="ex-note" textWrap="true" />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" text="Loops" />
      <Label
        class="muted"
        textWrap="true"
        text="animate(spinner, 'spin', { repeat: Infinity })"
      />

      <GridLayout columns="*, *" class="stage" height="120">
        <GridLayout ref="spinner" class="spinner">
          <Label class="spinner-dot" />
        </GridLayout>
        <Label ref="heart" col="1" class="heart" text="♥" />
      </GridLayout>

      <Button class="button" :text="running ? 'Stop' : 'Play'" @tap="toggle" />
    </StackLayout>
  </template>
</template>
