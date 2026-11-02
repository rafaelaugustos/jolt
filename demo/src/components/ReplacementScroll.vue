<script setup lang="ts">
import { Label, isIOS, Utils, type GridLayout } from '@nativescript/core'
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { motionStates, scrollValue, bind, type MotionStates } from '@rafaelaugusto/jolt'
import { usePreviewI18n } from '../showcase/i18n'
const { t } = usePreviewI18n()
const host = ref(),
  track = ref(),
  indicator = ref()
const status = ref('Ready'),
  generation = ref(1)
let control: MotionStates<'working' | 'rest', 'card'> | undefined
let offset: ReturnType<typeof scrollValue> | undefined, unlink: (() => void) | undefined
let card: Label | undefined
function replace() {
  if (!control) return
  const container = host.value.nativeView as GridLayout
  control.attach('card', null)
  if (card) container.removeChild(card)
  card = new Label()
  card.text = `CARD ${++generation.value}`
  card.width = 110
  card.height = 70
  card.backgroundColor = '#B6EE64'
  card.color = '#173628'
  card.textAlignment = 'center'
  card.verticalAlignment = 'middle'
  card.horizontalAlignment = 'left'
  card.borderRadius = 12
  card.accessibilityLabel = 'replacement-card'
  container.addChild(card)
  control.attach('card', card)
  status.value = control.paused ? 'Replaced while paused' : 'Replaced'
}
function run() {
  status.value = 'Moving'
  void control!.to('working').finished.then((done) => {
    if (done) status.value = 'Replacement settled'
  })
}
function pause() {
  control?.pause()
  status.value = 'Paused'
}
function resume() {
  control?.play()
  status.value = 'Resumed'
}
function reset() {
  control?.play()
  void control?.to('rest')
  status.value = 'Ready'
}
function check() {
  if (!card || !control) return
  const presentation = isIOS ? (card.ios as UIView).layer.presentationLayer() : undefined
  const x = isIOS
    ? presentation?.transform.m41
    : Utils.layout.toDeviceIndependentPixels(card.android.getTranslationX())
  const y = isIOS
    ? presentation?.transform.m42
    : Utils.layout.toDeviceIndependentPixels(card.android.getTranslationY())
  const paused = control.paused
  const passed =
    x !== undefined &&
    y !== undefined &&
    (paused
      ? Math.abs(x) < 1 && Math.abs(y) < 1
      : Math.abs(x - 180) < 1 && Math.abs(y + 14) < 1 && control.settled === 'working')
  status.value = passed
    ? paused
      ? 'Paused verified'
      : 'Resume verified'
    : 'Check failed'
  console.log(
    'JOLT_REPLACEMENT ' +
      JSON.stringify({ passed, paused, x, y, settled: control.settled }),
  )
}
onMounted(() => {
  control = motionStates(
    { card: null },
    { working: { card: { x: 180, y: -14 } }, rest: { card: { x: 0, y: 0 } } },
    { transition: { duration: 3000, ease: 'linear' } },
  )
  replace()
  status.value = 'Ready'
  offset = scrollValue(track.value, { axis: 'x' })
  unlink = bind(indicator.value, { scaleX: offset.to([0, 600], [0.04, 1]) })
})
onUnmounted(() => {
  control?.dispose()
  unlink?.()
  offset?.dispose()
})
</script>
<template>
  <StackLayout class="section">
    <Label class="heading" :text="t('Replacement and horizontal scroll')" />
    <Label
      class="muted"
      :text="t('Pause, replace the native view, then resume.')"
      textWrap="true"
    />
    <GridLayout
      ref="host"
      height="150"
      backgroundColor="#20372E"
      borderRadius="18"
      padding="12"
    />
    <Label :text="t(status)" class="note" />
    <GridLayout columns="*,*,*"
      ><Button text="Start motion" @tap="run" /><Button
        col="1"
        text="Pause motion"
        @tap="pause" /><Button col="2" text="Replace view" @tap="replace"
    /></GridLayout>
    <GridLayout columns="*,*,*"
      ><Button text="Resume motion" @tap="resume" /><Button
        col="1"
        text="Check state"
        @tap="check" /><Button col="2" text="Reset motion" @tap="reset"
    /></GridLayout>
    <Label class="heading" :text="t('Horizontal scroll')" marginTop="20" />
    <ScrollView
      ref="track"
      orientation="horizontal"
      height="110"
      accessibilityLabel="horizontal-track"
    >
      <StackLayout orientation="horizontal">
        <GridLayout
          v-for="n in 6"
          :key="n"
          width="160"
          height="100"
          marginRight="8"
          backgroundColor="#244638"
          borderRadius="16"
          ><Label
            :text="`CHAPTER ${n}`"
            color="#CBEB9F"
            textAlignment="center"
            verticalAlignment="middle"
        /></GridLayout>
      </StackLayout>
    </ScrollView>
    <GridLayout height="8" backgroundColor="#D8E1D7" marginTop="12"
      ><Label ref="indicator" originX="0" backgroundColor="#498247"
    /></GridLayout>
    <Label
      class="note"
      :text="
        t(
          'The progress bar follows the horizontal scroll offset. Translate, then return.',
        )
      "
      textWrap="true"
    />
  </StackLayout>
</template>
