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
const props = defineProps<{ embedded?: boolean }>()
</script>
<template>
  <GridLayout v-if="embedded" class="exhibit" rows="*,auto">
    <ScrollView
      ><DragSurface v-if="mounted" :embedded="true" /><Label
        v-else
        text="Ready for a fresh start."
        class="ex-note" /></ScrollView
    ><GridLayout row="1" columns="*,*" class="ex-controls"
      ><Button
        :text="mounted ? 'Unmount drags' : 'Mount drags'"
        @tap="mounted = !mounted" /><Button
        col="1"
        :text="reduced ? 'Motion: reduced' : 'Motion: system'"
        @tap="toggleReduced"
    /></GridLayout>
  </GridLayout>
  <template v-else>
    <GridLayout rows="auto,*,auto" padding="12 20" backgroundColor="white">
      <GridLayout v-if="!props.embedded" columns="auto,*">
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
</template>
