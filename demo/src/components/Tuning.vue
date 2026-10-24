<script lang="ts" setup>
import { usePreviewI18n } from '../showcase/i18n'
import { ref } from 'nativescript-vue'
import { configure, sequence, type JoltConfig } from '@rafaelaugusto/jolt'
const { t } = usePreviewI18n()

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
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        :text="t('YOUR PACE, YOUR SPACE')"
        class="ex-kicker"
        verticalAlignment="top" /><GridLayout
        ref="card"
        width="198"
        height="198"
        borderRadius="99"
        backgroundColor="#DDEBBE"
        @tap="play"
        accessibilityRole="button"
        :accessibilityLabel="t('Play at selected speed')"
        ><StackLayout verticalAlignment="middle"
          ><Label
            :text="t(`${speed}×`)"
            fontSize="62"
            fontWeight="bold"
            color="#2B4030"
            textAlignment="center" /><Label
            :text="t('TAP TO FEEL IT')"
            fontSize="9"
            letterSpacing=".1"
            color="#677757"
            textAlignment="center" /></StackLayout></GridLayout
      ><Label
        :text="t('Good motion makes room for everyone.')"
        class="ex-copy"
        verticalAlignment="bottom"
        textWrap="true" /></GridLayout
    ><Label :text="t('Playback speed')" class="ex-label" /><GridLayout
      class="ex-controls"
      columns="*,*,*"
      ><Button
        v-for="(option, i) in speeds"
        :key="option.value"
        :col="i"
        :text="t(option.label)"
        :class="{ 'ex-primary': speed === option.value }"
        @tap="setSpeed(option.value)" /></GridLayout
    ><Label :text="t('Reduced motion')" class="ex-label" marginTop="18" /><GridLayout
      class="ex-controls"
      columns="*,*,*"
      ><Button
        v-for="(option, i) in preferences"
        :key="option"
        :col="i"
        :text="t(option === 'user' ? 'System' : option === 'always' ? 'Always' : 'Never')"
        :class="{ 'ex-primary': reduced === option }"
        @tap="setReduced(option)"
    /></GridLayout>
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Tuning')" />
      <Label
        class="muted"
        textWrap="true"
        :text="t('configure({ timeScale: 0.2, reducedMotion: \'always\' })')"
      />
      <Label
        class="muted"
        textWrap="true"
        :text="t('Tap the card to compare speed and Reduced Motion.')"
      />

      <GridLayout class="stage" height="160">
        <GridLayout ref="card" class="card" width="110" height="110" @tap="play">
          <Label class="card-label" :text="t('tap')" />
        </GridLayout>
      </GridLayout>

      <Label class="muted" :text="t('Speed')" />
      <WrapLayout>
        <Label
          v-for="option in speeds"
          :key="option.value"
          class="chip"
          :class="{ active: option.value === speed }"
          :text="t(option.label)"
          @tap="setSpeed(option.value)"
        />
      </WrapLayout>

      <Label class="muted" :text="t('Reduced motion')" marginTop="8" />
      <WrapLayout>
        <Label
          v-for="option in preferences"
          :key="option"
          class="chip"
          :class="{ active: option === reduced }"
          :text="t(option)"
          @tap="setReduced(option)"
        />
      </WrapLayout>
    </StackLayout>
  </template>
</template>
