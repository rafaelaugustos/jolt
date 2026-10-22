<script setup lang="ts">
import { onMounted, ref } from 'nativescript-vue'
import { useMotionScope } from '@rafaelaugusto/jolt/vue'

const scope = useMotionScope()
const splash = scope.states(
  { logo: null, stroke: null, title: null },
  {
    hidden: {
      logo: { opacity: 0, scale: 0.5 },
      stroke: { scaleX: 0 },
      title: { opacity: 0, y: 12 },
    },
    shown: {
      logo: { opacity: 1, scale: 1 },
      stroke: { scaleX: 1 },
      title: { opacity: 1, y: 0 },
    },
  },
)
const shown = ref(false)

function toggle() {
  shown.value = !shown.value
  if (shown.value)
    splash.to('shown', {
      type: 'spring',
      bounce: 0.4,
      duration: 600,
      stroke: { duration: 650, ease: 'cubicOut', delay: 250 },
      title: { duration: 400, ease: 'easeOut', delay: 500 },
    })
  else splash.to('hidden', { duration: 250, ease: 'easeIn' })
}

onMounted(toggle)
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Per-target transitions" />
    <Label
      class="muted"
      textWrap="true"
      text="splash.to('shown', { bounce: 0.4, stroke: { duration: 650, delay: 250 } })"
    />

    <StackLayout class="stage" height="190" padding="24 0">
      <Label :ref="splash.ref('logo')" class="logo" text="J" opacity="0" />
      <Label :ref="splash.ref('stroke')" class="splash-stroke" originX="0" scaleX="0" />
      <Label :ref="splash.ref('title')" class="splash-title" text="Jolt" opacity="0" />
    </StackLayout>

    <Label
      class="note"
      textWrap="true"
      text="One controller: the logo springs in, the stroke draws with a tween 250 ms later and the title fades in last."
    />
    <Button class="button" :text="shown ? 'Hide splash' : 'Show splash'" @tap="toggle" />
  </StackLayout>
</template>
