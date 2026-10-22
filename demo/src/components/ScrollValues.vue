<script setup lang="ts">
import { useBinding, useScrollValue } from '@rafaelaugusto/jolt/vue'

const offset = useScrollValue()
const header = useBinding({ y: offset.to([0, 90], [0, -64]) })
const title = useBinding({
  scale: offset.to([0, 90], [1, 0.72]),
  y: offset.to([0, 90], [0, 30]),
})
const subtitle = useBinding({ opacity: offset.to([0, 50], [1, 0]) })
const bar = useBinding({ scaleX: offset.to([0, 700], [0, 1]) })
const rows = Array.from({ length: 24 }, (_, i) => `Track ${i + 1}`)
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Scroll values" />
    <Label
      class="muted"
      textWrap="true"
      text="bind(header, { y: offset.to([0, 90], [0, -64]) })"
    />

    <GridLayout class="stage scroll-stage" height="320">
      <ScrollView :ref="offset.ref">
        <StackLayout class="scroll-list">
          <Label v-for="row in rows" :key="row" class="row" :text="row" />
        </StackLayout>
      </ScrollView>
      <GridLayout
        :ref="header"
        class="scroll-header"
        height="140"
        verticalAlignment="top"
      >
        <StackLayout verticalAlignment="bottom" class="scroll-titles">
          <Label :ref="title" class="scroll-title" text="Album" originX="0" originY="1" />
          <Label
            :ref="subtitle"
            class="scroll-subtitle"
            text="24 tracks · scroll the list"
          />
        </StackLayout>
        <Label
          :ref="bar"
          class="scroll-bar"
          height="3"
          verticalAlignment="bottom"
          originX="0"
          scaleX="0"
        />
      </GridLayout>
    </GridLayout>

    <Label
      class="note"
      textWrap="true"
      text="The header, title, subtitle and progress bar follow the list's offset, with one write per scroll event."
    />
  </StackLayout>
</template>
