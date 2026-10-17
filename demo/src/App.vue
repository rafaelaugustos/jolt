<script lang="ts" setup>
import { isIOS, type EventData, type View } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import Assistant from './assistant/Assistant.vue'
import Playground from './components/Playground.vue'
import { launchArgument, runLaunchTaps } from './launch'
type Screen = 'home' | 'voice' | 'chat'
const playground = !isIOS || launchArgument('playground') !== undefined
const autoplay = launchArgument('autoplay') !== undefined
const requested = launchArgument('screen')
const initialScreen: Screen =
  requested === 'chat' || requested === 'voice' ? requested : 'home'
const assistant = ref()
let stopTaps: (() => void) | undefined
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
      <Playground v-if="playground" />
      <Assistant
        v-else
        ref="assistant"
        :initialScreen="initialScreen"
        :autoplay="autoplay"
      /> </Page
  ></Frame>
</template>
