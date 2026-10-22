<script lang="ts" setup>
import { ref, watch } from 'nativescript-vue'
import { animate } from '@rafaelaugusto/jolt'
import { useKeyboard } from '@rafaelaugusto/jolt/vue'

defineProps<{ shown: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const keyboard = useKeyboard()
const badge = ref()

watch(keyboard, ({ visible, transition }) => {
  animate(
    badge.value,
    { scale: visible ? 0.86 : 1, opacity: visible ? 0.7 : 1 },
    transition,
  )
})
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Keyboard" />
    <Label
      class="muted"
      textWrap="true"
      text="followKeyboard(composer) · onKeyboard(state)"
    />
    <Label
      class="note"
      textWrap="true"
      text="A composer pinned to the bottom of the page rises with the keyboard, at its speed and curve, and settles back when it hides."
    />
    <Label
      ref="badge"
      class="keyboard-badge"
      :text="
        keyboard.visible
          ? `Keyboard · ${Math.round(keyboard.height)} DIP · ${keyboard.duration} ms`
          : 'Keyboard hidden'
      "
    />
    <Button
      class="button"
      :text="shown ? 'Hide composer' : 'Show composer'"
      @tap="emit('toggle')"
    />
  </StackLayout>
</template>
