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
</script>

<template>
  <StackLayout v-if="isIOS" class="section">
    <Label class="heading" text="SF Symbols" />
    <Label class="muted" text="Native symbol effects · iOS 17+" />

    <GridLayout columns="64, *" rows="64, 64, 64, 64, 64" marginTop="12">
      <Image ref="bell" src="sys://bell.fill" class="symbol" />
      <Button col="1" class="button" text="Bounce" @tap="symbolEffect(bell, 'bounce')" />
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

<style scoped>
.symbol {
  width: 36;
  height: 36;
  tint-color: #dcf71d;
}
</style>
