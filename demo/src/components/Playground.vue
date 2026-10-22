<script lang="ts" setup>
import {
  Label,
  StackLayout,
  type EventData,
  type ScrollView,
  type TextField,
  type View,
} from '@nativescript/core'
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { followKeyboard, scrollLinked, sequence } from '@rafaelaugusto/jolt'
import { launchArgument } from '../launch'
import Loops from './Loops.vue'
import Pauses from './Pauses.vue'
import TrackEasing from './TrackEasing.vue'
import RandomPauses from './RandomPauses.vue'
import GradientDirective from './GradientDirective.vue'
import EasingCurves from './EasingCurves.vue'
import FadeOverflow from './FadeOverflow.vue'
import Presets from './Presets.vue'
import Press from './Press.vue'
import Keyboard from './Keyboard.vue'
import VueAdapter from './VueAdapter.vue'
import Springs from './Springs.vue'
import FromReactNative from './FromReactNative.vue'
import Decay from './Decay.vue'
import Stagger from './Stagger.vue'
import ListItems from './ListItems.vue'
import Symbols from './Symbols.vue'
import Shimmer from './Shimmer.vue'
import Haptics from './Haptics.vue'
import Particles from './Particles.vue'
import Loaders from './Loaders.vue'
import Reveal from './Reveal.vue'
import Text from './Text.vue'
import Rolling from './Rolling.vue'
import BusyJs from './BusyJs.vue'
import Colors from './Colors.vue'
import Gradients from './Gradients.vue'
import Decorations from './Decorations.vue'
import Playback from './Playback.vue'
import Timeline from './Timeline.vue'
import MotionPath from './MotionPath.vue'
import Tuning from './Tuning.vue'
import MotionStates from './MotionStates.vue'
import MotionValues from './MotionValues.vue'
import StateTransitions from './StateTransitions.vue'
import Layers from './Layers.vue'
import ScrollValues from './ScrollValues.vue'
import Remount from './Remount.vue'

const emit = defineEmits<{
  imageLab: []
  dragLab: []
  dragValues: []
  layoutLab: []
}>()

const logo = ref()
const title = ref()
const tagline = ref()
const scroll = ref()
const hero = ref()
const compact = ref()
const content = ref()
const composer = ref(false)
const message = ref('')
const field = ref()
let unlink: (() => void)[] = []
let unfollow: (() => void) | undefined
let jumped = false

function jump() {
  const section = launchArgument('section')?.toLowerCase()
  const host = content.value?.nativeView as StackLayout | undefined
  if (jumped || !section || !host) return
  let target: View | undefined
  host.eachChildView((child) => {
    const heading = child instanceof StackLayout ? child.getChildAt(0) : undefined
    if (heading instanceof Label && heading.text?.toLowerCase().startsWith(section))
      target = child
    return !target
  })
  if (!target || target.getActualSize().height <= 0) return
  jumped = true
  ;(scroll.value.nativeView as ScrollView).scrollToVerticalOffset(
    target.getLocationRelativeTo(host).y - 4,
    false,
  )
}
function laidOut() {
  setTimeout(jump)
}

function composerLoaded(event: EventData) {
  unfollow = followKeyboard(event.object as View)
}
function send() {
  message.value = ''
  ;(field.value?.nativeView as TextField | undefined)?.dismissSoftInput()
}

// the page isn't on screen yet: Jolt applies the first keyframes now and plays once it is
onMounted(() => {
  unlink = [
    scrollLinked(
      scroll.value,
      hero.value,
      { y: [0, 40], opacity: [1, 0] },
      { range: [0, 180] },
    ),
    scrollLinked(
      scroll.value,
      compact.value,
      { y: [10, 0], opacity: [0, 1] },
      { range: [70, 150] },
    ),
  ]
  sequence([
    [logo.value, 'popIn', { delay: 400 }],
    [[title.value, tagline.value], 'fadeInUp', { stagger: 80 }],
  ])
})
onUnmounted(() => {
  unlink.forEach((cleanup) => cleanup())
  unfollow?.()
})
</script>

<template>
  <GridLayout rows="48, *, auto">
    <GridLayout columns="*, auto" padding="0 20" backgroundColor="#ffffff">
      <Label
        ref="compact"
        text="Jolt"
        opacity="0"
        fontSize="20"
        fontWeight="bold"
        verticalAlignment="middle"
      />
      <Label
        col="1"
        text="Scroll to collapse ↓"
        fontSize="12"
        color="#71717a"
        verticalAlignment="middle"
      />
    </GridLayout>
    <ScrollView ref="scroll" row="1">
      <StackLayout ref="content" class="content" @layoutChanged="laidOut">
        <StackLayout ref="hero" class="hero">
          <Label ref="logo" class="logo" text="J" />
          <Label ref="title" class="title" text="Jolt" />
          <Label ref="tagline" class="muted" text="Native animations for NativeScript" />
        </StackLayout>

        <Tuning />
        <MotionValues />
        <Layers />
        <ScrollValues />
        <MotionStates />
        <StateTransitions />
        <Remount />
        <Button text="Layout changes" @tap="emit('layoutLab')" />
        <Button text="Drag, fling and snap" @tap="emit('dragLab')" />
        <Button text="Drag a motion value" @tap="emit('dragValues')" />
        <Button text="Image effects and photo zoom" @tap="emit('imageLab')" />
        <MotionPath />
        <Timeline />
        <Playback />
        <Decorations />
        <BusyJs />
        <Colors />
        <Gradients />
        <GradientDirective />
        <Presets />
        <Springs />
        <FromReactNative />
        <Decay />
        <Stagger />
        <ListItems />
        <Press />
        <Keyboard :shown="composer" @toggle="composer = !composer" />
        <VueAdapter />
        <Symbols />
        <Shimmer />
        <Loaders />
        <Reveal />
        <Text />
        <Rolling />
        <Haptics />
        <Particles />
        <Loops />
        <Pauses />
        <RandomPauses />
        <TrackEasing />
        <EasingCurves />
        <FadeOverflow />
      </StackLayout>
    </ScrollView>
    <GridLayout
      v-if="composer"
      row="2"
      columns="*, auto"
      class="composer"
      @loaded="composerLoaded"
    >
      <TextField
        ref="field"
        v-model="message"
        class="composer-input"
        hint="Type a message"
        returnKeyType="send"
        @returnPress="send"
      />
      <Button col="1" class="button" text="Send" @tap="send" />
    </GridLayout>
  </GridLayout>
</template>
