<script setup lang="ts">
import { onUnmounted, ref } from 'nativescript-vue'
import { configure } from '@rafaelaugusto/jolt'
import DragSurface from './DragSurface.vue'
defineEmits<{ back: [] }>()
const mounted = ref(true)
const reduced = ref(false)
function toggleReduced() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
}
onUnmounted(() => configure({ reducedMotion: 'user' }))
</script>
<template>
  <GridLayout rows="auto,*,auto" padding="12 20" backgroundColor="white">
    <GridLayout columns="auto,*">
      <Button text="Back" @tap="$emit('back')" />
      <Label col="1" text="Drag & snap" class="heading" verticalAlignment="middle" />
    </GridLayout>
    <DragSurface v-if="mounted" row="1" />
    <Label
      v-else
      row="1"
      text="Drag examples unmounted"
      verticalAlignment="middle"
      horizontalAlignment="center"
    />
    <GridLayout row="2" columns="*,*">
      <Button
        :text="mounted ? 'Unmount drags' : 'Mount drags'"
        @tap="mounted = !mounted"
      />
      <Button
        col="1"
        :text="reduced ? 'Motion: reduced' : 'Motion: system'"
        @tap="toggleReduced"
      />
    </GridLayout>
  </GridLayout>
</template>
