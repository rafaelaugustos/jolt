<script setup lang="ts">
import { onMounted, ref } from 'nativescript-vue'
import { animate, bind } from '@rafaelaugusto/jolt'
import { useBinding, useMotionScope, useMotionValue } from '@rafaelaugusto/jolt/vue'
defineEmits<{ back: [] }>()

const closed = 380
const stops: Record<number, string> = {
  0: 'Open',
  [closed / 2]: 'Half way',
  [closed]: 'Closed',
}
const y = useMotionValue(closed)
const progress = y.to([closed, 0], [0, 1])
const page = useBinding({
  scale: progress.to([0, 1], [1, 0.9]),
  y: progress.to([0, 1], [0, -14]),
})
const backdrop = useBinding({ opacity: progress.to([0, 1], [0, 0.5]) })
const hint = useBinding({ opacity: y.to([closed, closed / 2], [1, 0]) })
const scope = useMotionScope()
const sheet = ref()
const status = ref('Closed')

onMounted(() => {
  scope.use(() => bind(sheet.value, { y }))
  scope.drag(sheet.value, {
    axis: 'y',
    value: y,
    bounds: { top: 0, bottom: closed },
    snap: [0, closed / 2, closed],
    rubberband: true,
    onStart: () => (status.value = 'Dragging'),
    onRelease: ({ target }) => (status.value = stops[target.y]!),
  })
})

function toggle() {
  const to = y.get() > closed / 2 ? 0 : closed
  status.value = stops[to]!
  animate(y, to, 'snappy')
}
</script>

<template>
  <GridLayout rows="auto,*,auto" padding="12 20" backgroundColor="white">
    <GridLayout columns="auto,*">
      <Button text="Back" @tap="$emit('back')" />
      <Label col="1" text="Drag values" class="heading" verticalAlignment="middle" />
    </GridLayout>

    <GridLayout row="1" class="stage values-stage" marginTop="8">
      <StackLayout :ref="page" class="values-page drag-values-page">
        <Label class="drag-values-title" text="Library" />
        <Label v-for="row in 5" :key="row" class="drag-values-row" />
      </StackLayout>
      <GridLayout :ref="backdrop" class="values-backdrop" opacity="0" />
      <GridLayout
        ref="sheet"
        class="values-sheet"
        height="520"
        verticalAlignment="bottom"
        accessibilityLabel="Drag sheet"
      >
        <StackLayout verticalAlignment="top">
          <Label class="values-handle" />
          <Label :ref="hint" class="drag-values-hint" text="Pull the sheet up" />
          <Label class="values-title drag-values-sheet-title" text="Now playing" />
          <Label v-for="row in 3" :key="row" class="drag-values-track" />
        </StackLayout>
      </GridLayout>
    </GridLayout>

    <GridLayout row="2" columns="*,auto" marginTop="8">
      <Label :text="status" class="muted" verticalAlignment="middle" />
      <Button col="1" class="button" padding="10 18" text="Toggle sheet" @tap="toggle" />
    </GridLayout>
  </GridLayout>
</template>
