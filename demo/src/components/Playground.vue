<script lang="ts" setup>
import type { EventData, TextField, View } from '@nativescript/core'
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { followKeyboard, scrollLinked, sequence } from '@rafaelaugusto/jolt'
import Loops from './Loops.vue'
import Presets from './Presets.vue'
import Press from './Press.vue'
import Keyboard from './Keyboard.vue'
import VueAdapter from './VueAdapter.vue'
import Springs from './Springs.vue'
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
import Decorations from './Decorations.vue'
import Playback from './Playback.vue'
import Timeline from './Timeline.vue'
import MotionPath from './MotionPath.vue'

const logo = ref()
const title = ref()
const tagline = ref()
const scroll = ref()
const hero = ref()
const compact = ref()
const composer = ref(false)
const message = ref('')
const field = ref()
let unlink: (() => void)[] = []
let unfollow: (() => void) | undefined

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
      <StackLayout class="content">
        <StackLayout ref="hero" class="hero">
          <Label ref="logo" class="logo" text="J" />
          <Label ref="title" class="title" text="Jolt" />
          <Label ref="tagline" class="muted" text="Native animations for NativeScript" />
        </StackLayout>

        <MotionPath />
        <Timeline />
        <Playback />
        <Decorations />
        <BusyJs />
        <Colors />
        <Presets />
        <Springs />
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
