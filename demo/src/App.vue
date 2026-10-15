<script lang="ts" setup>
import { onMounted, ref } from 'nativescript-vue'
import { sequence } from '@rafaelaugusto/jolt'
import Loops from './components/Loops.vue'
import Presets from './components/Presets.vue'
import Press from './components/Press.vue'
import Springs from './components/Springs.vue'
import Stagger from './components/Stagger.vue'
import Symbols from './components/Symbols.vue'

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
  <Frame>
    <Page actionBarHidden="true">
      <ScrollView>
        <StackLayout class="content">
          <StackLayout class="hero">
            <Label ref="logo" class="logo" text="J" />
            <Label ref="title" class="title" text="Jolt" />
            <Label
              ref="tagline"
              class="muted"
              text="Native animations for NativeScript"
            />
          </StackLayout>

          <Presets />
          <Springs />
          <Stagger />
          <Press />
          <Symbols />
          <Loops />
        </StackLayout>
      </ScrollView>
    </Page>
  </Frame>
</template>
