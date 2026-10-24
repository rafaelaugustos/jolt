<script lang="ts" setup>
import { usePreviewI18n } from '../showcase/i18n'
import { isIOS } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { reveal, conceal, type Animation } from '@rafaelaugusto/jolt'
const { t } = usePreviewI18n()

const panel = ref()
const slow = ref(false)
const status = ref('Ready')
let current: Animation | undefined

async function play(opening: boolean) {
  const point = { x: 28, y: 28 }
  const duration = slow.value ? 1600 : 500
  const animation = opening
    ? reveal(panel.value, { from: point, duration })
    : conceal(panel.value, { to: point, duration })
  current = animation
  status.value = opening ? 'Revealing…' : 'Concealing…'
  const finished = await animation
  if (current === animation) {
    current = undefined
    status.value = finished ? (opening ? 'Visible' : 'Hidden') : 'Cancelled'
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
    <GridLayout class="ex-stage" padding="0"
      ><Label
        :text="t('There is more\nthan meets the eye.')"
        class="ex-title"
        textWrap="true"
        verticalAlignment="middle"
        textAlignment="center" /><GridLayout
        ref="panel"
        backgroundColor="#DDEBBE"
        borderRadius="28"
        padding="28"
        ><Label
          :text="t('A NEW PERSPECTIVE')"
          color="#62734D"
          fontSize="9"
          letterSpacing=".12"
          verticalAlignment="top" /><Label
          text="✦"
          fontSize="126"
          color="#395239"
          textAlignment="center"
          verticalAlignment="middle" /><Label
          :text="t('Hello, possibility.')"
          fontSize="27"
          fontWeight="bold"
          color="#2A3B29"
          verticalAlignment="bottom" /></GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*,*"
        ><Button
          col="0"
          :text="t('Reveal')"
          @tap="play(true)"
          class="ex-primary" /><Button
          col="1"
          :text="t('Conceal')"
          @tap="play(false)" /><Button
          col="2"
          :text="t('Stop')"
          @tap="stop" /></GridLayout
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="t(slow ? 'Duration: 1600 ms' : 'Duration: 500 ms')"
          @tap="slow = !slow" /></GridLayout></StackLayout
    ><Label :text="t(status)" class="ex-note" textWrap="true" />
  </StackLayout>
  <template v-else>
    <StackLayout v-if="isIOS" class="section">
      <Label class="heading" :text="t('Circular reveal')" />
      <Label
        class="muted"
        :text="t('Reveal, conceal, or reverse while the circle is moving.')"
        textWrap="true"
      />
      <GridLayout
        height="210"
        marginTop="16"
        marginBottom="12"
        backgroundColor="#18181b"
        borderRadius="18"
      >
        <StackLayout ref="panel" class="reveal-card">
          <Label :text="t('A little more detail')" fontSize="24" textWrap="true" />
          <Label
            :text="
              t(
                'The content appears from the top-left corner. Its original cut corner stays in place.',
              )
            "
            textWrap="true"
            marginTop="12"
          />
        </StackLayout>
      </GridLayout>
      <Label class="muted" :text="t(status)" />
      <GridLayout columns="*, *, *">
        <Button class="button" :text="t('Reveal')" @tap="play(true)" />
        <Button col="1" class="button" :text="t('Conceal')" @tap="play(false)" />
        <Button col="2" class="button" :text="t('Stop')" @tap="stop" />
      </GridLayout>
      <Button
        class="button"
        :text="t(slow ? 'Duration: 1600 ms' : 'Duration: 500 ms')"
        @tap="slow = !slow"
      />
    </StackLayout>
  </template>
</template>

<style scoped>
.reveal-card {
  clip-path: polygon(0% 0%, 100% 0%, 100% 80%, 85% 100%, 0% 100%);
  padding: 24;
  background-color: #dcf71d;
  color: #17230d;
}
</style>
