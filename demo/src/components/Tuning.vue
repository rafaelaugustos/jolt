<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { configure, sequence, type JoltConfig } from '@rafaelaugusto/jolt'

type Preference = NonNullable<JoltConfig['reducedMotion']>
const card = ref()
const speeds = [
  { label: '1×', value: 1 },
  { label: '½×', value: 0.5 },
  { label: '⅕×', value: 0.2 },
]
const preferences: Preference[] = ['user', 'always', 'never']
const speed = ref(1)
const reduced = ref<Preference>('user')

function setSpeed(value: number) {
  speed.value = value
  configure({ timeScale: value })
}

function setReduced(value: Preference) {
  reduced.value = value
  configure({ reducedMotion: value })
}

function play() {
  sequence([
    [card.value, 'popIn'],
    [card.value, 'shake', { at: '+100' }],
  ])
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Tuning" />
    <Label
      class="muted"
      textWrap="true"
      text="configure({ timeScale: 0.2, reducedMotion: 'always' })"
    />
    <Label
      class="muted"
      textWrap="true"
      text="Tap the card to compare speed and Reduced Motion."
    />

    <GridLayout class="stage" height="160">
      <GridLayout ref="card" class="card" width="110" height="110" @tap="play">
        <Label class="card-label" text="tap" />
      </GridLayout>
    </GridLayout>

    <Label class="muted" text="Speed" />
    <WrapLayout>
      <Label
        v-for="option in speeds"
        :key="option.value"
        class="chip"
        :class="{ active: option.value === speed }"
        :text="option.label"
        @tap="setSpeed(option.value)"
      />
    </WrapLayout>

    <Label class="muted" text="Reduced motion" marginTop="8" />
    <WrapLayout>
      <Label
        v-for="option in preferences"
        :key="option"
        class="chip"
        :class="{ active: option === reduced }"
        :text="option"
        @tap="setReduced(option)"
      />
    </WrapLayout>
  </StackLayout>
</template>
