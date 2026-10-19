<script setup lang="ts">
import { onUnmounted, ref } from 'nativescript-vue'
import { configure } from '@rafaelaugusto/jolt'
import LayoutSurface from './LayoutSurface.vue'
defineEmits<{ back: [] }>()
const mounted = ref(true),
  reduced = ref(false)
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
      <Label col="1" text="Layout changes" class="heading" verticalAlignment="middle" />
    </GridLayout>
    <ScrollView row="1">
      <LayoutSurface v-if="mounted" />
      <Label v-else text="Layout examples unmounted" horizontalAlignment="center" />
    </ScrollView>
    <GridLayout row="2" columns="*,*">
      <Button
        :text="mounted ? 'Unmount layout' : 'Mount layout'"
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
