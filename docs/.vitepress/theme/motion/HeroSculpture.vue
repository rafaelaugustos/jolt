<script setup lang="ts">
import { ref } from 'vue'
import { createChromeSculpture } from './chromeSculpture'
import { useWords } from './copy'
import { useMotion } from './useMotion'
import type { WebRuntime, WebMotionValue } from '../../../../src/web/public'

const { t } = useWords()
const region = ref<HTMLElement>()
const fallback = ref<HTMLElement>()
const turn = ref<HTMLElement>()
const input = ref<HTMLElement>()
let motion: WebRuntime | undefined
const canvas = ref<HTMLCanvasElement>()
const webgl = ref(false)
let rotation = 0
let spinValue: WebMotionValue | undefined
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
const { ready, reduced } = useMotion((runtime) => {
  motion = runtime
  const follow = runtime.pointerFollow(region.value!, {
    range: { x: [-0.38, 0.38], y: [-0.22, 0.22] },
    spring: { stiffness: 75, damping: 18 },
  })
  runtime.press(turn.value!, { scale: 0.94 }, { transition: 'bouncy' })
  runtime.animate(
    turn.value!,
    { scale: [0.8, 1], opacity: [0, 1] },
    { type: 'spring', bounce: 0.2, duration: 1500 },
  )
  runtime.observeGeometry(turn.value!)
  spinValue = runtime.motionValue(-0.8)
  runtime.animate(spinValue, 0, { type: 'spring', bounce: 0.12, duration: 2100 })
  const dragAngle = runtime.motionValue(0)
  runtime.drag(input.value!, {
    axis: 'x',
    value: dragAngle,
    release: 'decay',
    friction: 0.99,
    onMove: () => {
      if (input.value) input.value.dataset.dragPosition = String(dragAngle.get())
    },
  })
  const scroll = runtime.scrollValue()
  const sculptureRenderer = createChromeSculpture(canvas.value!, () => {
    webgl.value = false
    schedule()
  })
  webgl.value = !!sculptureRenderer
  let visible = true
  let frame = 0
  const draw = () => {
    frame = 0
    if (!visible || document.hidden) return
    const staticPose =
      reduced.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const x = staticPose ? 0 : follow.x.get()
    const y = staticPose ? 0 : follow.y.get()
    const travel = staticPose ? 0 : Math.min(scroll.get() / innerHeight, 1) * 0.45
    if (!webgl.value && fallback.value)
      fallback.value.style.transform = `rotate(${dragAngle.get() * 0.46 + x * 20}deg)`
    sculptureRenderer?.render(
      0.36 - y + travel,
      -0.38 + x + spinValue!.get() + dragAngle.get() * 0.008,
      -0.4,
    )
  }
  const schedule = () => {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw)
  }
  const subscriptions = [follow.x, follow.y, spinValue, dragAngle, scroll].map((value) =>
    value.subscribe(schedule),
  )
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible) schedule()
  })
  observer.observe(region.value!)
  const resize = new ResizeObserver(schedule)
  resize.observe(region.value!)
  document.addEventListener('visibilitychange', schedule)
  schedule()
  return () => {
    cancelAnimationFrame(frame)
    subscriptions.forEach((unsubscribe) => unsubscribe())
    observer.disconnect()
    resize.disconnect()
    document.removeEventListener('visibilitychange', schedule)
    sculptureRenderer?.dispose()
  }
})
function spin() {
  rotation += 1
  if (motion && turn.value && spinValue) {
    motion.animate(spinValue, rotation * Math.PI * 0.85, {
      type: 'spring',
      bounce: 0.3,
      duration: 1600,
    })
    motion.animate(
      turn.value,
      { rotate: rotation * 6 },
      { type: 'spring', bounce: 0.3, duration: 1600 },
    )
  }
}
</script>

<template>
  <div
    ref="region"
    class="hero-art"
    :data-motion-ready="ready"
    :data-renderer="webgl ? 'webgl' : 'svg'"
  >
    <div class="hero-art-grid" aria-hidden="true"></div>
    <span class="art-coordinate"
      >OBJECT 001 —
      {{
        t(['IN A STATE OF FLOW', 'EM ESTADO DE FLUXO', 'EN ESTADO DE FLUJO', '流动不息'])
      }}</span
    >
    <div class="hero-sculpture">
      <button
        ref="input"
        class="sculpture-input"
        :aria-label="
          t([
            'Drag or tap the sculpture to spin it',
            'Arraste ou toque na escultura para girar',
            'Arrastra o toca la escultura para girarla',
            '拖动或点击，让雕塑旋转',
          ])
        "
        @click="spin"
      >
        <span ref="turn" class="sculpture-turn">
          <canvas
            ref="canvas"
            class="chrome-canvas"
            :class="{ rendered: webgl }"
            aria-hidden="true"
          />
          <span ref="fallback" v-show="!webgl" class="sculpture-fallback">
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
          </span>
        </span>
      </button>
    </div>
    <div class="art-caption">
      <span class="art-cross" aria-hidden="true">↖</span
      ><span>{{
        t([
          'Drag it. Feel the momentum.',
          'Arraste. Sinta a inércia.',
          'Arrastra. Siente la inercia.',
          '拖动，感受惯性。',
        ])
      }}</span>
    </div>
    <span class="art-engine"><span class="live-dot"></span> JOLT WEB</span>
  </div>
</template>
