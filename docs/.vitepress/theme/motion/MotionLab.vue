<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { labels, useWords } from './copy'
import { useMotion } from './useMotion'
import type { WebRuntime, WebMotionScope } from '../../../../src/web/public'

const { t, link } = useWords()
const stage = ref<HTMLElement>()
const tile = ref<HTMLElement>()
const mode = ref<'spring' | 'stagger' | 'drag'>('spring')
const bounce = ref(0.4)
let runtime: WebRuntime | undefined
let owner: WebMotionScope | undefined
let direction = false
const { ready } = useMotion((motion) => {
  runtime = motion
  attach()
  return () => owner?.dispose()
})
function attach() {
  owner?.dispose()
  if (!runtime || !tile.value || !stage.value) return
  owner = runtime.scope()
  if (mode.value === 'drag') {
    const limit = Math.max(32, Math.min(140, (stage.value.clientWidth - 120) / 2))
    owner.drag(tile.value, {
      bounds: { left: -limit, right: limit, top: -65, bottom: 65 },
      snap: { x: [0], y: [0] },
      spring: { bounce: 0.4, duration: 650 },
      rubberband: true,
    })
  } else if (mode.value === 'spring') {
    owner.press(tile.value, { scale: 0.88 }, { transition: 'bouncy' })
  }
}
async function select(value: typeof mode.value) {
  owner?.dispose()
  if (tile.value) runtime?.release(tile.value)
  stage.value
    ?.querySelectorAll<HTMLElement>('.stagger-block')
    .forEach((el) => runtime?.release(el))
  mode.value = value
  direction = false
  await nextTick()
  attach()
}
function replay() {
  if (!runtime || !stage.value || !tile.value) return
  if (mode.value === 'stagger') {
    const blocks = [...stage.value.querySelectorAll<HTMLElement>('.stagger-block')]
    owner?.animate(
      blocks,
      { y: [44, 0], scale: [0.65, 1], opacity: [0.15, 1] },
      { type: 'spring', bounce: 0.35, duration: 650, stagger: 70 },
    )
  } else if (mode.value === 'spring') {
    direction = !direction
    const distance = Math.min(115, (stage.value.clientWidth - 110) / 2)
    owner?.animate(
      tile.value,
      { x: direction ? distance : -distance, rotate: direction ? 12 : -12 },
      { type: 'spring', bounce: Number(bounce.value), duration: 800 },
    )
  } else {
    owner?.dispose()
    runtime.set(tile.value, { x: 0, y: 0 })
    attach()
  }
}
const code = computed(() =>
  mode.value === 'spring'
    ? `motion.animate(card,\n  { x: 120, rotate: 12 },\n  { type: 'spring', bounce: ${Number(bounce.value).toFixed(2)}, duration: 800 }\n)`
    : mode.value === 'stagger'
      ? `motion.animate(cards,\n  { y: [44, 0], opacity: [0, 1] },\n  { type: 'spring', bounce: 0.35, stagger: 70 }\n)`
      : `motion.drag(card, {\n  bounds: { left: -140, right: 140 },\n  snap: { x: [0], y: [0] },\n  rubberband: true\n})`,
)
</script>

