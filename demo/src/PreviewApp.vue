<script setup lang="ts">
import { ref } from 'nativescript-vue'
import Legacy from './App.vue'
import Showcase from './showcase/Showcase.vue'
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
  ].some((name) => launchArgument(name) !== undefined)
  ready.value = true
})
</script>
<template><Legacy v-if="ready && legacy" /><Showcase v-else-if="ready" /></template>
