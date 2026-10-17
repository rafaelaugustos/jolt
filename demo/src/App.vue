<script lang="ts" setup>
import type { EventData, View } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import Assistant from './assistant/Assistant.vue'
import Playground from './components/Playground.vue'
import { launchArgument, onLaunch, runLaunchTaps } from './launch'
type Screen = 'home' | 'voice' | 'chat'
const launched = ref(false)
const playground = ref(false)
const autoplay = ref(false)
const initialScreen = ref<Screen>('home')
const assistant = ref()
let stopTaps: (() => void) | undefined
onLaunch(() => {
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
      <Playground v-if="launched && playground" />
      <Assistant
        v-else-if="launched"
        ref="assistant"
        :initialScreen="initialScreen"
        :autoplay="autoplay"
      /> </Page
  ></Frame>
</template>
