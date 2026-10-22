<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { animate } from '@rafaelaugusto/jolt'
import { useBinding, useMotionValue } from '@rafaelaugusto/jolt/vue'

const progress = useMotionValue(0)
const page = useBinding({ scale: progress.to([0, 1], [1, 0.92]) })
const backdrop = useBinding({ opacity: progress.to([0, 1], [0, 0.45]) })
const sheet = useBinding({ y: progress.to([0, 1], [200, 0]) })
const open = ref(false)

function toggle() {
  open.value = !open.value
  animate(progress, open.value ? 1 : 0, 'snappy')
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Motion values" />
    <Label
      class="muted"
      textWrap="true"
      text="bind(sheet, { y: progress.to([0, 1], [200, 0]) })"
    />

    <GridLayout class="stage values-stage" height="300">
      <GridLayout :ref="page" class="values-page">
        <Label class="values-title" text="Page" />
      </GridLayout>
      <GridLayout :ref="backdrop" class="values-backdrop" opacity="0" />
      <GridLayout
        :ref="sheet"
        class="values-sheet"
        height="180"
        verticalAlignment="bottom"
      >
        <Label class="values-handle" />
        <Label class="values-title" text="Sheet" />
      </GridLayout>
    </GridLayout>

    <Label
      class="note"
      textWrap="true"
      text="One value drives the page scale, the backdrop and the sheet on one native clock. Tap again mid-way and all three turn around together."
    />
    <Button class="button" :text="open ? 'Close sheet' : 'Open sheet'" @tap="toggle" />
  </StackLayout>
</template>
