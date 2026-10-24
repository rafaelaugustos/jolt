<script setup lang="ts">
import { usePreviewI18n } from '../showcase/i18n'
import { computed, ref } from 'nativescript-vue'
import type { GradientValue } from '@rafaelaugusto/jolt/vue'
const { t } = usePreviewI18n()

const moods = [
  { name: 'Sunset', colors: ['#FF5F6D', '#FFC371'], angle: 135 },
  { name: 'Ocean', colors: ['#22D3EE', '#6366F1'], angle: 200 },
  { name: 'Forest', colors: ['#A3E635', '#065F46'], angle: 300 },
]
const index = ref(0)
const mood = computed(() => moods[index.value]!)
const value = computed<GradientValue>(() => [
  { type: 'linear', colors: mood.value.colors, angle: mood.value.angle },
  { duration: 700, ease: 'easeInOut' },
])

function next() {
  index.value = (index.value + 1) % moods.length
}
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout v-gradient="value" class="ex-stage" height="380" padding="28"
      ><Label
        :text="t('ATMOSPHERES / 01')"
        color="#FFFFFF"
        fontSize="9"
        letterSpacing=".15"
        verticalAlignment="top" /><GridLayout
        width="200"
        height="200"
        borderRadius="100"
        borderWidth="1"
        borderColor="#FFFFFF"
        opacity=".3" /><GridLayout
        width="146"
        height="146"
        borderRadius="73"
        borderWidth="1"
        borderColor="#FFFFFF"
        opacity=".3" /><StackLayout verticalAlignment="bottom"
        ><Label
          :text="t(mood.name)"
          fontSize="54"
          fontWeight="bold"
          color="#FFFFFF"
          letterSpacing="-.04" /><Label
          :text="t('Stay a little longer.')"
          fontSize="16"
          color="#FFFFFF"
          marginTop="8" /></StackLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="t('Next mood')"
          @tap="next"
          class="ex-primary" /></GridLayout></StackLayout
    ><Label
      :text="t('A change of atmosphere, in one touch.')"
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Gradient directive')" />
      <Label
        class="muted"
        textWrap="true"
        :text="
          t(
            'v-gradient=&quot;[{ type: \'linear\', colors, angle }, { duration: 700 }]&quot;',
          )
        "
      />

      <GridLayout v-gradient="value" class="gradient-banner" height="120">
        <Label class="gradient-banner-label" :text="t(mood.name)" />
      </GridLayout>

      <Label
        class="note"
        textWrap="true"
        :text="
          t(
            'The directive paints the gradient on mount, animates to the new colors and angle when the value changes, and removes it on unmount.',
          )
        "
      />
      <Button class="button" :text="t('Next mood')" @tap="next" />
    </StackLayout>
  </template>
</template>
