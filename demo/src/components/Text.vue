<script lang="ts" setup>
import { usePreviewI18n } from '../showcase/i18n'
import { onUnmounted, ref } from 'nativescript-vue'
import { animateText, type Animation } from '@rafaelaugusto/jolt'
const { t } = usePreviewI18n()
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
        :text="t('WORDS WITH A LITTLE WEIGHT')"
        class="ex-kicker"
        verticalAlignment="top" /><Label
        ref="title"
        :text="t('Move a little.\nSay a lot.')"
        fontSize="45"
        fontWeight="bold"
        textWrap="true"
        color="#E3FC62"
        letterSpacing="-.04"
        verticalAlignment="middle"
        accessible="true" /><GridLayout columns="*,auto" verticalAlignment="bottom"
        ><Label :text="t('TYPE IN MOTION')" class="ex-kicker" /><Label
          col="1"
          :text="t('Aa')"
          fontSize="28"
          color="#91A782" /></GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*,*"
        ><Button
          col="0"
          :text="t('Letters')"
          @tap="play('letter')"
          class="ex-primary" /><Button
          col="1"
          :text="t('Words')"
          @tap="play('word')" /><Button
          col="2"
          :text="t('Stop')"
          @tap="stop" /></GridLayout
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="t(slow ? 'Duration: 1000 ms' : 'Duration: 400 ms')"
          @tap="slow = !slow" /></GridLayout></StackLayout
    ><Label :text="t(status)" class="ex-note" textWrap="true" />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Text')" />
      <Label
        class="muted"
        :text="t('The whole title keeps its layout. Only the letters move.')"
        textWrap="true"
      />
      <Label
        ref="title"
        accessible="true"
        :text="t('Move a little.\nSay a lot.')"
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
      <Label class="muted" :text="t(status)" marginTop="12" />
      <GridLayout columns="*, *, *">
        <Button class="button" :text="t('Letters')" @tap="play('letter')" />
        <Button col="1" class="button" :text="t('Words')" @tap="play('word')" />
        <Button col="2" class="button" :text="t('Stop')" @tap="stop" />
      </GridLayout>
      <Button
        class="button"
        :text="t(slow ? 'Duration: 1000 ms' : 'Duration: 400 ms')"
        @tap="slow = !slow"
      />
    </StackLayout>
  </template>
</template>
