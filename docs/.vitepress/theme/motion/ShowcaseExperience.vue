<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useMotion } from './useMotion'

const root = ref<HTMLElement>()
const { ready, reduced } = useMotion((motion) => {
  const page = root.value!
  const title = page.querySelector<HTMLElement>('.showcase-intro h1')!
  motion.animate(
    title,
    { opacity: [0, 1], y: [28, 0] },
    { duration: 800, ease: 'easeOut' },
  )
  for (const section of page.querySelectorAll<HTMLElement>('.showcase-feature')) {
    const stage = section.querySelector<HTMLElement>('.showcase-stage')!
    const range = { element: section, start: 'start end', end: 'end start' } as const
    motion.scrollLinked(document, stage, { y: [48, -48] }, { range })
    motion.observeGeometry(stage)
    const art = section.querySelector<HTMLElement>('.showcase-art')
    if (art) {
      motion.scrollLinked(document, art, { y: [-25, 55], rotate: [-12, -5] }, { range })
      motion.observeGeometry(art)
    }
  }
  const screens = page.querySelector<HTMLElement>('.drive-screens')!
  for (const [i, figure] of [
    ...screens.querySelectorAll<HTMLElement>('figure'),
  ].entries()) {
    motion.scrollLinked(
      document,
      figure,
      { y: [i === 1 ? 65 : 25, i === 1 ? -35 : -15] },
      {
        range: { element: screens, start: 'start end', end: 'end start' },
      },
    )
    motion.observeGeometry(figure)
  }
})
let observer: IntersectionObserver | undefined
let media: MediaQueryList | undefined
const visible = new Set<HTMLVideoElement>()
const videos = () => [
  ...(root.value?.querySelectorAll<HTMLVideoElement>('.clip video') || []),
]
function updatePlayback() {
  for (const video of videos()) {
    if (document.hidden || !visible.has(video)) video.pause()
    else if (!reduced.value && !media?.matches) void video.play().catch(() => {})
  }
}
function action(event: MouseEvent) {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-watch]')
  if (!button) return
  const section = root.value?.querySelector(`[aria-labelledby="${button.dataset.watch}"]`)
  const video = section?.querySelector<HTMLVideoElement>('video')
  if (!video) return
  video.scrollIntoView({
    block: 'center',
    behavior: reduced.value || media?.matches ? 'instant' : 'smooth',
  })
  // A direct play request is available even when automatic motion is reduced.
  void video.play().catch(() => {})
  video.focus({ preventScroll: true })
}
function preferenceChanged() {
  if (reduced.value || media?.matches) videos().forEach((video) => video.pause())
  else updatePlayback()
}
watch(reduced, preferenceChanged)
onMounted(() => {
  media = matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', preferenceChanged)
  document.addEventListener('visibilitychange', updatePlayback)
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement
        if (entry.isIntersecting) visible.add(video)
        else visible.delete(video)
      }
      updatePlayback()
    },
    { threshold: 0.2 },
  )
  videos().forEach((video) => observer!.observe(video))
})
onUnmounted(() => {
  videos().forEach((video) => video.pause())
  observer?.disconnect()
  media?.removeEventListener('change', preferenceChanged)
  document.removeEventListener('visibilitychange', updatePlayback)
})
</script>

<template>
  <article
    ref="root"
    class="showcase-exhibit vp-doc"
    :data-showcase-ready="ready"
    @click="action"
  >
    <slot />
  </article>
</template>
