<script setup lang="ts">
import { ref } from 'vue'
import { useWords } from './copy'
import { useMotion } from './useMotion'
import type { WebRuntime } from '../../../../src/web/public'

const { t } = useWords()
const region = ref<HTMLElement>()
const sculpture = ref<HTMLElement>()
const turn = ref<HTMLElement>()
let motion: WebRuntime | undefined
let rotation = 0
// A projected toroidal spring. Vector geometry stays sharp at every screen size.
const rings = Array.from({ length: 96 }, (_, i) => {
  const u = (i / 96) * Math.PI * 2
  let depth = 0
  const points = Array.from({ length: 73 }, (_, j) => {
    const v = (j / 72) * Math.PI * 2
    const x = (140 + 68 * Math.cos(v)) * Math.cos(u)
    const y = 68 * Math.sin(v)
    const z = (140 + 68 * Math.cos(v)) * Math.sin(u)
    const ry = y * 0.78 - z * 0.63
    const rz = y * 0.63 + z * 0.78
    const rx = x * 0.9 - ry * 0.43
    const yy = x * 0.43 + ry * 0.9
    const perspective = 700 / (700 - rz)
    depth += rz
    return `${(280 + rx * perspective).toFixed(2)},${(280 + yy * perspective).toFixed(2)}`
  })
  return { id: i, depth: depth / 73, d: `M${points.join(' L')}Z` }
}).sort((a, b) => a.depth - b.depth)
const { ready } = useMotion((runtime) => {
  motion = runtime
  const follow = runtime.pointerFollow(region.value!, {
    range: { x: [-26, 26], y: [-22, 22] },
    spring: { stiffness: 95, damping: 16 },
  })
  runtime.bind(sculpture.value!, { x: follow.x, y: follow.y })
  runtime.observeGeometry(sculpture.value!)
  runtime.press(turn.value!, { scale: 0.91 }, { transition: 'bouncy' })
  runtime.animate(
    turn.value!,
    { scale: [0.78, 1], rotate: [-24, 0], opacity: [0, 1] },
    { type: 'spring', bounce: 0.25, duration: 1400 },
  )
  runtime.observeGeometry(turn.value!)
})
function spin() {
  rotation += 90
  if (motion && turn.value)
    motion.animate(
      turn.value,
      { rotate: rotation },
      { type: 'spring', bounce: 0.45, duration: 1300 },
    )
}
</script>

<template>
  <div ref="region" class="hero-art" :data-motion-ready="ready">
    <div class="hero-art-grid" aria-hidden="true"></div>
    <span class="art-coordinate"
      >FIG. 001 —
      {{
        t(['ELASTIC ENERGY', 'ENERGIA ELÁSTICA', 'ENERGÍA ELÁSTICA', '弹性能量'])
      }}</span
    >
    <div ref="sculpture" class="hero-sculpture">
      <button
        ref="turn"
        class="sculpture-turn"
        :aria-label="
          t([
            'Spin the spring sculpture',
            'Girar a escultura de spring',
            'Girar la escultura de resorte',
            '旋转弹簧雕塑',
          ])
        "
        @click="spin"
      >
        <svg viewBox="0 0 560 560" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="spring-wire" x1=".2" y1="0" x2=".8" y2="1">
              <stop stop-color="#f6ffd0" />
              <stop offset=".3" stop-color="#d9ff43" />
              <stop offset=".6" stop-color="#87a51a" />
              <stop offset=".85" stop-color="#e8ff91" />
              <stop offset="1" stop-color="#485c0c" />
            </linearGradient>
          </defs>
          <path
            v-for="ring in rings"
            :key="ring.id"
            :d="ring.d"
            stroke="url(#spring-wire)"
            :stroke-width="ring.depth > 0 ? 2.15 : 1.45"
            :opacity="0.5 + (ring.depth + 170) / 680"
          />
        </svg>
      </button>
    </div>
    <div class="art-caption">
      <span class="art-cross" aria-hidden="true">↖</span
      ><span>{{
        t([
          'Go on. Give it a spin.',
          'Vai. Dá uma girada.',
          'Vamos. Dale una vuelta.',
          '试试，让它转起来。',
        ])
      }}</span>
    </div>
    <span class="art-engine"><span class="live-dot"></span> JOLT WEB</span>
  </div>
</template>
