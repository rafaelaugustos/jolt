<script setup lang="ts">
import { onMounted, ref } from 'nativescript-vue'
import type { PlaybackAnimation, RepeatDelayRange, Target } from '@rafaelaugusto/jolt'
import { useMotionScope } from '@rafaelaugusto/jolt/vue'

const scope = useMotionScope()
const fixed = ref()
const drawn = ref()
const running = ref(false)
let loops: PlaybackAnimation[] = []

function idle(
  eyes: Target,
  blink: number | RepeatDelayRange,
  glance: number | RepeatDelayRange,
) {
  return [
    scope.animate(
      eyes,
      { scaleY: [1, 0.1, 1] },
      { duration: 160, ease: 'easeInOut', repeat: Infinity, repeatDelay: blink },
    ),
    scope.animate(
      eyes,
      { x: [0, 10, 10, 0] },
      { duration: 900, times: [0, 0.2, 0.8, 1], repeat: Infinity, repeatDelay: glance },
    ),
  ]
}

function toggle() {
  running.value = !running.value
  if (!running.value) {
    loops.forEach((loop) => loop.stop())
    loops = []
    return
  }
  loops = [
    ...idle(fixed.value, 2500, 3500),
    ...idle(drawn.value, [1000, 4000], [2000, 6000]),
  ]
}

onMounted(toggle)
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        text="A LITTLE MORE HUMAN"
        class="ex-kicker"
        verticalAlignment="top" /><Label
        text="Meet the&#10;daydreamers."
        class="ex-title"
        textWrap="true"
        verticalAlignment="top"
        marginTop="30" /><GridLayout
        columns="*,*"
        rows="*,auto"
        height="130"
        verticalAlignment="bottom"
        ><GridLayout width="108" height="92" borderRadius="36" backgroundColor="#E3FC62"
          ><StackLayout
            ref="fixed"
            orientation="horizontal"
            horizontalAlignment="center"
            verticalAlignment="middle"
            ><Label
              width="12"
              height="22"
              borderRadius="6"
              backgroundColor="#26372B"
              margin="0 8" /><Label
              width="12"
              height="22"
              borderRadius="6"
              backgroundColor="#26372B"
              margin="0 8" /></StackLayout></GridLayout
        ><GridLayout
          col="1"
          width="108"
          height="92"
          borderRadius="36"
          backgroundColor="#C2B1E7"
          ><StackLayout
            ref="drawn"
            orientation="horizontal"
            horizontalAlignment="center"
            verticalAlignment="middle"
            ><Label
              width="12"
              height="22"
              borderRadius="6"
              backgroundColor="#352C49"
              margin="0 8" /><Label
              width="12"
              height="22"
              borderRadius="6"
              backgroundColor="#352C49"
              margin="0 8" /></StackLayout></GridLayout
        ><Label
          row="1"
          text="THE PLANNER"
          class="ex-kicker"
          textAlignment="center"
          marginTop="12" /><Label
          row="1"
          col="1"
          text="THE DREAMER"
          class="ex-kicker"
          textAlignment="center"
          marginTop="12" /></GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="running ? 'Stop idling' : 'Start idling'"
          @tap="toggle"
          class="ex-primary" /></GridLayout></StackLayout
    ><Label
      text="One blinks on schedule. The other takes its time."
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" text="Random pauses" />
      <Label
        class="muted"
        textWrap="true"
        text="{ repeat: Infinity, repeatDelay: [1000, 4000] }"
      />

      <GridLayout columns="*, *" rows="*, auto" class="stage" height="190">
        <GridLayout class="mascot" width="96" height="96">
          <StackLayout ref="fixed" orientation="horizontal" class="mascot-eyes">
            <Label class="mascot-eye" />
            <Label class="mascot-eye" />
          </StackLayout>
        </GridLayout>
        <GridLayout col="1" class="mascot" width="96" height="96">
          <StackLayout ref="drawn" orientation="horizontal" class="mascot-eyes">
            <Label class="mascot-eye" />
            <Label class="mascot-eye" />
          </StackLayout>
        </GridLayout>
        <Label row="1" class="caption" text="repeatDelay: 2500" />
        <Label row="1" col="1" class="caption" text="repeatDelay: [1000, 4000]" />
      </GridLayout>

      <Label
        class="note"
        textWrap="true"
        text="Left: the same pause before every blink and glance. Right: a new pause drawn for each repeat, still one native loop."
      />
      <Button
        class="button"
        :text="running ? 'Stop idling' : 'Start idling'"
        @tap="toggle"
      />
    </StackLayout>
  </template>
</template>
