<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { WebRuntime } from '../../../../src/web/public'
import { useMotion } from './useMotion'
import { useWords, type Words } from './copy'
import { performanceStudy as study, studySource } from './performanceStudy'

const { t, link, locale } = useWords()
const root = ref<HTMLElement>()
const bars = ref<HTMLElement[]>([])
const metric = ref<'cpu' | 'memory' | 'presentation'>('cpu')
const names: Record<typeof metric.value, Words> = {
  cpu: ['CPU time', 'Tempo de CPU', 'Tiempo de CPU', 'CPU 时间'],
  memory: ['Memory', 'Memória', 'Memoria', '内存'],
  presentation: [
    'Presentation wait',
    'Espera de apresentação',
    'Espera de presentación',
    '呈现等待',
  ],
}
const sample = computed(() => study[metric.value])
const format = (value: number, decimals = 2) =>
  new Intl.NumberFormat(locale.value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
const insight = computed(() =>
  metric.value === 'cpu'
    ? `−${format((1 - sample.value.jolt / sample.value.reanimated) * 100, 1)}%`
    : `+${format(sample.value.jolt - sample.value.reanimated)}`,
)
const explanation = computed(() =>
  metric.value === 'cpu'
    ? t([
        'less process CPU time in this test',
        'menos tempo de CPU do processo neste teste',
        'menos tiempo de CPU del proceso en esta prueba',
        '本次测试中进程 CPU 时间更少',
      ])
    : metric.value === 'memory'
      ? t([
          'MiB more post-run PSS in this test',
          'MiB a mais de PSS após este teste',
          'MiB más de PSS después de esta prueba',
          '本次测试后 PSS 增加的 MiB',
        ])
      : t([
          'ms more from frame ready to presentation',
          'ms a mais entre frame pronto e apresentação',
          'ms más entre frame listo y presentación',
          '帧就绪到呈现增加的毫秒数',
        ]),
)
const definition = computed(() =>
  metric.value === 'cpu'
    ? t([
        'Median process CPU time, all application threads, normalized to a 30-second run.',
        'Mediana do tempo de CPU de todas as threads da aplicação, normalizada para uma execução de 30 segundos.',
        'Mediana del tiempo de CPU de todos los hilos de la aplicación, normalizada a 30 segundos.',
        '应用全部线程的进程 CPU 时间中位数，归一化为 30 秒运行。',
      ])
    : metric.value === 'memory'
      ? t([
          'Median PSS snapshot after the run. This is not peak memory.',
          'Mediana do PSS após a execução. É uma fotografia da memória, não o pico.',
          'Mediana de PSS después de la ejecución; no es memoria máxima.',
          '运行结束后的 PSS 快照中位数，并非峰值内存。',
        ])
      : t([
          'Median of each run’s frame-ready → present p50. This is not touch latency.',
          'Mediana do p50 de frame pronto → apresentação de cada execução. Não é latência de toque.',
          'Mediana del p50 de cada ejecución entre frame listo y presentación. No es latencia táctil.',
          '各次运行帧就绪到呈现 p50 的中位数，并非触控延迟。',
        ]),
)
let motion: WebRuntime | undefined
let entered = false
function reveal() {
  if (!motion) return
  for (const bar of bars.value) motion.refresh(bar)
  motion.animate(
    bars.value,
    { scaleX: [0, 1] },
    { duration: 750, ease: 'easeOut', stagger: 90 },
  )
}
useMotion((runtime) => {
  motion = runtime
  runtime.set(bars.value, { scaleX: 1 })
  bars.value.forEach((bar) => runtime.observeGeometry(bar))
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !entered) {
        entered = true
        reveal()
        observer.disconnect()
      }
    },
    { threshold: 0.2 },
  )
  observer.observe(root.value!.querySelector('.evidence-panel')!)
  return () => observer.disconnect()
})
watch(metric, async () => {
  await nextTick()
  reveal()
})
const width = (value: number) =>
  `${(value / Math.max(sample.value.jolt, sample.value.reanimated)) * 92}%`
</script>

