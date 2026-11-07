<script setup lang="ts">
import { ref } from 'nativescript-vue'
import Legacy from './App.vue'
import Showcase from './showcase/Showcase.vue'
import MinimalRecipes from './components/MinimalRecipes.vue'
import NativeMotionLab from './components/NativeMotionLab.vue'
import PortableLab from './components/PortableLab.vue'
import InteractionDepth from './components/InteractionDepth.vue'
import PortableFoundations from './components/PortableFoundations.vue'
import { enablePreviewLanguage } from './showcase/i18n'
import { launchArgument, onLaunch } from './launch'
const ready = ref(false),
  nativeMotion = ref(false),
  portable = ref(false),
  foundations = ref(false),
  depth = ref(false),
  legacy = ref(false),
  recipe = ref<string>()
onLaunch(() => {
  depth.value = launchArgument('interaction-depth') !== undefined
  nativeMotion.value = launchArgument('native-motion') !== undefined
  portable.value = launchArgument('portable-lab') !== undefined
  foundations.value = ['groups', 'pointer', 'drawing'].includes(
    launchArgument('portable-lab') ?? '',
  )
  recipe.value = launchArgument('recipe')
  // Existing isolated recordings/probes retain their entry points. A normal
  // launch, including tapping the installed icon, always opens the collection.
  legacy.value = [
    'background-playback',
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
    'native-capabilities',
    'gesture-lab',
    'bottom-sheet',
    'reorder-lab',
    'shared-layout',
    'interaction-replay',
    'scroll-handoff',
    'curve-sampling',
    'playback-efficiency',
    'report-export',
    'motion-inspector',
  ].some((name) => launchArgument(name) !== undefined)
  enablePreviewLanguage(!legacy.value)
  ready.value = true
})
</script>
<template>
  <GridLayout backgroundColor="#F6F5F0" iosOverflowSafeArea="true">
    <!-- Keep a native root while Android resolves its launch arguments. -->
    <InteractionDepth v-if="ready && depth" /><PortableFoundations
      v-else-if="ready && foundations"
    /><PortableLab v-else-if="ready && portable" /><NativeMotionLab
      v-else-if="ready && nativeMotion"
    /><MinimalRecipes v-else-if="ready && recipe" :kind="recipe" /><Legacy
      v-else-if="ready && legacy"
    /><Showcase v-else-if="ready" />
  </GridLayout>
</template>
