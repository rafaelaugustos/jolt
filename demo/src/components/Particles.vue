<script lang="ts" setup>
import { isAndroid, type LayoutBase } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import {
  confetti,
  particles,
  configure,
  motionScope,
  type ParticleOptions,
} from '@rafaelaugusto/jolt'
import { checkParticles } from '../../../benchmarks/particles'
import { launchArgument } from '../launch'

const stage = ref()
const celebrate = ref()
const label = ref('Particles')
const status = ref('Snow, sparks, bubbles — and a reason to celebrate.')
const tall = ref(false),
  taps = ref(0),
  reduced = ref(false),
  checking = ref(false)
const scope = motionScope()
let stopEmitter: (() => void) | undefined
let stopConfetti: (() => void) | undefined
const effects = {
  Snow: {
    source: 'top',
    angle: 90,
    velocity: 45,
    velocityRange: 15,
    spread: 30,
    rate: 30,
    size: 5,
    lifetime: 5000,
  },
  Sparks: {
    colors: ['#facc15', '#fb923c'],
    velocity: 120,
    velocityRange: 50,
    spread: 360,
    rate: 70,
    size: 3,
    lifetime: 1000,
  },
  Bubbles: {
    shape: 'ring',
    source: 'bottom',
    colors: ['#67e8f9', '#a5f3fc'],
    velocity: 40,
    spread: 20,
    rate: 14,
    size: 18,
    lifetime: 5000,
  },
  Finite: {
    colors: ['#fb923c', '#facc15', '#ef4444'],
    shape: 'rectangle',
    source: 'center',
    rate: 90,
    lifetime: 1400,
    duration: 700,
    size: 8,
    velocity: 100,
    velocityRange: 30,
    spread: 90,
    gravity: 130,
    spinRange: 240,
  },
} satisfies Record<string, ParticleOptions>

function play(name: keyof typeof effects) {
  stopEmitter?.()
  label.value = name
  stopEmitter = scope.use(() => particles(stage.value, effects[name]))
  status.value = reduced.value
    ? 'Reduced motion: effects removed.'
    : name === 'Finite'
      ? 'A short emission; every particle finishes its flight.'
      : `${name} · continuous emission`
}
function burst() {
  stopConfetti?.()
  stopConfetti = scope.use(() => confetti(celebrate.value))
  status.value = 'A burst from the button, across the window.'
}
function stop() {
  stopEmitter?.()
  stopConfetti?.()
  label.value = 'Particles'
  status.value = 'All clear.'
}
function motion() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
  status.value = reduced.value
    ? 'Reduced motion: effects removed.'
    : 'Motion restored. Choose an effect.'
}
async function checks() {
  if (checking.value) return
  stop()
  checking.value = true
  try {
    await checkParticles(
      stage.value.nativeView as LayoutBase,
      (text) => (status.value = text),
      launchArgument('particle-checks') ?? 'all',
    )
  } catch (error) {
    status.value = `FAILED: ${String(error)}`
  } finally {
    checking.value = false
  }
}
onUnmounted(() => {
  scope.dispose()
  if (reduced.value) configure({ reducedMotion: 'user' })
})
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout
      ref="stage"
      class="ex-stage"
      :height="tall ? 420 : 350"
      backgroundColor="#1E2532"
      accessibilityLabel="Particle stage"
      ><Label
        text="SMALL MOMENTS / BIG FEELINGS"
        class="ex-kicker"
        verticalAlignment="top" /><StackLayout verticalAlignment="middle"
        ><Label
          text="Make a&#10;little magic."
          class="ex-title"
          textWrap="true"
          textAlignment="center" /><Label
          :text="label.toUpperCase()"
          color="#B7AECE"
          letterSpacing=".15"
          fontSize="10"
          textAlignment="center"
          marginTop="18" /></StackLayout
      ><Button
        :text="`Touch ${taps}`"
        color="#DDD3F4"
        backgroundColor="#383348"
        borderRadius="16"
        height="36"
        width="108"
        fontSize="11"
        verticalAlignment="bottom"
        @tap="taps++" /></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*,*"
        ><Button col="0" text="Snow" @tap="play('Snow')" class="ex-primary" /><Button
          col="1"
          text="Sparks"
          @tap="play('Sparks')" /><Button
          col="2"
          text="Bubbles"
          @tap="play('Bubbles')" /></GridLayout></StackLayout
    ><GridLayout columns="*,*,*" class="ex-controls"
      ><Button ref="celebrate" text="Confetti" @tap="burst" /><Button
        col="1"
        text="Finite"
        @tap="play('Finite')" /><Button col="2" text="Stop" @tap="stop" /></GridLayout
    ><Label :text="status" class="ex-note" textWrap="true" />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" text="Particles" />
      <Label
        class="muted"
        text="Native snow, sparks, bubbles and confetti."
        textWrap="true"
      />
      <GridLayout
        ref="stage"
        class="particle-stage"
        :height="tall ? 270 : 210"
        accessibilityLabel="Particle stage"
      >
        <Label
          :text="label"
          color="#71717a"
          horizontalAlignment="center"
          verticalAlignment="middle"
        />
        <Button
          class="button"
          :text="`Touch ${taps}`"
          width="100"
          height="38"
          verticalAlignment="bottom"
          marginBottom="10"
          @tap="taps++"
        />
      </GridLayout>
      <GridLayout columns="*, *, *">
        <Button class="button" text="Snow" @tap="play('Snow')" />
        <Button col="1" class="button" text="Sparks" @tap="play('Sparks')" />
        <Button col="2" class="button" text="Bubbles" @tap="play('Bubbles')" />
      </GridLayout>
      <GridLayout columns="*, *, *">
        <Button ref="celebrate" class="button" text="Confetti" @tap="burst" />
        <Button col="1" class="button" text="Finite" @tap="play('Finite')" />
        <Button col="2" class="button" text="Stop" @tap="stop" />
      </GridLayout>
      <GridLayout columns="*, *, *">
        <Button class="button" text="Resize" @tap="tall = !tall" />
        <Button
          col="1"
          class="button"
          :text="reduced ? 'Motion off' : 'Motion on'"
          @tap="motion"
        />
        <Button
          v-if="isAndroid"
          col="2"
          class="button"
          text="Run checks"
          :isEnabled="!checking"
          @tap="checks"
        />
      </GridLayout>
      <Label :text="status" class="muted" textWrap="true" marginTop="12" />
    </StackLayout>
  </template>
</template>

<style scoped>
.particle-stage {
  margin: 16 0;
  border-radius: 16;
  background-color: #18181b;
}
</style>
