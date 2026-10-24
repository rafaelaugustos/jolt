<script lang="ts" setup>
import { onUnmounted, ref } from 'nativescript-vue'
import { animateText, type Animation } from '@rafaelaugusto/jolt'
const title = ref()
const slow = ref(false)
const status = ref('One label, one accessible title')
let current: Animation | undefined
async function play(by: 'letter' | 'word') {
  const animation = animateText(title.value, {
    by,
    duration: slow.value ? 1000 : 400,
    stagger: by === 'word' ? 100 : 35,
  })
  current = animation
  status.value = by === 'word' ? 'Word by word…' : 'Letter by letter…'
  const finished = await animation
  if (current === animation) {
    current = undefined
    status.value = finished ? 'Ready' : 'Stopped — full text restored'
  }
}
function stop() {
  current?.stop()
}
onUnmounted(stop)
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        text="WORDS WITH A LITTLE WEIGHT"
        class="ex-kicker"
        verticalAlignment="top" /><Label
        ref="title"
        text="Move a little.&#10;Say a lot."
        fontSize="45"
        fontWeight="bold"
        textWrap="true"
        color="#E3FC62"
        letterSpacing="-.04"
        verticalAlignment="middle"
        accessible="true" /><GridLayout columns="*,auto" verticalAlignment="bottom"
        ><Label text="TYPE IN MOTION" class="ex-kicker" /><Label
          col="1"
          text="Aa"
          fontSize="28"
          color="#91A782" /></GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*,*"
        ><Button col="0" text="Letters" @tap="play('letter')" class="ex-primary" /><Button
          col="1"
          text="Words"
          @tap="play('word')" /><Button col="2" text="Stop" @tap="stop" /></GridLayout
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="slow ? 'Duration: 1000 ms' : 'Duration: 400 ms'"
          @tap="slow = !slow" /></GridLayout></StackLayout
    ><Label :text="status" class="ex-note" textWrap="true" />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" text="Text" />
      <Label
        class="muted"
        text="The whole title keeps its layout. Only the letters move."
        textWrap="true"
      />
      <Label
        ref="title"
        accessible="true"
        :text="'Move a little.\nSay a lot.'"
        height="150"
        padding="16"
        marginTop="16"
        fontSize="32"
        fontWeight="bold"
        textWrap="true"
        textAlignment="center"
        backgroundColor="#27272a"
        color="#facc15"
        borderRadius="16"
      />
      <Label class="muted" :text="status" marginTop="12" />
      <GridLayout columns="*, *, *">
        <Button class="button" text="Letters" @tap="play('letter')" />
        <Button col="1" class="button" text="Words" @tap="play('word')" />
        <Button col="2" class="button" text="Stop" @tap="stop" />
      </GridLayout>
      <Button
        class="button"
        :text="slow ? 'Duration: 1000 ms' : 'Duration: 400 ms'"
        @tap="slow = !slow"
      />
    </StackLayout>
  </template>
</template>
