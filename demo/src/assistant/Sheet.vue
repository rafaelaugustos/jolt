<script lang="ts" setup>
import type { EventData, View } from '@nativescript/core'
import { onBeforeUnmount, onMounted, ref } from 'nativescript-vue'
import Icon from './Icon.vue'
import { Motion } from './motion'
withDefaults(
  defineProps<{ title: string; copy: string; icon?: string; action?: string }>(),
  { icon: 'sparkles', action: 'Close preview' },
)
const emit = defineEmits<{ close: []; action: [] }>()
const backdrop = ref()
const card = ref()
const motion = new Motion()
let closing = false
function modal(event: EventData) {
  ;((event.object as View).nativeViewProtected as UIView).accessibilityViewIsModal = true
}
onMounted(() => {
  motion.play(backdrop.value, { opacity: [0, 1] }, { duration: 220 })
  motion.play(
    card.value,
    { opacity: [0, 1], y: [28, 0], scale: [0.96, 1] },
    { type: 'spring', duration: 450, bounce: 0.12, opacity: { duration: 220 } },
  )
})
async function dismiss(action = false) {
  if (closing) return
  closing = true
  motion.cancel()
  const token = motion.token
  await Promise.all([
    motion.play(backdrop.value, { opacity: 0 }, { duration: 180 }),
    motion.play(
      card.value,
      { opacity: 0, y: 18, scale: 0.98 },
      { duration: 180, ease: 'easeIn' },
    ),
  ])
  if (motion.current(token)) {
    if (action) emit('action')
    else emit('close')
  }
}
const close = () => dismiss(false)
const act = () => dismiss(true)
onBeforeUnmount(motion.dispose)
</script>
<template>
  <GridLayout>
    <GridLayout ref="backdrop" class="assistant-overlay" @tap="close" />
    <StackLayout ref="card" class="assistant-info-card" @loaded="modal">
      <Icon :name="icon" :size="40" />
      <Label
        class="assistant-info-title"
        :text="title"
        textWrap="true"
        accessible="true"
        accessibilityRole="header"
      />
      <Label class="assistant-info-copy" :text="copy" textWrap="true" />
      <Label
        class="assistant-info-action"
        :text="action"
        accessible="true"
        accessibilityRole="button"
        @loaded="motion.press"
        @tap="act"
      />
      <Label
        class="assistant-info-close"
        text="Close"
        accessible="true"
        accessibilityRole="button"
        @loaded="motion.press"
        @tap="close"
      />
    </StackLayout>
  </GridLayout>
</template>