<template>
  <section
    id="performance"
    ref="root"
    class="motion-evidence section-shell"
    aria-labelledby="evidence-title"
  >
    <div class="evidence-heading">
      <div>
        <p class="eyebrow">
          03 / {{ t(['FIELD NOTES', 'NOTAS DE CAMPO', 'NOTAS DE CAMPO', '实测记录']) }}
        </p>
        <h2 id="evidence-title">
          {{ t(['Performance.', 'Desempenho.', 'Rendimiento.', '性能，']) }}<br /><em>{{
            t(['In the open.', 'Às claras.', 'A la vista.', '公开实测。'])
          }}</em>
        </h2>
      </div>
      <div class="evidence-intro">
        <span class="study-badge">{{
          t([
            'EXPLORATORY STUDY',
            'ESTUDO EXPLORATÓRIO',
            'ESTUDIO EXPLORATORIO',
            '探索性研究',
          ])
        }}</span>
        <p>
          {{
            t([
              'One animation. One real phone. A result you can inspect, including the trade-offs.',
              'Uma animação. Um aparelho real. Um resultado que você pode conferir, incluindo os pontos a melhorar.',
              'Una animación. Un teléfono real. Resultados que puedes revisar, incluidos los puntos a mejorar.',
              '一个动画，一台真机。结果与取舍，全部可查。',
            ])
          }}
        </p>
      </div>
    </div>
    <div class="evidence-panel">
      <div
        class="study-tabs"
        :aria-label="
          t(['Measured metric', 'Métrica medida', 'Métrica medida', '测量指标'])
        "
      >
        <button
          v-for="key in ['cpu', 'memory', 'presentation'] as const"
          :key="key"
          :data-metric="key"
          :aria-pressed="metric === key"
          @click="metric = key"
        >
          {{ t(names[key]) }}
        </button>
        <span>{{
          t([
            'DEFAULT COHORT',
            'CONFIGURAÇÃO PADRÃO',
            'CONFIGURACIÓN PREDETERMINADA',
            '默认配置组',
          ])
        }}</span>
      </div>
      <div class="study-result" aria-live="polite" aria-atomic="true">
        <div class="study-insight">
          <span class="study-delta">{{ insight }}</span>
          <p>{{ explanation }}</p>
          <span class="study-comparison"
            >NativeScript + Jolt<br />vs. React Native + Reanimated</span
          >
        </div>
        <figure class="study-chart">
          <div
            v-for="(app, index) in ['jolt', 'reanimated'] as const"
            :key="app"
            class="study-row"
          >
            <div class="study-row-heading">
              <span>{{
                app === 'jolt' ? 'NativeScript + Jolt' : 'React Native + Reanimated'
              }}</span
              ><strong :data-value="app"
                >{{ format(sample[app]) }} <small>{{ sample.unit }}</small></strong
              >
            </div>
            <div class="study-track">
              <div
                :ref="
                  (el) => {
                    if (el) bars[index] = el as HTMLElement
                  }
                "
                class="study-bar"
                :class="app"
                :style="{ width: width(sample[app]) }"
              ></div>
            </div>
          </div>
          <figcaption>{{ definition }}</figcaption>
        </figure>
      </div>
      <div class="study-protocol">
        <span>{{ study.device }} · {{ study.os }}</span
        ><span>{{
          t([
            '5 alternating pairs · 30 s per run · release apps',
            '5 pares alternados · 30 s por execução · apps release',
            '5 pares alternados · 30 s por ejecución · apps release',
            '5 组交替测试 · 每次 30 秒 · release 应用',
          ])
        }}</span>
      </div>
    </div>
    <div class="evidence-context">
      <div>
        <span class="context-index">01</span>
        <h3>
          {{
            t([
              'A deliberately small test.',
              'Um teste de escopo pequeno.',
              'Una prueba de alcance pequeño.',
              '刻意限定的测试。',
            ])
          }}
        </h3>
        <p>
          {{
            t([
              'One 48 × 48 tile, moving and changing opacity. These numbers compare the complete apps on this phone; they do not establish battery savings or an Android-wide ranking.',
              'Um bloco de 48 × 48, com movimento e mudança de opacidade. Os números comparam as aplicações completas neste aparelho; não comprovam economia de bateria nem uma classificação geral no Android.',
              'Un bloque de 48 × 48 con movimiento y opacidad. Se comparan las aplicaciones completas en este teléfono; no demuestra ahorro de batería ni una clasificación general en Android.',
              '一个 48 × 48 方块，改变位置与透明度。数据比较此设备上的完整应用，不代表节电效果或 Android 平台整体排名。',
            ])
          }}
        </p>
      </div>
      <div>
        <span class="context-index">02</span>
        <h3>
          {{
            t([
              'The trade-offs stay visible.',
              'Os limites também aparecem.',
              'Los límites también se muestran.',
              '取舍同样公开。',
            ])
          }}
        </h3>
        <p>
          {{
            t([
              'Default Jolt used more post-run PSS and had a longer presentation wait. In a separate V8 size-profile probe, blocking app JavaScript produced median maximum gaps of 309.13 ms versus 17.06 ms for Reanimated. Launch failures remain unresolved.',
              'O Jolt padrão usou mais PSS e teve maior espera de apresentação. Em um teste separado com perfil V8 size, bloquear o JavaScript gerou medianas dos maiores intervalos de 309,13 ms, contra 17,06 ms no Reanimated. Falhas de inicialização seguem sem causa esclarecida.',
              'Jolt predeterminado usó más PSS y tuvo mayor espera de presentación. En una prueba separada con perfil V8 size, bloquear JavaScript produjo medianas de intervalos máximos de 309,13 ms frente a 17,06 ms de Reanimated. Hay fallos de inicio sin causa resuelta.',
              '默认 Jolt 的运行后 PSS 与呈现等待更高。另一个 V8 size 配置测试中，阻塞应用 JS 后最大间隔的中位数为 309.13 ms，Reanimated 为 17.06 ms。启动失败原因仍未确定。',
            ])
          }}
        </p>
      </div>
    </div>
    <div class="evidence-links">
      <a class="study-primary-link" :href="link('/guide/performance-study')"
        >{{
          t([
            'Explore the study & recordings',
            'Explore o estudo e as gravações',
            'Explora el estudio y las grabaciones',
            '查看研究与录屏',
          ])
        }}
        <span aria-hidden="true">↗</span></a
      ><a :href="studySource"
        >{{
          t([
            'Protocol & raw evidence',
            'Protocolo e dados originais',
            'Protocolo y datos originales',
            '协议与原始数据',
          ])
        }}
        ↗</a
      ><a :href="study.pullRequest">{{
        t([
          'Snapshot: 03 Nov 2026 · PR #395 open at capture',
          'Retrato de 03 nov 2026 · PR #395 aberto na captura',
          'Datos del 03 nov 2026 · PR #395 abierto al capturar',
          '2026-11-03 快照 · 采集时 PR #395 尚未合并',
        ])
      }}</a>
    </div>
  </section>
</template>
