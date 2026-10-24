<script setup lang="ts">
import { Color, Utils, isIOS, type EventData, type View } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { animate, set, stop } from '@rafaelaugusto/jolt'
import { useBinding, useMotionScope, useMotionValue } from '@rafaelaugusto/jolt/vue'

import { launchArgument } from '../launch'
import { checkValueConsumers } from '../../../benchmarks/value-consumers'

const diagnostics = ref('')
let checking = false
const progress = useMotionValue(0)
const motion = useMotionScope()
const dot = useBinding({ x: progress.to([0, 1], [0, 220]) })
const following = ref(true)
const playing = ref(false)
let update: ((value: number) => void) | undefined
let remove: (() => void) | undefined
let unsubscribe: (() => void) | undefined

function follow() {
  unsubscribe?.()
  unsubscribe = undefined
  if (following.value && update)
    unsubscribe = motion.use(() => progress.subscribe(update!))
}

function loaded(event: EventData) {
  unloaded()
  const host = event.object as View
  const color = new Color('#14b8a6')
  if (isIOS) {
    const layer = CALayer.new()
    layer.bounds = CGRectMake(0, 0, 24, 24)
    layer.cornerRadius = 12
    layer.backgroundColor = color.ios.CGColor
    host.ios.layer.addSublayer(layer)
    update = (value) => {
      CATransaction.begin()
      CATransaction.setDisableActions(true)
      layer.position = CGPointMake(12 + value * 220, 20)
      CATransaction.commit()
    }
    remove = () => layer.removeFromSuperlayer()
  } else {
    const density = Utils.layout.getDisplayDensity()
    const parent = host.android as android.view.ViewGroup
    const native = new android.view.View(parent.getContext())
    const fill = new android.graphics.drawable.GradientDrawable()
    fill.setColor(color.android)
    fill.setCornerRadius(12 * density)
    native.setBackground(fill)
    native.layout(0, 8 * density, 24 * density, 32 * density)
    parent.getOverlay().add(native)
    update = (value) => native.setTranslationX(value * 220 * density)
    remove = () => parent.getOverlay().remove(native)
  }
  update(progress.get())
  follow()
  if (!checking && launchArgument('value-observer-checks')) {
    checking = true
    void checkValueConsumers(host, (text) => {
      diagnostics.value = text
    })
  }
}

function unloaded() {
  unsubscribe?.()
  unsubscribe = undefined
  remove?.()
  remove = update = undefined
}

function toggleFollow() {
  following.value = !following.value
  follow()
}

function play() {
  playing.value = true
  set(progress, 0)
  motion.add(
    animate(progress, 1, {
      duration: 1600,
      ease: 'sineInOut',
      repeat: Infinity,
      repeatType: 'reverse',
    }),
  )
}

function rest() {
  stop(progress)
  playing.value = false
}

onUnmounted(unloaded)
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        text="TWO SIGNALS. ONE SOURCE."
        class="ex-kicker"
        verticalAlignment="top" /><Label
        text="Stay in sync."
        class="ex-title"
        textWrap="true"
        verticalAlignment="top"
        marginTop="35" /><GridLayout
        rows="20,54,26,40"
        height="140"
        verticalAlignment="bottom"
        marginBottom="12"
      >
        <GridLayout columns="*,auto"
          ><Label text="BOUND VIEW" class="ex-kicker" /><Label
            col="1"
            text="●"
            color="#B9ABEF"
            fontSize="12"
        /></GridLayout>
        <GridLayout row="1" width="244" height="54"
          ><Label height="1" backgroundColor="#485A43" /><Label
            :ref="dot"
            width="24"
            height="24"
            borderRadius="12"
            backgroundColor="#C4B3EE"
            horizontalAlignment="left"
            accessibilityLabel="Bound signal"
        /></GridLayout>
        <GridLayout row="2" columns="*,auto"
          ><Label text="OBSERVED NATIVE OBJECT" class="ex-kicker" /><Label
            col="1"
            :text="following ? 'LINKED' : 'DETACHED'"
            fontSize="9"
            color="#81C3B0"
        /></GridLayout>
        <GridLayout
          row="3"
          height="40"
          width="244"
          @loaded="loaded"
          @unloaded="unloaded"
          accessibilityLabel="Observed signal"
          ><Label height="1" backgroundColor="#485A43"
        /></GridLayout> </GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*"
        ><Button
          col="0"
          :text="playing ? 'Restart observers' : 'Play observers'"
          @tap="play"
          class="ex-primary" /><Button
          col="1"
          text="Stop observers"
          @tap="rest" /></GridLayout
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="following ? 'Detach observer' : 'Attach observer'"
          @tap="toggleFollow" /></GridLayout></StackLayout
    ><Label
      text="Unlink the lower signal while the upper one keeps moving."
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" text="Value observers" />
      <Label v-if="diagnostics" :text="diagnostics" textWrap="true" />
      <Label
        class="muted"
        text="A view binding and a separate native object follow the same value."
        textWrap="true"
      />
      <Label text="Bound view" marginTop="16" />
      <GridLayout height="40" width="244" horizontalAlignment="left">
        <Label
          :ref="dot"
          width="24"
          height="24"
          borderRadius="12"
          backgroundColor="#6366f1"
          horizontalAlignment="left"
        />
      </GridLayout>
      <Label text="Native object" />
      <GridLayout
        height="40"
        width="244"
        horizontalAlignment="left"
        @loaded="loaded"
        @unloaded="unloaded"
      />
      <GridLayout columns="*,*" marginTop="12">
        <Button
          class="button"
          :text="playing ? 'Restart observers' : 'Play observers'"
          @tap="play"
        />
        <Button col="1" class="button" text="Stop observers" @tap="rest" />
      </GridLayout>
      <Button
        class="button"
        :text="following ? 'Detach observer' : 'Attach observer'"
        @tap="toggleFollow"
      />
    </StackLayout>
  </template>
</template>
