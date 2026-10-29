<script setup lang="ts">
import { usePreviewI18n } from '../showcase/i18n'
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { animate, drag } from '@rafaelaugusto/jolt'
import { useMotionScope } from '@rafaelaugusto/jolt/vue'
import { launchArgument } from '../launch'
import { motionRfcChecks } from '../../../benchmarks/motion-rfc'
const { t } = usePreviewI18n()

const scope = useMotionScope()
const card = ref()
const right = ref(false)
const breathing = ref(false)
let audit: ReturnType<typeof motionRfcChecks> | undefined

onMounted(() => {
  if (launchArgument('motion-rfc-checks')) {
    audit = motionRfcChecks(card.value.nativeView)
    return
  }
  scope.add(
    drag(card.value, { axis: 'x', bounds: { left: -80, right: 80 }, rubberband: true }),
  )
})
onUnmounted(() => audit?.dispose())

function move() {
  if (audit) return audit.move()
  right.value = !right.value
  animate(card.value, { x: right.value ? 70 : -70 }, 'snappy')
}

function shake() {
  if (audit) return audit.shake()
  animate(card.value, 'shake', { layer: 'feedback' })
}

function breathe() {
  if (audit) {
    breathing.value = !breathing.value
    return audit.breathe()
  }
  breathing.value = !breathing.value
  animate(
    card.value,
    breathing.value ? { scale: [1, 1.1] } : { scale: 1 },
    breathing.value
      ? {
          duration: 700,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatType: 'reverse',
          layer: 'breathe',
        }
      : { duration: 250, layer: 'breathe' },
  )
}
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        :text="t('INDEPENDENT MOVES. ONE FEELING.')"
        class="ex-kicker"
        verticalAlignment="top" /><GridLayout
        width="220"
        height="220"
        borderRadius="110"
        borderWidth="1"
        borderColor="#42583C" /><GridLayout
        width="164"
        height="164"
        borderRadius="82"
        borderWidth="1"
        borderColor="#42583C" /><GridLayout
        ref="card"
        width="120"
        height="144"
        borderRadius="24"
        backgroundColor="#C5B3E6"
        :accessibilityLabel="t('Drag layered card')"
        ><StackLayout verticalAlignment="middle"
          ><Label text="✦" fontSize="68" color="#594C72" textAlignment="center" /><Label
            :text="t('MAKE YOUR MOVE')"
            fontSize="8"
            color="#594C72"
            letterSpacing=".05"
            textAlignment="center"
            marginTop="8" /></StackLayout></GridLayout
      ><Label
        :text="t('DRAG / SHAKE / BREATHE')"
        class="ex-kicker"
        verticalAlignment="bottom"
        textAlignment="center" /></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*,*"
        ><Button col="0" :text="t('Move')" @tap="move" class="ex-primary" /><Button
          col="1"
          :text="t('Shake')"
          @tap="shake" /><Button
          col="2"
          :text="t(breathing ? 'Rest' : 'Breathe')"
          @tap="breathe" /></GridLayout></StackLayout
    ><Label
      :text="t('Drag the card while the other movements play on top.')"
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Layers')" />
      <Label
        class="muted"
        textWrap="true"
        :text="t('animate(card, \'shake\', { layer: \'feedback\' })')"
      />

      <GridLayout class="stage" height="170">
        <GridLayout ref="card" class="layers-card" width="120" height="96">
          <Label class="card-label" :text="t('Drag me')" />
        </GridLayout>
      </GridLayout>

      <Label
        class="note"
        textWrap="true"
        :text="
          t(
            'Move and drag own the base. Shake and Breathe play on their own layers, on top of whatever the base is doing.',
          )
        "
      />
      <GridLayout columns="*, *, *">
        <Button class="button" :text="t('Move')" @tap="move" />
        <Button col="1" class="button" :text="t('Shake')" @tap="shake" />
        <Button
          col="2"
          class="button"
          :text="t(breathing ? 'Rest' : 'Breathe')"
          @tap="breathe"
        />
      </GridLayout>
    </StackLayout>
  </template>
</template>
