<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import { reduceMotionKey } from './preferences'

const props = withDefaults(
  defineProps<{
    name: string
    poster?: string
    caption: string
    controls?: boolean
    preview?: boolean
  }>(),
  { controls: true, preview: false },
)
const element = ref<HTMLVideoElement>()
const loaded = ref(!props.preview)
const reduced = inject(reduceMotionKey, ref(false))
let observer: IntersectionObserver | undefined
let media: MediaQueryList | undefined
let wanted = false
function stop() {
  element.value?.pause()
}
function play() {
  wanted = true
  if (reduced.value || media?.matches || !props.preview) return
  loaded.value = true
  requestAnimationFrame(() => {
    if (wanted) void element.value?.play().catch(() => {})
  })
}
function leave() {
  wanted = false
  stop()
}
function visibility() {
  if (document.hidden) stop()
}
watch(reduced, (value) => {
  if (value) stop()
})
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', stop)
  document.addEventListener('visibilitychange', visibility)
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries[0]?.isIntersecting) leave()
    },
    { threshold: 0.1 },
  )
  if (element.value) observer.observe(element.value)
})
onUnmounted(() => {
  leave()
  observer?.disconnect()
  media?.removeEventListener('change', stop)
  document.removeEventListener('visibilitychange', visibility)
})
defineExpose({ play, leave })
</script>

<template>
  <video
    ref="element"
    :src="loaded ? withBase(`/media/${name}.mp4`) : undefined"
    :poster="withBase(poster || `/recipes/${name}.jpg`)"
    :aria-label="caption"
    :controls="controls"
    :muted="preview"
    :loop="preview"
    playsinline
    preload="none"
    @pointerenter="play"
    @pointerleave="preview && leave()"
  />
</template>
