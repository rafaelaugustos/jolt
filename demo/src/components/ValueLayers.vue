<script setup lang="ts">
import { usePreviewI18n } from '../showcase/i18n'
import { ref } from 'nativescript-vue'
import { set, stop } from '@rafaelaugusto/jolt'
import { useBinding, useMotionScope, useMotionValue } from '@rafaelaugusto/jolt/vue'
const { t } = usePreviewI18n()

const motion = useMotionScope()
const signal = useMotionValue(0)
const reference = useMotionValue(0)
const base = useBinding({ x: reference.to([-0.15, 1.15], [0, 220]) })
const layered = useBinding({
  x: signal.to([-0.15, 1.15], [0, 220]),
  scale: signal.to([0, 1], [0.8, 1.25]),
  backgroundColor: signal.to([0, 1], ['#14b8a6', '#6366f1']),
})
const pulsing = ref(false)
let generation = 0
let destination = 1

function start() {
  reset()
  for (const value of [reference, signal])
    motion.animate(value, 1, {
      duration: 4800,
      ease: 'linear',
      repeat: Infinity,
      repeatType: 'reverse',
    })
}

function retarget() {
  destination = destination === 1 ? 0 : 1
  for (const value of [reference, signal])
    motion.animate(value, destination, { duration: 2400, ease: 'sineInOut' })
}

async function pulse() {
  const own = ++generation
  pulsing.value = !pulsing.value
  if (pulsing.value) {
    motion.animate(signal, [0, 0.12, -0.12, 0], {
      duration: 1200,
      ease: 'sineInOut',
      repeat: Infinity,
      layer: 'charge',
    })
  } else {
    await motion.animate(signal, 0, { duration: 250, layer: 'charge' })
    if (generation === own) stop(signal, { layer: 'charge' })
  }
}

function reset() {
  generation++
  pulsing.value = false
  destination = 1
  set(reference, 0)
  set(signal, 0)
}
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        :text="t('A LITTLE EXTRA ENERGY')"
        class="ex-kicker"
        verticalAlignment="top" /><Label
        :text="t('Build on\nthe feeling.')"
        class="ex-title"
        textWrap="true"
        verticalAlignment="top"
        marginTop="32" /><StackLayout verticalAlignment="bottom"
        ><Label :text="t('BASELINE')" class="ex-kicker" /><GridLayout
          width="244"
          height="48"
          ><Label height="1" backgroundColor="#475B42" /><Label
            :ref="base"
            width="24"
            height="24"
            borderRadius="12"
            backgroundColor="#A9BA94"
            horizontalAlignment="left" /></GridLayout
        ><Label :text="t('BASE + CHARGE')" class="ex-kicker" marginTop="12" /><GridLayout
          width="244"
          height="48"
          ><Label height="1" backgroundColor="#475B42" /><Label
            :ref="layered"
            width="24"
            height="24"
            borderRadius="12"
            horizontalAlignment="left" /></GridLayout></StackLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*"
        ><Button col="0" :text="t('Start base')" @tap="start" class="ex-primary" /><Button
          col="1"
          :text="t('Retarget base')"
          @tap="retarget" /></GridLayout
      ><GridLayout columns="*,*"
        ><Button
          col="0"
          :text="t(pulsing ? 'Remove charge pulse' : 'Add charge pulse')"
          @tap="pulse" /><Button
          col="1"
          :text="t('Reset values')"
          @tap="reset" /></GridLayout></StackLayout
    ><Label
      :text="t('Add a pulse to position, color and scale — while the journey continues.')"
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Value layers')" />
      <Label
        class="muted"
        :text="
          t(
            'The base keeps moving while a charge pulse adds to position, scale and color.',
          )
        "
        textWrap="true"
      />
      <Label :text="t('Base reference')" marginTop="16" />
      <GridLayout width="244" height="48" horizontalAlignment="left">
        <Label
          :ref="base"
          width="24"
          height="24"
          borderRadius="12"
          backgroundColor="#a1a1aa"
          horizontalAlignment="left"
        />
      </GridLayout>
      <Label :text="t('Base + charge pulse')" />
      <GridLayout width="244" height="56" horizontalAlignment="left">
        <Label
          :ref="layered"
          width="24"
          height="24"
          borderRadius="12"
          horizontalAlignment="left"
        />
      </GridLayout>
      <GridLayout columns="*,*" marginTop="12">
        <Button :text="t('Start base')" class="button" @tap="start" />
        <Button col="1" :text="t('Retarget base')" class="button" @tap="retarget" />
      </GridLayout>
      <GridLayout columns="*,*">
        <Button
          :text="t(pulsing ? 'Remove charge pulse' : 'Add charge pulse')"
          class="button"
          @tap="pulse"
        />
        <Button col="1" :text="t('Reset values')" class="button" @tap="reset" />
      </GridLayout>
    </StackLayout>
  </template>
</template>
