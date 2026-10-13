<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { animate, presets, type PresetName } from '@rafaelaugusto/jolt'

const card = ref()
const current = ref<PresetName>('popIn')
const names = Object.keys(presets) as PresetName[]

async function play(name: PresetName) {
  current.value = name
  const finished = await animate(card.value, name)

  // exits leave the card hidden: bring it back
  if (finished && name.includes('Out')) {
    animate(card.value, { x: 0, y: 0 }, { duration: 0 })
    animate(card.value, 'zoomIn', { delay: 300 })
  }
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Presets" />
    <Label class="muted" textWrap="true" text="animate(card, 'popIn')" />

    <GridLayout class="stage" height="200">
      <GridLayout ref="card" class="card" width="120" height="120">
        <Label class="card-label" :text="current" />
      </GridLayout>
    </GridLayout>

    <WrapLayout>
      <Label
        v-for="name in names"
        :key="name"
        class="chip"
        :class="{ active: name === current }"
        :text="name"
        @tap="play(name)"
      />
    </WrapLayout>
  </StackLayout>
</template>
