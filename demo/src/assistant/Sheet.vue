<script lang="ts" setup>
import type { EventData, View } from '@nativescript/core'
import { onBeforeUnmount, ref } from 'nativescript-vue'
import type { AnimateValue } from '@rafaelaugusto/jolt/vue'
import Icon from './Icon.vue'
import { Motion } from './motion'
defineOptions({ inheritAttrs: false })
withDefaults(
  defineProps<{ title: string; copy: string; icon?: string; action?: string }>(),
  { icon: 'sparkles', action: 'Close preview' },
)
const emit = defineEmits<{ close: []; action: [] }>()
const open = ref(true)
const card = ref()
const motion = new Motion()
const fadeIn: AnimateValue = [{ opacity: [0, 1] }, { duration: 220 }]
const fadeOut: AnimateValue = [{ opacity: 0 }, { duration: 180 }]
const rise: AnimateValue = [
  { opacity: [0, 1], y: [28, 0], scale: [0.96, 1] },
  { type: 'spring', duration: 450, bounce: 0.12, opacity: { duration: 220 } },
]
let pending: 'close' | 'action' | undefined
function modal(event: EventData) {
  ;((event.object as View).nativeViewProtected as UIView).accessibilityViewIsModal = true
}
function dismiss(result: 'close' | 'action') {
  if (pending) return
  pending = result
  motion.play(
    card.value,
    { opacity: 0, y: 18, scale: 0.98 },
    { duration: 180, ease: 'easeIn' },
  )
  open.value = false
}
function left() {
  if (pending === 'action') emit('action')
  else if (pending === 'close') emit('close')
}
onBeforeUnmount(motion.dispose)
</script>
<template>
  <JoltTransition appear :enter="fadeIn" :leave="fadeOut" @after-leave="left">
    <GridLayout v-if="open" v-bind="$attrs">
      <GridLayout class="assistant-overlay" @tap="dismiss('close')" />
      <StackLayout
        ref="card"
        v-animate="rise"
        class="assistant-info-card"
        @loaded="modal"
      >
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
          v-press="{ scale: 0.94 }"
          @tap="dismiss('action')"
        />
        <Label
          class="assistant-info-close"
          text="Close"
          accessible="true"
          accessibilityRole="button"
          v-press="{ scale: 0.94 }"
          @tap="dismiss('close')"
        />
      </StackLayout>
    </GridLayout>
  </JoltTransition>
</template>
