<script lang="ts" setup>
import { isIOS } from '@nativescript/core'
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { loader } from '@rafaelaugusto/jolt'

const dots = ref()
const bars = ref()
const ring = ref()
const running = ref(false)
const small = ref(false)
let cleanups: (() => void)[] = []

function stop() {
  cleanups.forEach((cleanup) => cleanup())
  cleanups = []
  running.value = false
}
function start() {
  stop()
  cleanups = [
    loader(dots.value, { style: 'dots', color: '#dcf71d' }),
    loader(bars.value, { style: 'bars', color: '#67e8f9' }),
    loader(ring.value, { style: 'ring', color: '#c4b5fd' }),
  ]
  running.value = true
}
onMounted(() => {
  if (isIOS) start()
})
onUnmounted(stop)
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        text="GOOD THINGS TAKE A MOMENT"
        class="ex-kicker"
        verticalAlignment="top" /><Label
        text="Worth&#10;the wait."
        class="ex-title"
        textWrap="true"
        verticalAlignment="top"
        marginTop="32" /><GridLayout
        columns="*,*,*"
        rows="auto,auto"
        verticalAlignment="bottom"
        ><GridLayout
          ref="dots"
          :height="small ? 28 : 80"
          accessibilityLabel="Loading with dots" /><GridLayout
          ref="bars"
          col="1"
          :height="small ? 28 : 80"
          accessibilityLabel="Loading with bars" /><GridLayout
          ref="ring"
          col="2"
          :height="small ? 28 : 80"
          accessibilityLabel="Loading with a ring" /><Label
          row="1"
          text="DOTS"
          class="ex-kicker"
          textAlignment="center" /><Label
          row="1"
          col="1"
          text="BARS"
          class="ex-kicker"
          textAlignment="center" /><Label
          row="1"
          col="2"
          text="RING"
          class="ex-kicker"
          textAlignment="center" /></GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*"
        ><Button
          col="0"
          :text="running ? 'Stop loaders' : 'Start loaders'"
          @tap="running ? stop() : start()"
          class="ex-primary" /><Button
          col="1"
          text="Resize"
          @tap="small = !small" /></GridLayout
    ></StackLayout>
  </StackLayout>
  <template v-else>
    <StackLayout v-if="isIOS" class="section">
      <Label class="heading" text="Loaders" />
      <Label
        class="muted"
        text="Dots, bars and a ring. One native animation each."
        textWrap="true"
      />
      <GridLayout columns="*, *, *" rows="auto, auto" marginTop="16" marginBottom="16">
        <GridLayout
          ref="dots"
          class="loader-slot"
          :height="small ? 28 : 80"
          accessibilityLabel="Loading with dots"
        />
        <GridLayout
          ref="bars"
          col="1"
          class="loader-slot"
          :height="small ? 28 : 80"
          accessibilityLabel="Loading with bars"
        />
        <GridLayout
          ref="ring"
          col="2"
          class="loader-slot"
          :height="small ? 28 : 80"
          accessibilityLabel="Loading with a ring"
        />
        <Label row="1" class="muted" text="Dots" textAlignment="center" />
        <Label row="1" col="1" class="muted" text="Bars" textAlignment="center" />
        <Label row="1" col="2" class="muted" text="Ring" textAlignment="center" />
      </GridLayout>
      <GridLayout columns="*, *">
        <Button
          class="button"
          :text="running ? 'Stop loaders' : 'Start loaders'"
          @tap="running ? stop() : start()"
        />
        <Button col="1" class="button" text="Resize" @tap="small = !small" />
      </GridLayout>
    </StackLayout>
  </template>
</template>

<style scoped>
.loader-slot {
  margin: 4;
  border-radius: 12;
  background-color: #18181b;
}
</style>
