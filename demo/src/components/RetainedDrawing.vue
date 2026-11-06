<script setup lang="ts">
import { onMounted, onUnmounted } from 'nativescript-vue'
import { useShape } from '@rafaelaugusto/jolt/vue'
const emit = defineEmits(['created', 'disposed'])
const drawing = useShape({
  d: 'M15 70 C15 10 85 10 85 70 C85 105 15 105 15 70 M30 55 L40 55 M60 55 L70 55 M35 75 Q50 90 65 75',
  viewBox: [0, 0, 100, 110],
  stroke: '#8B5CF6',
  strokeWidth: 3.5,
})
function replay() {
  const current = drawing.current
  if (!current) return
  current.set({
    d: 'M15 70 C15 10 85 10 85 70 C85 105 15 105 15 70 M30 55 L40 55 M60 55 L70 55 M35 75 Q50 90 65 75',
  })
  current.animate(
    {
      d: 'M15 65 C10 5 90 5 85 65 C85 105 15 105 15 65 M30 50 L40 60 M60 60 L70 50 M35 85 Q50 65 65 85',
    },
    { duration: 3500, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' },
  )
}
onMounted(() => {
  emit('created')
  replay()
})
onUnmounted(() => emit('disposed'))
defineExpose({
  snapshot: () => drawing.current?.snapshot(),
  pause: () => drawing.current?.suspend(),
  resume: () => drawing.current?.resume(),
})
</script>
<template>
  <GridLayout rows="*,auto" height="280">
    <GridLayout
      :ref="drawing.ref"
      width="240"
      height="230"
      automationText="retained-drawing"
    />
    <Button
      row="1"
      text="Replay drawing"
      automationText="resource-replay"
      @tap="replay"
    />
  </GridLayout>
</template>
