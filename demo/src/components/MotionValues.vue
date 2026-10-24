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
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage" padding="0" clipToBounds="true" height="360"
      ><GridLayout :ref="page" backgroundColor="#DCE6CC" borderRadius="25" padding="25"
        ><Label
          text="THE WEEKEND EDIT"
          color="#6F7F5C"
          fontSize="9"
          letterSpacing=".12"
          verticalAlignment="top" /><Label
          text="Less rush.&#10;More room."
          class="ex-light-title"
          textWrap="true"
          verticalAlignment="middle" /><Label
          text="A FEW THINGS WORTH SAVING  ↗"
          color="#6F7F5C"
          fontSize="9"
          verticalAlignment="bottom" /></GridLayout
      ><GridLayout :ref="backdrop" backgroundColor="#101C15" opacity="0" /><GridLayout
        :ref="sheet"
        height="180"
        verticalAlignment="bottom"
        borderRadius="26"
        backgroundColor="#EDE4D8"
        padding="20"
        ><Label
          width="34"
          height="4"
          borderRadius="2"
          backgroundColor="#9F9E8F"
          verticalAlignment="top" /><StackLayout verticalAlignment="middle"
          ><Label
            text="Make it a slow day."
            fontSize="24"
            fontWeight="bold"
            color="#3F4A37" /><Label
            text="Saved to your weekend collection."
            fontSize="12"
            color="#7D826E"
            marginTop="12" /></StackLayout></GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="open ? 'Close sheet' : 'Open sheet'"
          @tap="toggle"
          class="ex-primary" /></GridLayout></StackLayout
    ><Label
      text="One movement connects the page, the shade and the sheet."
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
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
</template>
