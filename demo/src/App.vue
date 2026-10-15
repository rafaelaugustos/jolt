<script lang="ts" setup>
import { isIOS } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import Assistant from './assistant/Assistant.vue'
import Playground from './components/Playground.vue'
const args = isIOS ? NSProcessInfo.processInfo.arguments : undefined
const playground = !isIOS || (args?.containsObject('--playground') ?? false)
const autoplay = args?.containsObject('--autoplay') ?? false
const initialScreen = args?.containsObject('--screen=chat')
  ? 'chat'
  : args?.containsObject('--screen=voice')
    ? 'voice'
    : 'home'
const assistant = ref()
defineExpose({ assistant })
</script>
<template>
  <Frame
    ><Page
      actionBarHidden="true"
      statusBarStyle="dark"
      :class="playground ? '' : 'assistant-page'"
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
