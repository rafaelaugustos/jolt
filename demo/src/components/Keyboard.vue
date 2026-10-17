<script lang="ts" setup>
defineProps<{ shown: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Keyboard" />
    <Label class="muted" textWrap="true" text="followKeyboard(composer)" />
    <Label
      class="note"
      textWrap="true"
      text="A composer pinned to the bottom of the page rises with the keyboard, at its speed and curve, and settles back when it hides."
    />
    <Button
      class="button"
      :text="shown ? 'Hide composer' : 'Show composer'"
      @tap="emit('toggle')"
    />
  </StackLayout>
</template>
