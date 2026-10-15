<script lang="ts" setup>
import { onMounted, ref } from 'nativescript-vue'
import { sequence } from '@rafaelaugusto/jolt'
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

const logo = ref()
const title = ref()
const tagline = ref()

// the page isn't on screen yet: Jolt applies the first keyframes now and plays once it is
onMounted(() => {
  sequence([
    [logo.value, 'popIn', { delay: 400 }],
    [[title.value, tagline.value], 'fadeInUp', { stagger: 80 }],
  ])
})
</script>

<template>
  <ScrollView>
    <StackLayout class="content">
      <StackLayout class="hero">
        <Label ref="logo" class="logo" text="J" />
        <Label ref="title" class="title" text="Jolt" />
        <Label ref="tagline" class="muted" text="Native animations for NativeScript" />
      </StackLayout>

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
</template>
