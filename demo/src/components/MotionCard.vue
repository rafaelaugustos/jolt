<script setup lang="ts">
import { onMounted, ref } from 'nativescript-vue'
import { useMotionScope } from '@rafaelaugusto/jolt/vue'
import type { MotionStates } from '@rafaelaugusto/jolt'
const scope = useMotionScope()
const icon = ref(),
  label = ref(),
  progress = ref(),
  card = ref()
const status = ref('Ready to upload')
type State = 'idle' | 'sending' | 'success' | 'error'
let states: MotionStates<State> | undefined
let generation = 0
const suspended = ref(false)
function to(state: State) {
  if (!states || suspended.value) return
  const own = ++generation
  status.value = state === 'sending' ? 'Uploading…' : state
  void states.to(state).finished.then((finished) => {
    if (finished && own === generation && !scope.disposed)
      status.value = `${state} · settled`
  })
}
function suspend() {
  suspended.value = !suspended.value
  if (suspended.value) scope.suspend()
  else scope.resume()
}
onMounted(() => {
  states = scope.states(
    { icon: icon.value, label: label.value, progress: progress.value },
    {
      idle: {
        icon: { x: 0, rotate: 0, scale: 1 },
        label: { opacity: 1, y: 0 },
        progress: { scaleX: 0.05, opacity: 0.25 },
      },
      sending: {
        icon: { x: 90, rotate: 180, scale: 0.8 },
        label: { opacity: 0.4, y: -6 },
        progress: { scaleX: 0.65, opacity: 1 },
      },
      success: {
        icon: { x: 0, rotate: 360, scale: 1.15 },
        label: { opacity: 1, y: 0 },
        progress: { scaleX: 1, opacity: 1 },
      },
      error: {
        icon: { x: -32, rotate: -15, scale: 1 },
        label: { opacity: 1, y: 4 },
        progress: { scaleX: 0.2, opacity: 0.4 },
      },
    },
    { transition: { type: 'spring', duration: 800, bounce: 0.3 } },
  )
  scope.press(card.value, { scale: 0.98 })
  to('idle')
})
</script>
<template>
  <StackLayout>
    <StackLayout
      ref="card"
      padding="20"
      borderRadius="20"
      backgroundColor="#263b27"
      marginTop="12"
    >
      <Label
        ref="icon"
        text="↑"
        fontSize="38"
        color="#b6ee64"
        horizontalAlignment="left"
      />
      <Label
        ref="label"
        text="Your next big idea"
        fontSize="20"
        color="white"
        marginTop="8"
      />
      <GridLayout height="8" backgroundColor="#49604a" borderRadius="4" marginTop="18">
        <GridLayout
          ref="progress"
          backgroundColor="#b6ee64"
          borderRadius="4"
          originX="0"
        />
      </GridLayout>
      <Label :text="status" color="#d8e3d8" marginTop="12" />
    </StackLayout>
    <GridLayout columns="*,*,*,*" marginTop="8">
      <Button text="Upload" @tap="to('sending')" />
      <Button col="1" text="Cancel" @tap="to('idle')" />
      <Button col="2" text="Success" @tap="to('success')" />
      <Button col="3" text="Error" @tap="to('error')" />
    </GridLayout>
    <GridLayout columns="*,*">
      <Button text="Retry" @tap="to('sending')" />
      <Button col="1" :text="suspended ? 'Resume scope' : 'Pause scope'" @tap="suspend" />
    </GridLayout>
  </StackLayout>
</template>
