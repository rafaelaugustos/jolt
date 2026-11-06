<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { labels, useWords } from './copy'
import { experiments } from './lab'
import { familyNames, type Family } from './lab/types'
import LabStage from './lab/LabStage.vue'
import './lab/playground.css'

const { t, link, locale } = useWords()
const selected = ref('spring')
const category = ref<Family | 'all'>('all')
const query = ref('')
const ready = ref(false)
const copied = ref(false)
const copyFailed = ref(false)
const active = computed(() => experiments.find((item) => item.id === selected.value)!)
const families = Object.keys(familyNames) as Family[]
const matches = computed(() =>
  experiments.filter(
    (item) =>
      (category.value === 'all' || item.family === category.value) &&
      `${t(item.title)} ${item.title[0]} ${item.apis.join(' ')} ${t(familyNames[item.family])}`
        .toLocaleLowerCase()
        .includes(query.value.trim().toLocaleLowerCase()),
  ),
)
const code = computed(
  () =>
    `import { createWebRuntime${selected.value === 'gallery' ? ', resolveListTarget' : ''} } from '@rafaelaugusto/jolt/web'\n\n// ${t(['Inside your mounted component, with its DOM refs:', 'Dentro do componente montado, com suas refs DOM:', 'Dentro del componente montado, con sus refs DOM:', '在已挂载组件内，使用其 DOM 引用：'])}\nconst motion = createWebRuntime(document)\nconst scope = motion.scope()\n\n${active.value.code}\n\n// ${t(['On component teardown: scope.dispose(); motion.dispose()', 'Ao desmontar o componente: scope.dispose(); motion.dispose()', 'Al desmontar el componente: scope.dispose(); motion.dispose()', '组件卸载时：scope.dispose(); motion.dispose()'])}`,
)
function select(id: string) {
  selected.value = id
  copied.value = false
  copyFailed.value = false
  const url = new URL(location.href)
  url.searchParams.set('play', id)
  url.hash = 'playground'
  history.replaceState(history.state, '', url)
}
onMounted(() => {
  const id = new URL(location.href).searchParams.get('play')
  if (experiments.some((item) => item.id === id)) selected.value = id!
})
async function copy() {
  try {
    await navigator.clipboard.writeText(code.value)
    copied.value = true
    copyFailed.value = false
  } catch {
    copyFailed.value = true
  }
}
</script>
<template>
  <section
    id="playground"
    class="motion-lab section-shell lab-catalog"
    :data-motion-ready="ready"
  >
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
            'Every side of Jolt Web. Yours to play with.',
            'Todos os lados do Jolt Web. Seus para explorar.',
            'Todos los lados de Jolt Web. Tuyos para explorar.',
            '探索 Jolt Web 的每一面。',
          ])
        }}
        <span class="lab-count"
          >{{ experiments.length }}
          {{
            t([
              'experiments. One playground.',
              'experimentos. Um playground.',
              'experimentos. Un playground.',
              '个实验，一个游乐场。',
            ])
          }}</span
        >
      </p>
    </div>
    <div class="lab-filterbar">
      <div
        class="lab-families"
        :aria-label="t(['Categories', 'Categorias', 'Categorías', '分类'])"
      >
        <button :aria-pressed="category === 'all'" @click="category = 'all'">
          {{ t(['All', 'Tudo', 'Todo', '全部']) }}
          <span>{{ experiments.length }}</span></button
        ><button
          v-for="family in families"
          :key="family"
          :data-family="family"
          :aria-pressed="category === family"
          @click="category = family"
        >
          {{ t(familyNames[family]) }}
        </button>
      </div>
      <label class="lab-search"
        ><span aria-hidden="true">⌕</span
        ><input
          v-model="query"
          type="search"
          :placeholder="
            t([
              'Find an experiment…',
              'Encontre um experimento…',
              'Busca un experimento…',
              '寻找实验…',
            ])
          "
          :aria-label="
            t([
              'Search experiments',
              'Buscar experimentos',
              'Buscar experimentos',
              '搜索实验',
            ])
          "
      /></label>
    </div>
    <div class="lab-workbench">
      <div class="lab-browser">
        <div class="lab-browser-label">
          {{ t(['THE COLLECTION', 'A COLEÇÃO', 'LA COLECCIÓN', '实验集']) }}
          <span>{{ matches.length.toString().padStart(2, '0') }}</span>
        </div>
        <div class="lab-tabs" :aria-label="t(labels.playground)">
          <button
            v-for="item in matches"
            :key="item.id"
            :data-experiment="item.id"
            :aria-pressed="selected === item.id"
            @click="select(item.id)"
          >
            <span class="lab-item-number">{{
              String(experiments.indexOf(item) + 1).padStart(2, '0')
            }}</span
            ><span>{{ t(item.title) }}</span
            ><span class="lab-item-arrow" aria-hidden="true">↗</span>
          </button>
          <p v-if="!matches.length" class="lab-empty">
            {{
              t([
                'No match. Try an API name or another category.',
                'Nada por aqui. Tente uma API ou outra categoria.',
                'Sin resultados. Prueba una API u otra categoría.',
                '没有结果，请尝试 API 名或其他分类。',
              ])
            }}
          </p>
        </div>
      </div>
      <div class="lab-interactive">
        <div class="lab-demo-heading">
          <div>
            <span>{{ t(familyNames[active.family]) }}</span>
            <h3>{{ t(active.title) }}</h3>
          </div>
          <span class="lab-live"><i class="live-dot"></i> LIVE</span>
        </div>
        <LabStage
          :key="`${locale}-${active.id}`"
          :experiment="active"
          @ready="ready = $event"
        />
      </div>
      <div class="lab-code">
        <div class="code-topline">
          <span>{{ active.id }}.ts</span
          ><button class="lab-copy" @click="copy">
            {{ t(copied ? labels.copied : labels.copy) }}
          </button>
        </div>
        <div class="code-content">
          <p class="code-comment">
            //
            {{
              t([
                'Make it your own.',
                'Faça do seu jeito.',
                'Hazlo tuyo.',
                '创造自己的版本。',
              ])
            }}
          </p>
          <pre tabindex="0"><code>{{ code }}</code></pre>
          <p v-if="copyFailed" role="status">{{ t(labels.copyFailed) }}</p>
        </div>
        <a :href="link(`/guide/${active.guide.split('#')[0]}`)"
          >{{
            t([
              'API guide & limits',
              'Guia da API e limites',
              'Guía de API y límites',
              'API 指南与限制',
            ])
          }}
          <span aria-hidden="true">↗</span></a
        >
      </div>
    </div>
    <p class="lab-footnote">
      {{
        t([
          'Real Jolt Web, running on this page. Device features report actual browser support.',
          'Jolt Web de verdade, rodando nesta página. Os recursos do dispositivo mostram o suporte real do navegador.',
          'Jolt Web real, ejecutándose aquí. Las funciones del dispositivo muestran el soporte real del navegador.',
          '本页运行真实 Jolt Web，设备功能报告实际浏览器支持。',
        ])
      }}
      <a :href="link('/guide/web-playground')">{{
        t([
          'Explore the collection ↗',
          'Conheça a coleção ↗',
          'Conoce la colección ↗',
          '探索实验集 ↗',
        ])
      }}</a>
    </p>
  </section>
</template>
