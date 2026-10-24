<script lang="ts" setup>
import type { View } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import { animate, origamiSpring, type OrigamiSpring } from '@rafaelaugusto/jolt'

const BALL = 40

const configs: { label: string; config: OrigamiSpring }[] = [
  { label: 'friction 7 · tension 40', config: { friction: 7, tension: 40 } },
  { label: 'friction 3 · tension 40', config: { friction: 3, tension: 40 } },
  { label: 'friction 12 · tension 80', config: { friction: 12, tension: 80 } },
]
const lanes: { nativeView: View }[] = []
const balls: { nativeView: View }[] = []
const right = ref(false)

function toss() {
  right.value = !right.value
  configs.forEach(({ config }, i) => {
    const width = lanes[i]!.nativeView.getActualSize().width
    animate(balls[i]!, { x: right.value ? width - BALL - 8 : 0 }, origamiSpring(config))
  })
}
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        text="A STUDY IN PERSONALITY"
        class="ex-kicker"
        verticalAlignment="top" /><StackLayout marginTop="35"
        ><StackLayout v-for="({ label }, i) in configs" :key="label" marginBottom="10"
          ><GridLayout columns="*,auto" height="16"
            ><Label
              :text="['BALANCED', 'PLAYFUL', 'COMPOSED'][i]"
              class="ex-kicker" /><Label
              col="1"
              :text="label"
              color="#798F6F"
              fontSize="9" /></GridLayout
          ><GridLayout :ref="(el) => (lanes[i] = el as never)" height="54"
            ><Label height="1" backgroundColor="#4A5E40" /><GridLayout
              :ref="(el) => (balls[i] = el as never)"
              :width="BALL"
              :height="BALL"
              borderRadius="20"
              :backgroundColor="['#E3FC62', '#C2B0E8', '#E4AE91'][i]"
              horizontalAlignment="left"
              ><Label
                text="↗"
                color="#34442F"
                fontSize="22"
                textAlignment="center"
                verticalAlignment="middle" /></GridLayout></GridLayout></StackLayout></StackLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          text="Toss springs"
          @tap="toss"
          class="ex-primary" /></GridLayout></StackLayout
    ><Label
      text="Three spring settings, side by side. Pick the feeling you like."
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" text="From React Native" />
      <Label class="muted" textWrap="true" text="origamiSpring({ friction, tension })" />

      <StackLayout v-for="({ label }, i) in configs" :key="label">
        <Label class="caption rn-caption" :text="label" />
        <GridLayout
          :ref="(el) => (lanes[i] = el as never)"
          class="lane rn-lane"
          height="48"
        >
          <Label
            :ref="(el) => (balls[i] = el as never)"
            class="ball"
            :width="BALL"
            :height="BALL"
            horizontalAlignment="left"
          />
        </GridLayout>
      </StackLayout>

      <Label
        class="note"
        textWrap="true"
        text="The springs Animated.spring plays for friction and tension, converted with the same Origami formulas."
      />
      <Button class="button" text="Toss springs" @tap="toss" />
    </StackLayout>
  </template>
</template>
