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
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        text="SAME STEPS. DIFFERENT FEELING."
        class="ex-kicker"
        verticalAlignment="top" /><GridLayout
        columns="*,*"
        rows="*,auto"
        height="240"
        verticalAlignment="bottom"
        ><GridLayout width="1" height="180" backgroundColor="#43543F" /><GridLayout
          col="1"
          width="1"
          height="180"
          backgroundColor="#43543F" /><Label
          ref="each"
          width="56"
          height="56"
          borderRadius="28"
          backgroundColor="#E3FC62"
          verticalAlignment="bottom"
          marginBottom="24" /><Label
          ref="whole"
          col="1"
          width="56"
          height="56"
          borderRadius="28"
          backgroundColor="#C4B2ED"
          verticalAlignment="bottom"
          marginBottom="24" /><Label
          row="1"
          text="EACH SEGMENT"
          class="ex-kicker"
          textAlignment="center" /><Label
          row="1"
          col="1"
          text="WHOLE TRACK"
          class="ex-kicker"
          textAlignment="center" /></GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          text="Bounce"
          @tap="play"
          class="ex-primary" /></GridLayout></StackLayout
    ><Label
      text="Watch how the same bounce changes when easing spans the whole track."
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
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
</template>
