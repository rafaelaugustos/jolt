<script setup lang="ts">
import { onMounted, ref } from 'nativescript-vue'
import { useMotionScope } from '@rafaelaugusto/jolt/vue'
import type { DragEvent, DragRelease } from '@rafaelaugusto/jolt'
const scope = useMotionScope()
const card = ref(),
  panel = ref()
const status = ref('Drag the card or panel')
const paused = ref(false)
const track = (name: string, event: DragEvent) => {
  status.value = `${name} · ${Math.round(event.x)}, ${Math.round(event.y)}`
}
const released = (name: string, event: DragRelease) => {
  status.value = `${name} → ${Math.round(event.target.x)}, ${Math.round(event.target.y)}`
}
function toggle() {
  paused.value = !paused.value
  if (paused.value) scope.suspend()
  else scope.resume()
  status.value = paused.value ? 'Paused' : 'Drag the card or panel'
}
onMounted(() => {
  scope.drag(card.value, {
    axis: 'x',
    bounds: { left: -90, right: 90 },
    rubberband: true,
    onMove: (event) => track('Card', event),
    onRelease: (event) => released('Card', event),
    onSettle: (point) => (status.value = `Card settled · ${Math.round(point.x)}`),
  })
  scope.drag(panel.value, {
    axis: 'y',
    bounds: { top: 0, bottom: 140 },
    snap: [0, 70, 140],
    rubberband: true,
    onMove: (event) => track('Panel', event),
    onRelease: (event) => released('Panel', event),
    onSettle: (point) => (status.value = `Panel settled · ${Math.round(point.y)}`),
  })
})
</script>
<template>
  <StackLayout>
    <Label text="Fling the card · bounded decay" class="muted" />
    <GridLayout height="130" backgroundColor="#edf1e8" borderRadius="18" marginTop="8">
      <GridLayout
        ref="card"
        width="116"
        height="82"
        borderRadius="18"
        backgroundColor="#334b29"
        accessibilityLabel="Drag card"
      >
        <Label
          text="↔"
          fontSize="32"
          color="#c4f58b"
          horizontalAlignment="center"
          verticalAlignment="middle"
        />
      </GridLayout>
    </GridLayout>
    <Label text="Slide the panel · three snap points" class="muted" marginTop="14" />
    <GridLayout height="248" marginTop="8" backgroundColor="#e9edf4" borderRadius="18">
      <StackLayout
        ref="panel"
        width="248"
        height="88"
        verticalAlignment="top"
        borderRadius="18"
        backgroundColor="#243e61"
        accessibilityLabel="Drag panel"
        padding="16"
      >
        <GridLayout width="40" height="5" backgroundColor="#bdd6ff" borderRadius="3" />
        <Label
          text="Pull me up or down"
          color="white"
          horizontalAlignment="center"
          marginTop="14"
        />
      </StackLayout>
    </GridLayout>
    <Label :text="status" textWrap="true" marginTop="12" />
    <Button :text="paused ? 'Resume drag' : 'Pause drag'" @tap="toggle" />
  </StackLayout>
</template>
