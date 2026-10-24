<script setup lang="ts">
import { isAndroid, View } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { BusyTrial, type BusyMode } from '../busy-trial'

const jolt = ref()
const layered = ref()
const reveal = ref()
const busy = ref(false)
const status = ref('Watch the two tiles and the growing circle.')
let trial: BusyTrial | undefined
function view(target: View | { nativeView: View }) {
  return target instanceof View ? target : target.nativeView
}
async function play(mode: BusyMode) {
  if (busy.value) return
  busy.value = true
  status.value =
    mode === 'main'
      ? 'The app will block JavaScript for 300 ms.'
      : mode === 'worker'
        ? 'The worker will do the same 300 ms of work.'
        : 'Playing without extra work.'
  try {
    trial ??= new BusyTrial({
      jolt: view(jolt.value),
      layered: view(layered.value),
      reveal: view(reveal.value),
    })
    const result = await trial.run(mode)
    status.value =
      mode === 'idle'
        ? 'Ready.'
        : `${mode === 'main' ? 'JavaScript' : 'Worker'} work: ${Math.round(result.work.elapsedMs)} ms. Tap another mode to compare.`
  } catch (error) {
    status.value = String(error)
  } finally {
    busy.value = false
  }
}
onUnmounted(() => trial?.dispose())
const props = defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="isAndroid" class="section">
    <Label class="heading" text="Busy JavaScript" />
    <Label class="muted" text="Same work. Main thread or worker." textWrap="true" />
    <GridLayout columns="*, *, *" rows="90, auto" class="stage">
      <GridLayout ref="jolt" width="48" height="48" backgroundColor="#f59e0b"
        ><Label text="J" fontSize="30" fontWeight="bold" textAlignment="center"
      /></GridLayout>
      <GridLayout ref="layered" col="1" width="48" height="48" backgroundColor="#8b5cf6"
        ><Label
          text="L"
          fontSize="30"
          fontWeight="bold"
          textAlignment="center"
          color="white"
      /></GridLayout>
      <GridLayout col="2" width="64" height="64" backgroundColor="#e4e4e7"
        ><GridLayout ref="reveal" backgroundColor="#22c55e"
      /></GridLayout>
      <Label row="1" text="Jolt" fontSize="11" textAlignment="center" />
      <Label row="1" col="1" text="withLayer" fontSize="11" textAlignment="center" />
      <Label row="1" col="2" text="Reveal" fontSize="11" textAlignment="center" />
    </GridLayout>
    <GridLayout columns="*, *, *">
      <Button class="button" text="Play" :isEnabled="!busy" @tap="play('idle')" />
      <Button
        class="button"
        col="1"
        text="Block JS"
        :isEnabled="!busy"
        @tap="play('main')"
      />
      <Button
        class="button"
        col="2"
        text="Worker"
        :isEnabled="!busy"
        @tap="play('worker')"
      />
    </GridLayout>
    <Label class="muted" :text="status" textWrap="true" />
    <Label
      class="muted"
      text="A hardware layer caches drawing. It does not unblock the main thread. Workers cannot update views directly."
      textWrap="true"
      marginTop="8"
    />
  </StackLayout>
  <StackLayout v-else-if="props.embedded" class="section" padding="28">
    <Label
      text="Made for Android"
      fontSize="24"
      fontWeight="bold"
      color="#303A2D"
      textWrap="true"
    />
    <Label
      text="Same work. Two different paths."
      fontSize="17"
      color="#526347"
      marginTop="16"
      textWrap="true"
    />
    <Label
      text="This experiment compares Android's main thread with a worker while native views animate. Open it on Android to run the comparison."
      fontSize="15"
      color="#69725F"
      marginTop="12"
      textWrap="true"
    />
    <Label
      text="There is more to explore in the collection."
      fontSize="13"
      color="#7B8274"
      marginTop="24"
      textWrap="true"
    />
  </StackLayout>
</template>
