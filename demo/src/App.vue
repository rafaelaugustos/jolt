<script lang="ts" setup>
import type { EventData, View } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import Assistant from './assistant/Assistant.vue'
import Playground from './components/Playground.vue'
import ImageLab from './components/ImageLab.vue'
import DragLab from './components/DragLab.vue'
import DragValues from './components/DragValues.vue'
import PlaybackLab from './components/PlaybackLab.vue'
import LayoutLab from './components/LayoutLab.vue'
import Haptics from './components/Haptics.vue'
import GradientValues from './components/GradientValues.vue'
import Particles from './components/Particles.vue'
import SceneLighting from './components/SceneLighting.vue'
import SceneCamera from './components/SceneCamera.vue'
import OpacityRotation from './components/OpacityRotation.vue'
import SizeLab from './components/SizeLab.vue'
import LiveSprings from './components/LiveSprings.vue'
import { launchArgument, onLaunch, runLaunchTaps } from './launch'
type Screen = 'home' | 'voice' | 'chat'
const launched = ref(false)
const playground = ref(false)
const imageLab = ref(false)
const dragLab = ref(false)
const dragValues = ref(false)
const layoutLab = ref(false)
const playbackLab = ref(false)
const hapticsLab = ref(false)
const gradientValues = ref(false)
const particleLab = ref(false)
const sceneLighting = ref(false)
const sceneCamera = ref(false)
const opacityRotation = ref(false)
const sizeLab = ref(false)
const liveSprings = ref(false)
const autoplay = ref(false)
const initialScreen = ref<Screen>('home')
const assistant = ref()
let stopTaps: (() => void) | undefined
onLaunch(() => {
  imageLab.value = launchArgument('image-lab') !== undefined
  dragLab.value = launchArgument('drag-lab') !== undefined
  dragValues.value = launchArgument('drag-values') !== undefined
  playbackLab.value = launchArgument('playback-lab') !== undefined
  hapticsLab.value = launchArgument('haptics-lab') !== undefined
  gradientValues.value = launchArgument('gradient-values') !== undefined
  particleLab.value = launchArgument('particle-lab') !== undefined
  sceneLighting.value = launchArgument('scene-lighting') !== undefined
  sceneCamera.value = launchArgument('scene-camera') !== undefined
  opacityRotation.value = launchArgument('opacity-rotation') !== undefined
  sizeLab.value = launchArgument('size-lab') !== undefined
  liveSprings.value = launchArgument('live-springs') !== undefined
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
  sizeLab.value = false
  liveSprings.value = false
  imageLab.value = false
  dragLab.value = false
  dragValues.value = false
  layoutLab.value = false
  playbackLab.value = false
  sceneLighting.value = false
  sceneCamera.value = false
  playground.value = true
}
onUnmounted(() => stopTaps?.())
defineExpose({ assistant })
</script>
<template>
  <Frame
    ><Page
      actionBarHidden="true"
      :statusBarStyle="playbackLab || opacityRotation ? 'light' : 'dark'"
      :androidStatusBarBackground="playbackLab ? '#101827' : undefined"
      :class="
        playground ||
        hapticsLab ||
        gradientValues ||
        particleLab ||
        sceneLighting ||
        sceneCamera
          ? ''
          : 'assistant-page'
      "
      @loaded="pageLoaded"
    >
      <LiveSprings v-if="launched && liveSprings" @back="backToPlayground" />
      <SizeLab v-else-if="launched && sizeLab" @back="backToPlayground" />
      <OpacityRotation v-else-if="launched && opacityRotation" />
      <ScrollView v-else-if="launched && sceneCamera"
        ><SceneCamera @back="backToPlayground"
      /></ScrollView>
      <ScrollView v-else-if="launched && sceneLighting"
        ><SceneLighting @back="backToPlayground"
      /></ScrollView>
      <ScrollView v-else-if="launched && particleLab"><Particles /></ScrollView>
      <ScrollView v-else-if="launched && gradientValues"><GradientValues /></ScrollView>
      <ScrollView v-else-if="launched && hapticsLab"><Haptics /></ScrollView>
      <PlaybackLab v-else-if="launched && playbackLab" @back="backToPlayground" />
      <LayoutLab v-else-if="launched && layoutLab" @back="backToPlayground" />
      <DragLab v-else-if="launched && dragLab" @back="backToPlayground" />
      <DragValues v-else-if="launched && dragValues" @back="backToPlayground" />
      <ImageLab v-else-if="launched && imageLab" @back="backToPlayground" />
      <Playground
        v-else-if="launched && playground"
        @imageLab="imageLab = true"
        @dragLab="dragLab = true"
        @dragValues="dragValues = true"
        @layoutLab="layoutLab = true"
        @sizeLab="sizeLab = true"
        @liveSprings="liveSprings = true"
        @playbackLab="playbackLab = true"
        @sceneLighting="sceneLighting = true"
        @sceneCamera="sceneCamera = true"
      />
      <Assistant
        v-else-if="launched"
        ref="assistant"
        :initialScreen="initialScreen"
        :autoplay="autoplay"
      /> </Page
  ></Frame>
</template>
