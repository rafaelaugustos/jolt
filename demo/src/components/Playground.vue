<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { scrollLinked, sequence } from '@rafaelaugusto/jolt'
import Loops from './Loops.vue'
import Presets from './Presets.vue'
import Press from './Press.vue'
import Springs from './Springs.vue'
import Decay from './Decay.vue'
import Stagger from './Stagger.vue'
import Symbols from './Symbols.vue'
import Shimmer from './Shimmer.vue'
import Haptics from './Haptics.vue'
import Particles from './Particles.vue'
import Loaders from './Loaders.vue'
import Reveal from './Reveal.vue'
import Text from './Text.vue'
import BusyJs from './BusyJs.vue'
import Colors from './Colors.vue'
import Decorations from './Decorations.vue'
import Playback from './Playback.vue'
import Timeline from './Timeline.vue'

const logo = ref()
const title = ref()
const tagline = ref()
const scroll = ref()
const hero = ref()
const compact = ref()
let unlink: (() => void)[] = []

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
onUnmounted(() => unlink.forEach((cleanup) => cleanup()))
</script>

<template>
  <GridLayout rows="48, *">
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

        <Timeline />
        <Playback />
        <Decorations />
        <BusyJs />
        <Colors />
        <Presets />
        <Springs />
        <Decay />
        <Stagger />
        <Press />
        <Symbols />
        <Shimmer />
        <Loaders />
        <Reveal />
        <Text />
        <Haptics />
        <Particles />
        <Loops />
      </StackLayout>
    </ScrollView>
  </GridLayout>
</template>
