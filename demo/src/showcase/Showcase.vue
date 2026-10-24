<script setup lang="ts">
import { ref, onUnmounted } from 'nativescript-vue'
import { RouterView } from 'vue-router-ns'
import { observeAppearance, palette, themeClass } from './theme'
import Splash from './Splash.vue'
import { launchArgument } from '../launch'
const requested = launchArgument('showcase-example')
const initial = requested ? `/example/${encodeURIComponent(requested)}` : '/'
const opening = ref(true)
onUnmounted(observeAppearance())
</script>
<template>
  <GridLayout
    :backgroundColor="palette.background"
    :class="themeClass"
    iosOverflowSafeArea="true"
  >
    <GridLayout :isUserInteractionEnabled="!opening" :accessibilityHidden="opening">
      <RouterView :initial="initial" />
    </GridLayout>
    <Splash v-if="opening" @done="opening = false" />
  </GridLayout>
</template>
