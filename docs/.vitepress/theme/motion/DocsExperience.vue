<script setup lang="ts">
import { ref } from 'vue'
import { version } from '../../../../package.json'
import { useMotion } from './useMotion'
import { useWords } from './copy'

const root = ref<HTMLElement>()
const { t, link } = useWords()
const { ready } = useMotion((motion) => {
  const documentPage = root.value!.closest('.VPDoc')!
  const title = documentPage.querySelector<HTMLElement>('.vp-doc h1')
  if (title)
    motion.animate(
      title,
      { opacity: [0, 1], y: [14, 0] },
      { duration: 520, ease: 'easeOut' },
    )
  const line = root.value!.querySelector<HTMLElement>('.doc-reading-progress')!
  motion.scrollLinked(
    document,
    line,
    // Keep the transform invertible so WebKit interpolates rather than jumping.
    { scaleX: [0.001, 1] },
    {
      range: { element: documentPage as HTMLElement, start: 'start end', end: 'end end' },
    },
  )
})
</script>

<template>
  <div ref="root" class="doc-experience" :data-doc-motion-ready="ready">
    <div class="doc-context">
      <a :href="link('/guide/')"
        ><span aria-hidden="true">✳</span>
        {{
          t([
            'THE MOTION MANUAL',
            'O MANUAL DO MOVIMENTO',
            'EL MANUAL DEL MOVIMIENTO',
            '动效手册',
          ])
        }}</a
      >
      <a :href="link('/guide/release-history')">{{ version }} ↗</a>
    </div>
    <div class="doc-reading-track" aria-hidden="true">
      <div class="doc-reading-progress"></div>
    </div>
  </div>
</template>
