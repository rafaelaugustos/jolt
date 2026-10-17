<script lang="ts" setup>
import { type EventData, type PanGestureEventData, type View } from '@nativescript/core'
import { onBeforeUnmount, onMounted, ref } from 'nativescript-vue'
import Icon from './Icon.vue'
import { Motion, reducedMotion, viewOf } from './motion'
const emit = defineEmits<{ voice: []; interact: [] }>()
const tools = [
  { title: 'Convert', icon: 'arrow.triangle.2.circlepath', color: '#e9c6e2' },
  { title: 'Scan', icon: 'viewfinder', color: '#b8dbcd' },
  { title: 'Edit', icon: 'slider.horizontal.3', color: '#f1d89e' },
  { title: 'Add images', icon: 'photo.on.rectangle.angled', color: '#e8c6d1' },
  { title: 'Markup', icon: 'pencil.tip.crop.circle', color: '#d6c8e7' },
  { title: 'Backup', icon: 'icloud.and.arrow.up', color: '#c0d8e8' },
]
const selected = ref(1)
const ring = ref()
const fan = ref()
const motion = new Motion()
const carousel = new Motion()
const cards = new Map<number, View>()
const offsets = new Map<number, number>()
let width = 0
let entered = false
let panStart = 1
let greeted = false
const cardWidth = 144
function greet(event: EventData) {
  if (greeted) return
  greeted = true
  motion.text(event.object as View, { duration: 280, stagger: 23, delay: 120, y: 9 })
}
function offset(index: number) {
  return (
    ((index - selected.value + tools.length + tools.length / 2) % tools.length) -
    tools.length / 2
  )
}
function place(enter = false) {
  const host = viewOf(fan.value)
  const measured = host?.getActualSize().width ?? 0
  if (measured <= 0) return
  width = measured
  const step = Math.min(134, width * 0.335)
  for (const [index, card] of cards) {
    const delta = offset(index)
    const previous = offsets.get(index)
    const wrapped = previous !== undefined && Math.abs(delta - previous) > 3
    const arriving = wrapped && Math.abs(delta) <= 2
    // Wrap behind the fan instead of sending the hidden card across the screen.
    const end = wrapped && Math.abs(delta) > 2 ? Math.sign(previous!) * 3 : delta
    const start = Math.sign(delta) * 3
    offsets.set(index, delta)
    card.width = cardWidth
    card.left = (width - cardWidth) / 2
    card.top = 24
    card.style.zIndex = 10 - Math.abs(delta)
    carousel.play(
      card,
      {
        x: enter
          ? [delta * step * 0.7, delta * step]
          : arriving
            ? [start * step, end * step]
            : end * step,
        y: enter
          ? [110 + Math.abs(delta) * 16, delta * delta * 22]
          : arriving
            ? [198, end * end * 22]
            : end * end * 22,
        rotate: enter
          ? [delta * 24, delta * 16]
          : arriving
            ? [start * 16, end * 16]
            : end * 16,
        opacity: enter ? [0, Math.abs(delta) > 2 ? 0 : 1] : Math.abs(delta) > 2 ? 0 : 1,
        scale: enter ? [0.8, 1 - Math.abs(delta) * 0.04] : 1 - Math.abs(delta) * 0.04,
      },
      {
        type: 'spring',
        duration: enter ? 680 : 540,
        bounce: 0.16,
        delay: enter ? 160 + Math.abs(delta) * 45 : 0,
        opacity: { duration: enter ? 330 : 200 },
      },
    )
  }
}
function bind(index: number, event: EventData) {
  cards.set(index, event.object as View)
  if (cards.size === tools.length && !entered) {
    place(true)
    entered = width > 0
  }
}
function layout() {
  const measured = viewOf(fan.value)?.getActualSize().width ?? 0
  if (measured !== width) {
    carousel.cancel()
    place(!entered)
    entered = measured > 0
  }
}
function select(index: number, manual = true) {
  if (manual) emit('interact')
  selected.value = (index + tools.length) % tools.length
  place()
}
function pan(event: PanGestureEventData) {
  if (event.state === 1) {
    emit('interact')
    panStart = selected.value
  }
  // The current API can animate the snap; native gesture-linked transforms are a separate feature.
  if (event.state === 3 && Math.abs(event.deltaX) > 26)
    select(panStart + (event.deltaX < 0 ? 1 : -1))
}
onMounted(() => {
  if (!reducedMotion())
    motion.play(
      ring.value,
      { scale: [1, 1.055, 1], opacity: [0.75, 1, 0.75] },
      { duration: 2200, ease: 'easeInOut', repeat: Infinity },
    )
})
onBeforeUnmount(() => {
  motion.dispose()
  carousel.dispose()
  cards.clear()
  offsets.clear()
})
defineExpose({ select, selected })
</script>
<template>
  <GridLayout rows="*, 212, 94" class="assistant-home">
    <Label
      class="assistant-greeting"
      text="Hi Peter,&#10;How can I help&#10;you today?"
      textWrap="true"
      accessible="true"
      accessibilityRole="header"
      @layoutChanged="greet"
    />
    <AbsoluteLayout
      row="1"
      ref="fan"
      class="assistant-tools"
      iosIgnoreSafeArea="true"
      @layoutChanged="layout"
      @pan="pan"
    >
      <StackLayout
        v-for="(tool, index) in tools"
        :key="tool.title"
        class="assistant-tool-card"
        width="144"
        height="156"
        iosIgnoreSafeArea="true"
        accessible="true"
        accessibilityRole="button"
        :accessibilityLabel="`${tool.title}${index === selected ? ', selected' : ''}`"
        @loaded="bind(index, $event)"
        @tap="select(index)"
      >
        <GridLayout
          class="assistant-tool-icon"
          :backgroundColor="tool.color"
          iosIgnoreSafeArea="true"
          ><Icon :name="tool.icon" :size="27"
        /></GridLayout>
        <Label class="assistant-tool-title" :text="tool.title" />
      </StackLayout>
    </AbsoluteLayout>
    <GridLayout row="2" class="assistant-search-ring">
      <GridLayout ref="ring" class="assistant-search-halo" />
      <GridLayout
        class="assistant-dark-button assistant-search"
        accessible="true"
        accessibilityRole="button"
        accessibilityLabel="Start voice conversation"
        v-press="{ scale: 0.94 }"
        @tap="emit('voice')"
      >
        <Icon name="magnifyingglass" :size="26" color="#f9f5e9" />
      </GridLayout>
    </GridLayout>
  </GridLayout>
</template>
