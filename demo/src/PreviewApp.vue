<script setup lang="ts">
import { ref } from 'nativescript-vue'
import Legacy from './App.vue'
import Showcase from './showcase/Showcase.vue'
import { enablePreviewLanguage } from './showcase/i18n'
import { launchArgument, onLaunch } from './launch'
const ready = ref(false),
  legacy = ref(false)
onLaunch(() => {
  // Existing isolated recordings/probes retain their entry points. A normal
  // launch, including tapping the installed icon, always opens the collection.
  legacy.value = [
    'playground',
    'screen',
    'autoplay',
    'image-lab',
    'drag-lab',
    'drag-values',
    'layout-lab',
    'playback-lab',
    'haptics-lab',
    'gradient-values',
    'particle-lab',
    'scene-lighting',
    'scene-shader',
    'scene-camera',
    'opacity-rotation',
    'size-lab',
    'live-springs',
    'gesture-lab',
    'bottom-sheet',
    'reorder-lab',
    'shared-layout',
    'interaction-replay',
  ].some((name) => launchArgument(name) !== undefined)
  enablePreviewLanguage(!legacy.value)
  ready.value = true
})
</script>
<template>
  <GridLayout backgroundColor="#F6F5F0" iosOverflowSafeArea="true">
    <!-- Keep a native root while Android resolves its launch arguments. -->
    <Legacy v-if="ready && legacy" /><Showcase v-else-if="ready" />
  </GridLayout>
</template>
