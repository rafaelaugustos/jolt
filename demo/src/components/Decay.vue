<script lang="ts" setup>
import { usePreviewI18n } from '../showcase/i18n'
import { onUnmounted, ref } from 'nativescript-vue'
import { animate, decay, stop, type Animation } from '@rafaelaugusto/jolt'
const { t } = usePreviewI18n()

const BALL = 48
const lane = ref()
const ball = ref()
const status = ref('Ready')
let current: Animation | undefined

async function watch(animation: Animation, label: string) {
  current = animation
  status.value = label
  const finished = await animation
  if (current === animation) {
    current = undefined
    status.value = finished ? 'Landed' : 'Stopped'
  }
}

function launch(snap: boolean) {
  stop(ball.value, ['x'])
  ball.value.nativeView.translateX = 0
  const end = Math.max(0, lane.value.nativeView.getActualSize().width - BALL)
  // With the default friction, this velocity projects exactly to the lane's end.
  const velocity = end * -1000 * Math.log(0.998) * (snap ? 0.75 : 1)
  void watch(
    decay(ball.value, { x: velocity }, snap ? { snap: [0, end] } : undefined),
    snap ? 'Springing to the closest stop…' : 'Slowing down…',
  )
}

function returnHome() {
  void watch(animate(ball.value, { x: 0 }), 'Returning with the current velocity…')
}

function stopMotion() {
  current?.stop()
}
onUnmounted(stopMotion)
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        :text="t('01 / INERTIA STUDY')"
        class="ex-kicker"
        verticalAlignment="top" /><Label
        :text="t('Nothing moves.\nUntil you do.')"
        class="ex-title"
        textWrap="true"
        verticalAlignment="top"
        marginTop="35" /><GridLayout
        ref="lane"
        height="74"
        verticalAlignment="bottom"
        marginBottom="44"
        ><Label height="1" backgroundColor="#5E6E51" /><Label
          v-for="i in 10"
          :key="i"
          width="1"
          height="9"
          backgroundColor="#7A886B"
          horizontalAlignment="left"
          :marginLeft="(i - 1) * 27"
          verticalAlignment="bottom" /><GridLayout
          ref="ball"
          :width="BALL"
          :height="BALL"
          borderRadius="24"
          backgroundColor="#E3FC62"
          horizontalAlignment="left"
          ><Label
            text="↗"
            fontSize="24"
            color="#26372B"
            textAlignment="center"
            verticalAlignment="middle" /></GridLayout></GridLayout
      ><GridLayout columns="*,auto" verticalAlignment="bottom"
        ><Label :text="t('IMPULSE')" class="ex-kicker" /><Label
          col="1"
          :text="t('REST')"
          class="ex-kicker" /></GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*"
        ><Button
          col="0"
          :text="t('Free decay')"
          @tap="launch(false)"
          class="ex-primary" /><Button
          col="1"
          :text="t('Snap')"
          @tap="launch(true)" /></GridLayout
      ><GridLayout columns="*,*"
        ><Button col="0" :text="t('Return')" @tap="returnHome" /><Button
          col="1"
          :text="t('Stop')"
          @tap="stopMotion" /></GridLayout></StackLayout
    ><Label :text="t(status)" class="ex-note" textWrap="true" />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Decay')" />
      <Label
        class="muted"
        textWrap="true"
        :text="
          t(
            'Launch freely or spring to the closest stop. Return interrupts either motion.',
          )
        "
      />
      <GridLayout ref="lane" class="lane" height="56">
        <Label
          ref="ball"
          class="ball"
          :width="BALL"
          :height="BALL"
          horizontalAlignment="left"
        />
      </GridLayout>
      <Label class="muted" :text="t(status)" />
      <GridLayout columns="*, *">
        <Button class="button" :text="t('Free decay')" @tap="launch(false)" />
        <Button col="1" class="button" :text="t('Snap')" @tap="launch(true)" />
      </GridLayout>
      <GridLayout columns="*, *">
        <Button class="button" :text="t('Return')" @tap="returnHome" />
        <Button col="1" class="button" :text="t('Stop')" @tap="stopMotion" />
      </GridLayout>
    </StackLayout>
  </template>
</template>
