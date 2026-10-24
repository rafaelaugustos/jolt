<script lang="ts" setup>
import { usePreviewI18n } from '../showcase/i18n'
import { ref } from 'nativescript-vue'
import type { View } from '@nativescript/core'
import { animate, type EasingName } from '@rafaelaugusto/jolt'
const { t } = usePreviewI18n()

const curves: EasingName[] = [
  'quadOut',
  'cubicOut',
  'quartOut',
  'quintOut',
  'sineOut',
  'expoOut',
]
const dots: { nativeView: View }[] = []
const dot = (i: number) => (el: unknown) => {
  if (el) dots[i] = el as { nativeView: View }
}
const logo = ref()
let across = false

function play() {
  across = !across
  for (const [i, ball] of dots.entries()) {
    const travel = (ball.nativeView.parent as View).getActualSize().width - 20
    animate(ball, { x: across ? travel : 0 }, { duration: 900, ease: curves[i] })
  }
  animate(
    logo.value,
    { scale: [0.6, 1.08, 1], opacity: [0, 1, 1] },
    { duration: 900, ease: 'easeInOut', opacity: { times: [0, 0.3, 1] } },
  )
}
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><GridLayout columns="*,auto" verticalAlignment="top"
        ><Label :text="t('SIX WAYS TO ARRIVE')" class="ex-kicker" /><Image
          ref="logo"
          col="1"
          src="~/assets/jolt-mark.png"
          width="28"
          height="28" /></GridLayout
      ><StackLayout verticalAlignment="bottom"
        ><GridLayout v-for="(name, i) in curves" :key="name" columns="72,*" height="42"
          ><Label
            :text="t(name)"
            fontSize="11"
            color="#A6B89D"
            verticalAlignment="middle" /><GridLayout col="1"
            ><Label height="1" backgroundColor="#46573F" /><Label
              :ref="dot(i)"
              width="20"
              height="20"
              borderRadius="10"
              :backgroundColor="
                ['#E3FC62', '#D6E7A5', '#B7D4B3', '#A0CDC4', '#BBB4DF', '#DBB5C5'][i]
              "
              horizontalAlignment="left" /></GridLayout></GridLayout></StackLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="t('Play curves')"
          @tap="play"
          class="ex-primary" /></GridLayout></StackLayout
    ><Label
      :text="t('Same distance. Same duration. Six distinct personalities.')"
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Easing curves')" />
      <Label
        class="muted"
        textWrap="true"
        :text="t('ease: \'cubicOut\' · opacity: { times }')"
      />

      <GridLayout columns="*, auto" class="stage" padding="12 16">
        <StackLayout>
          <GridLayout v-for="(name, i) in curves" :key="name" columns="76, *" height="30">
            <Label :text="t(name)" class="easing-name" />
            <GridLayout col="1">
              <Label class="easing-rail" />
              <Label
                :ref="dot(i)"
                class="ball"
                width="20"
                height="20"
                horizontalAlignment="left"
              />
            </GridLayout>
          </GridLayout>
        </StackLayout>
        <Label ref="logo" col="1" class="logo" :text="t('J')" marginLeft="16" />
      </GridLayout>

      <Label
        class="note"
        textWrap="true"
        :text="
          t(
            'Six named curves over 900 ms. The J\'s opacity only sets times, so it keeps the 900 ms easeInOut and is fully visible by 30%.',
          )
        "
      />
      <Button class="button" :text="t('Play curves')" @tap="play" />
    </StackLayout>
  </template>
</template>
