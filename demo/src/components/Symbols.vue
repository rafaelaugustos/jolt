<script lang="ts" setup>
import { isIOS } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { symbolEffect, type Animation } from '@rafaelaugusto/jolt'

const bell = ref()
const heart = ref()
const star = ref()
const wifi = ref()
const favorite = ref()
const scaled = ref(false)
let scale: Animation | undefined
let filled = false

function toggleScale() {
  if (scaled.value) scale?.stop()
  else scale = symbolEffect(star.value, 'scale')
  scaled.value = !scaled.value
}

function replace() {
  filled = !filled
  symbolEffect(favorite.value, { replace: filled ? 'sys://heart.fill' : 'sys://heart' })
}

onUnmounted(() => scale?.stop())
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout columns="*,12,*" rows="160,12,160,12,86" marginBottom="22"
      ><GridLayout
        backgroundColor="#E9E5F0"
        borderRadius="25"
        @tap="symbolEffect(bell, 'bounce')"
        accessibilityRole="button"
        accessibilityLabel="Bounce"
        ><Image
          ref="bell"
          src="sys://bell.fill"
          width="48"
          height="48"
          tintColor="#76628F"
          marginBottom="20" /><Label
          text="A LITTLE NUDGE"
          fontSize="9"
          color="#76628F"
          verticalAlignment="bottom"
          textAlignment="center"
          marginBottom="22" /></GridLayout
      ><GridLayout
        col="2"
        backgroundColor="#F1DFDA"
        borderRadius="25"
        @tap="symbolEffect(heart, 'pulse')"
        accessibilityRole="button"
        accessibilityLabel="Pulse"
        ><Image
          ref="heart"
          src="sys://heart.fill"
          width="48"
          height="48"
          tintColor="#AC645B"
          marginBottom="20" /><Label
          text="FEEL SOMETHING"
          fontSize="9"
          color="#AC645B"
          verticalAlignment="bottom"
          textAlignment="center"
          marginBottom="22" /></GridLayout
      ><GridLayout
        row="2"
        backgroundColor="#EBEBCF"
        borderRadius="25"
        @tap="toggleScale"
        accessibilityRole="button"
        accessibilityLabel="Scale"
        ><Image
          ref="star"
          src="sys://star.fill"
          width="48"
          height="48"
          tintColor="#89834B"
          marginBottom="20" /><Label
          text="A BRIGHT IDEA"
          fontSize="9"
          color="#89834B"
          verticalAlignment="bottom"
          textAlignment="center"
          marginBottom="22" /></GridLayout
      ><GridLayout
        row="2"
        col="2"
        backgroundColor="#DDEBE3"
        borderRadius="25"
        @tap="symbolEffect(wifi, 'variableColor')"
        accessibilityRole="button"
        accessibilityLabel="Variable color"
        ><Image
          ref="wifi"
          src="sys://wifi"
          width="48"
          height="48"
          tintColor="#507F65"
          marginBottom="20" /><Label
          text="STAY CONNECTED"
          fontSize="9"
          color="#507F65"
          verticalAlignment="bottom"
          textAlignment="center"
          marginBottom="22" /></GridLayout
      ><GridLayout
        row="4"
        colSpan="3"
        columns="auto,*"
        backgroundColor="#26382C"
        borderRadius="23"
        padding="20"
        @tap="replace"
        accessibilityRole="button"
        accessibilityLabel="Replace"
        ><Image
          ref="favorite"
          src="sys://heart"
          width="30"
          height="30"
          tintColor="#E3FC62" /><Label
          col="1"
          text="Keep what moves you."
          fontSize="18"
          color="#EAF0DC"
          marginLeft="18"
          verticalAlignment="middle" /></GridLayout></GridLayout
    ><Label text="Touch an icon. Let it respond." class="ex-note" textWrap="true" />
  </StackLayout>
  <template v-else>
    <StackLayout v-if="isIOS" class="section">
      <Label class="heading" text="SF Symbols" />
      <Label class="muted" text="Native symbol effects · iOS 17+" />

      <GridLayout columns="64, *" rows="64, 64, 64, 64, 64" marginTop="12">
        <Image ref="bell" src="sys://bell.fill" class="symbol" />
        <Button
          col="1"
          class="button"
          text="Bounce"
          @tap="symbolEffect(bell, 'bounce')"
        />
        <Image ref="heart" row="1" src="sys://heart.fill" class="symbol" />
        <Button
          row="1"
          col="1"
          class="button"
          text="Pulse"
          @tap="symbolEffect(heart, 'pulse')"
        />
        <Image ref="star" row="2" src="sys://star.fill" class="symbol" />
        <Button
          row="2"
          col="1"
          class="button"
          :text="scaled ? 'Stop scale' : 'Scale'"
          @tap="toggleScale"
        />
        <Image ref="wifi" row="3" src="sys://wifi" class="symbol" />
        <Button
          row="3"
          col="1"
          class="button"
          text="Variable color"
          @tap="symbolEffect(wifi, 'variableColor')"
        />
        <Image ref="favorite" row="4" src="sys://heart" class="symbol" />
        <Button row="4" col="1" class="button" text="Replace" @tap="replace" />
      </GridLayout>
    </StackLayout>
  </template>
</template>

<style scoped>
.symbol {
  width: 36;
  height: 36;
  tint-color: #dcf71d;
}
</style>
