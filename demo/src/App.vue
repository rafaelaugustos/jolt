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
import SceneShader from './components/SceneShader.vue'
import OpacityRotation from './components/OpacityRotation.vue'
import SizeLab from './components/SizeLab.vue'
import LiveSprings from './components/LiveSprings.vue'
import GestureLab from './components/GestureLab.vue'
import BottomSheetLab from './components/BottomSheetLab.vue'
import ReorderLab from './components/ReorderLab.vue'
import InteractionReplayLab from './components/InteractionReplayLab.vue'
import CurveSamplingLab from './components/CurveSamplingLab.vue'
import SharedLayoutLab from './components/SharedLayoutLab.vue'
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
const sceneShader = ref(false)
const sceneCamera = ref(false)
const opacityRotation = ref(false)
const sizeLab = ref(false)
const liveSprings = ref(false)
const gestureLab = ref(false)
const bottomSheetLab = ref(false)
const reorderLab = ref(false)
const sharedLayoutLab = ref(false)
const interactionReplay = ref(false)
const curveSampling = ref(false)
const autoplay = ref(false)
const initialScreen = ref<Screen>('home')
const assistant = ref()
let stopTaps: (() => void) | undefined
onLaunch(() => {
  curveSampling.value = launchArgument('curve-sampling') !== undefined
  imageLab.value = launchArgument('image-lab') !== undefined
  dragLab.value = launchArgument('drag-lab') !== undefined
  dragValues.value = launchArgument('drag-values') !== undefined
  playbackLab.value = launchArgument('playback-lab') !== undefined
  hapticsLab.value = launchArgument('haptics-lab') !== undefined
  gradientValues.value = launchArgument('gradient-values') !== undefined
  particleLab.value = launchArgument('particle-lab') !== undefined
  sceneLighting.value = launchArgument('scene-lighting') !== undefined
  sceneShader.value = launchArgument('scene-shader') !== undefined
  sceneCamera.value = launchArgument('scene-camera') !== undefined
  opacityRotation.value = launchArgument('opacity-rotation') !== undefined
  sizeLab.value = launchArgument('size-lab') !== undefined
  liveSprings.value = launchArgument('live-springs') !== undefined
  gestureLab.value = launchArgument('gesture-lab') !== undefined
  bottomSheetLab.value = launchArgument('bottom-sheet') !== undefined
  reorderLab.value = launchArgument('reorder-lab') !== undefined
  sharedLayoutLab.value = launchArgument('shared-layout') !== undefined
  interactionReplay.value =
    launchArgument('interaction-replay') !== undefined ||
    launchArgument('scroll-handoff') !== undefined
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
  gestureLab.value = false
  bottomSheetLab.value = false
  reorderLab.value = false
  sharedLayoutLab.value = false
  interactionReplay.value = false
  curveSampling.value = false
  imageLab.value = false
  dragLab.value = false
  dragValues.value = false
  layoutLab.value = false
  playbackLab.value = false
  sceneLighting.value = false
  sceneShader.value = false
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
      :statusBarStyle="playbackLab || opacityRotation || sceneShader ? 'light' : 'dark'"
      :androidStatusBarBackground="playbackLab ? '#101827' : undefined"
      :class="
        playground ||
        hapticsLab ||
        gradientValues ||
        particleLab ||
        sceneShader ||
        sceneLighting ||
        sceneCamera
          ? ''
          : 'assistant-page'
      "
      @loaded="pageLoaded"
    >
      <CurveSamplingLab v-if="launched && curveSampling" @back="backToPlayground" />
      <InteractionReplayLab
        v-else-if="launched && interactionReplay"
        @back="backToPlayground"
      />
      <SharedLayoutLab v-else-if="launched && sharedLayoutLab" @back="backToPlayground" />
      <ReorderLab v-else-if="launched && reorderLab" @back="backToPlayground" />
      <BottomSheetLab v-else-if="launched && bottomSheetLab" @back="backToPlayground" />
      <GestureLab v-else-if="launched && gestureLab" @back="backToPlayground" />
      <LiveSprings v-else-if="launched && liveSprings" @back="backToPlayground" />
      <SizeLab v-else-if="launched && sizeLab" @back="backToPlayground" />
      <OpacityRotation v-else-if="launched && opacityRotation" />
      <ScrollView v-else-if="launched && sceneShader"
        ><SceneShader @back="backToPlayground"
      /></ScrollView>
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
        @gestureLab="gestureLab = true"
        @bottomSheetLab="bottomSheetLab = true"
        @playbackLab="playbackLab = true"
        @sceneLighting="sceneLighting = true"
        @sceneCamera="sceneCamera = true"
        @sceneShader="sceneShader = true"
      />
      <Assistant
        v-else-if="launched"
        ref="assistant"
        :initialScreen="initialScreen"
        :autoplay="autoplay"
      /> </Page
  ></Frame>
</template>
