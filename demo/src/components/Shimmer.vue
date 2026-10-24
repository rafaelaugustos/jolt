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
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        text="SOMETHING GOOD IS ON ITS WAY"
        class="ex-kicker"
        verticalAlignment="top" /><StackLayout
        ref="placeholder"
        :width="narrow ? '78%' : '100%'"
        verticalAlignment="middle"
        ><GridLayout height="150" backgroundColor="#425247" borderRadius="20"
          ><Label
            text="✦"
            fontSize="70"
            color="#63765B"
            textAlignment="center"
            verticalAlignment="middle" /></GridLayout
        ><GridLayout columns="48,*" rows="24,24" marginTop="20"
          ><Label
            rowSpan="2"
            width="42"
            height="42"
            borderRadius="21"
            backgroundColor="#8B9C80" /><Label
            col="1"
            height="12"
            width="85%"
            horizontalAlignment="left"
            backgroundColor="#8B9C80"
            borderRadius="6" /><Label
            col="1"
            row="1"
            height="8"
            width="60%"
            horizontalAlignment="left"
            backgroundColor="#5F7459"
            borderRadius="4" /></GridLayout></StackLayout
      ><Label
        text="A little anticipation."
        class="ex-copy"
        verticalAlignment="bottom" /></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*"
        ><Button
          col="0"
          :text="running ? 'Stop shimmer' : 'Start shimmer'"
          @tap="toggle"
          class="ex-primary" /><Button
          col="1"
          text="Resize"
          @tap="narrow = !narrow" /></GridLayout></StackLayout
    ><Label
      text="The light follows the whole card, even as it changes size."
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
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
