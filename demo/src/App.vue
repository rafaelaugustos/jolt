<script lang="ts" setup>
import type { EventData, View } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import Assistant from './assistant/Assistant.vue'
import Playground from './components/Playground.vue'
import ImageLab from './components/ImageLab.vue'
import DragLab from './components/DragLab.vue'
import DragValues from './components/DragValues.vue'
import LayoutLab from './components/LayoutLab.vue'
import { launchArgument, onLaunch, runLaunchTaps } from './launch'
type Screen = 'home' | 'voice' | 'chat'
const launched = ref(false)
const playground = ref(false)
const imageLab = ref(false)
const dragLab = ref(false)
const dragValues = ref(false)
const layoutLab = ref(false)
const autoplay = ref(false)
const initialScreen = ref<Screen>('home')
const assistant = ref()
let stopTaps: (() => void) | undefined
onLaunch(() => {
  imageLab.value = launchArgument('image-lab') !== undefined
  dragLab.value = launchArgument('drag-lab') !== undefined
  dragValues.value = launchArgument('drag-values') !== undefined
  layoutLab.value = launchArgument('layout-lab') !== undefined
  playground.value = launchArgument('playground') !== undefined
  autoplay.value = launchArgument('autoplay') !== undefined
  const requested = launchArgument('screen')
  initialScreen.value = requested === 'chat' || requested === 'voice' ? requested : 'home'
  launched.value = true
})
function pageLoaded(event: EventData) {
  stopTaps?.()
  stopTaps = runLaunchTaps(event.object as View)
}
function backToPlayground() {
  imageLab.value = false
  dragLab.value = false
  dragValues.value = false
  layoutLab.value = false
  playground.value = true
}
onUnmounted(() => stopTaps?.())
defineExpose({ assistant })
</script>
<template>
  <Frame
    ><Page
      actionBarHidden="true"
      statusBarStyle="dark"
      :class="playground ? '' : 'assistant-page'"
      @loaded="pageLoaded"
    >
      <LayoutLab v-if="launched && layoutLab" @back="backToPlayground" />
      <DragLab v-else-if="launched && dragLab" @back="backToPlayground" />
      <DragValues v-else-if="launched && dragValues" @back="backToPlayground" />
      <ImageLab v-else-if="launched && imageLab" @back="backToPlayground" />
      <Playground
        v-else-if="launched && playground"
        @imageLab="imageLab = true"
        @dragLab="dragLab = true"
        @dragValues="dragValues = true"
        @layoutLab="layoutLab = true"
      />
      <Assistant
        v-else-if="launched"
        ref="assistant"
        :initialScreen="initialScreen"
        :autoplay="autoplay"
      /> </Page
  ></Frame>
</template>
