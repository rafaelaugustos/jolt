<script lang="ts" setup>
import { isIOS } from '@nativescript/core'
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { shimmer } from '@rafaelaugusto/jolt'

const placeholder = ref()
const running = ref(false)
const narrow = ref(false)
let stop: (() => void) | undefined

function toggle() {
  if (running.value) stop?.()
  else stop = shimmer(placeholder.value)
  running.value = !running.value
}

onMounted(() => {
  if (isIOS) toggle()
})
onUnmounted(() => stop?.())
</script>

<template>
  <StackLayout v-if="isIOS" class="section">
    <Label class="heading" text="Shimmer" />
    <Label class="muted" text="const stop = shimmer(placeholder)" />

    <StackLayout class="skeleton-stage">
      <GridLayout
        ref="placeholder"
        columns="56, *"
        rows="24, 16, 16"
        :width="narrow ? '75%' : '100%'"
        horizontalAlignment="left"
      >
        <StackLayout rowSpan="3" class="bone avatar" />
        <StackLayout col="1" class="bone" height="16" marginLeft="14" />
        <StackLayout col="1" row="1" class="bone" height="8" marginLeft="14" />
        <StackLayout
          col="1"
          row="2"
          class="bone"
          height="8"
          marginLeft="14"
          width="60%"
          horizontalAlignment="left"
        />
      </GridLayout>
    </StackLayout>

    <GridLayout columns="*, *">
      <Button
        class="button"
        :text="running ? 'Stop shimmer' : 'Start shimmer'"
        @tap="toggle"
      />
      <Button col="1" class="button" text="Resize" @tap="narrow = !narrow" />
    </GridLayout>
  </StackLayout>
</template>

<style scoped>
.skeleton-stage {
  margin: 16 0;
  padding: 20;
  border-radius: 14;
  background-color: #18181b;
}
.bone {
  background-color: #e4e4e7;
  border-radius: 4;
}
.avatar {
  width: 56;
  height: 56;
  border-radius: 28;
}
</style>