<template>
  <section id="playground" class="motion-lab section-shell" :data-motion-ready="ready">
    <div class="section-heading">
      <div>
        <p class="eyebrow">
          <span class="live-dot"></span>
          {{
            t([
              'LESS WATCHING. MORE PLAYING.',
              'MENOS ASSISTIR. MAIS EXPERIMENTAR.',
              'MENOS MIRAR. MÁS JUGAR.',
              '亲手体验，感受不同。',
            ])
          }}
        </p>
        <h2>
          {{
            t([
              'You have to feel it.',
              'Você precisa sentir.',
              'Tienes que sentirlo.',
              '动手才能感受。',
            ])
          }}
        </h2>
      </div>
      <p>
        {{
          t([
            'Real Jolt. Right here in your browser. Go ahead, interrupt it.',
            'Jolt de verdade. Aqui no navegador. Pode interromper à vontade.',
            'Jolt real. Aquí en tu navegador. Adelante, interrúmpelo.',
            '真正的 Jolt，就在浏览器中。随时打断它。',
          ])
        }}
      </p>
    </div>
    <div class="lab-body">
      <div class="lab-interactive">
        <div class="lab-tabs" :aria-label="t(labels.playground)">
          <button
            v-for="item in ['spring', 'stagger', 'drag'] as const"
            :key="item"
            :aria-pressed="mode === item"
            @click="select(item)"
          >
            {{
              item === 'spring'
                ? 'Spring'
                : item === 'stagger'
                  ? 'Stagger'
                  : 'Drag & snap'
            }}
          </button>
        </div>
        <div ref="stage" class="lab-stage">
          <div class="lab-axis" aria-hidden="true"></div>
          <div v-if="mode === 'stagger'" class="stagger-blocks">
            <div
              v-for="i in 7"
              :key="i"
              class="stagger-block"
              :style="{ height: `${45 + Math.sin(i * 0.8) * 35 + i * 8}px` }"
            ></div>
          </div>
          <button
            ref="tile"
            class="lab-tile"
            :class="{ 'tile-hidden': mode === 'stagger', draggable: mode === 'drag' }"
            :aria-label="
              t([
                'Animate the tile',
                'Animar o bloco',
                'Animar el bloque',
                '让方块动起来',
              ])
            "
            @click="mode !== 'drag' && replay()"
          >
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M18 2 5 18h10l-2 12L28 12H18l4-10Z" fill="currentColor" />
            </svg>
          </button>
          <span class="lab-hint">{{
            mode === 'drag'
              ? t([
                  'Drag it. Let go.',
                  'Arraste. Solte.',
                  'Arrastra. Suelta.',
                  '拖动，然后松手。',
                ])
              : t([
                  'Tap. Replay. Interrupt.',
                  'Toque. Repita. Interrompa.',
                  'Toca. Repite. Interrumpe.',
                  '点击、重播、打断。',
                ])
          }}</span>
        </div>
        <div class="lab-controls">
          <label v-if="mode === 'spring'" for="bounce"
            >{{ t(['Bounce', 'Elasticidade', 'Rebote', '弹性'])
            }}<input
              id="bounce"
              v-model="bounce"
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              @input="replay"
            /><output for="bounce">{{ Number(bounce).toFixed(2) }}</output></label
          ><span v-else class="lab-live"
            ><span class="live-dot"></span>
            {{
              t([
                'Live browser interaction',
                'Interação real no navegador',
                'Interacción real en el navegador',
                '浏览器实时交互',
              ])
            }}</span
          ><button class="replay-button" :disabled="!ready" @click="replay">
            {{
              mode === 'drag'
                ? t(['Reset', 'Reiniciar', 'Reiniciar', '重置'])
                : t(['Replay', 'Repetir', 'Repetir', '重播'])
            }}
            <span aria-hidden="true">↻</span>
          </button>
        </div>
      </div>
      <div class="lab-code">
        <div class="code-topline">
          <span><i></i><i></i><i></i></span><span>motion.ts</span><span>JOLT WEB</span>
        </div>
        <div class="code-content">
          <p class="code-comment">
            //
            {{
              t([
                'A little code. A lot of character.',
                'Pouco código. Muita personalidade.',
                'Poco código. Mucha personalidad.',
                '少量代码，丰富表现。',
              ])
            }}
          </p>
          <pre><code><span class="code-purple">import</span> { createWebRuntime }
  <span class="code-purple">from</span> <span class="code-green">'@rafaelaugusto/jolt/web'</span>

<span class="code-purple">const</span> motion = createWebRuntime(document)

{{ code }}

<span class="code-comment">// {{ t(['On teardown:', 'Ao desmontar:', 'Al desmontar:', '卸载时：']) }}</span>
motion.dispose()</code></pre>
        </div>
        <a :href="link('/guide/web-runtime')"
          >{{
            t([
              'Explore the Web API',
              'Explore a API Web',
              'Explora la API Web',
              '探索 Web API',
            ])
          }}
          <span aria-hidden="true">↗</span></a
        >
      </div>
    </div>
    <p class="lab-footnote">
      {{
        t([
          'Powered by the experimental Jolt Web runtime. Native recordings are labeled separately.',
          'Feito com o runtime experimental Jolt Web. As gravações nativas estão identificadas separadamente.',
          'Creado con el runtime experimental Jolt Web. Las grabaciones nativas se identifican por separado.',
          '由实验性 Jolt Web 运行时驱动。原生录屏另有标注。',
        ])
      }}
    </p>
  </section>
</template>
