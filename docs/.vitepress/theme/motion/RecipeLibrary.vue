<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { categoryNames, recipes, type Category } from './recipes'
import { labels, useWords } from './copy'
import RecipeGrid from './RecipeGrid.vue'

const { t } = useWords()
const query = ref('')
const category = ref<Category | 'All'>('All')
function resetFilters() {
  query.value = ''
  category.value = 'All'
}
const categories = ['All', ...Object.keys(categoryNames)] as const
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
const filtered = computed(() =>
  recipes.filter(
    (recipe) =>
      (category.value === 'All' || recipe.category === category.value) &&
      normalize(
        [
          ...recipe.title,
          ...recipe.description,
          recipe.category,
          recipe.platform,
          recipe.project?.name || '',
        ].join(' '),
      ).includes(normalize(query.value.trim())),
  ),
)
onMounted(() => {
  const params = new URLSearchParams(location.search)
  query.value = params.get('q') || ''
  const value = params.get('category')
  if (value && value in categoryNames) category.value = value as Category
})
watch([query, category], () => {
  const params = new URLSearchParams()
  if (query.value) params.set('q', query.value)
  if (category.value !== 'All') params.set('category', category.value)
  history.replaceState(
    history.state,
    '',
    `${location.pathname}${params.size ? `?${params}` : ''}`,
  )
})
</script>

<template>
  <section class="recipe-library section-shell">
    <div class="library-intro">
      <p class="eyebrow">
        THE JOLT COLLECTION / 001—{{ String(recipes.length).padStart(3, '0') }}
      </p>
      <h1>
        {{
          t([
            'Find your next',
            'Encontre seu próximo',
            'Encuentra tu próximo',
            '找到下一个',
          ])
        }}<br /><em>{{
          t([
            '“how did they do that?”.',
            '“como fizeram isso?”.',
            '«¿cómo hicieron eso?».',
            '“这是怎么做到的？”',
          ])
        }}</em>
      </h1>
      <p>
        {{
          t([
            'Watch it move. Explore the code. Make it yours.',
            'Veja o movimento. Explore o código. Crie do seu jeito.',
            'Mira el movimiento. Explora el código. Hazlo tuyo.',
            '观看动效，探索代码，创造自己的版本。',
          ])
        }}
      </p>
    </div>
    <div class="library-toolbar">
      <div
        class="recipe-filters"
        :aria-label="
          t([
            'Filter by category',
            'Filtrar por categoria',
            'Filtrar por categoría',
            '按类别筛选',
          ])
        "
      >
        <button
          v-for="item in categories"
          :key="item"
          :aria-pressed="category === item"
          @click="category = item as Category | 'All'"
        >
          {{ item === 'All' ? t(labels.all) : t(categoryNames[item as Category]) }}
        </button>
      </div>
      <label class="recipe-search"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" /></svg
        ><span class="sr-only">{{
          t(['Search recipes', 'Buscar receitas', 'Buscar recetas', '搜索配方'])
        }}</span
        ><input
          v-model="query"
          type="search"
          :placeholder="
            t([
              'Find your feeling…',
              'Encontre seu movimento…',
              'Encuentra tu movimiento…',
              '寻找你的动效…',
            ])
          "
      /></label>
    </div>
    <div class="library-results">
      <span role="status"
        >{{ filtered.length }} {{ t(['recipes', 'receitas', 'recetas', '个配方']) }}</span
      ><span>{{
        t([
          'NATIVE RECORDINGS · REAL CODE',
          'GRAVAÇÕES NATIVAS · CÓDIGO REAL',
          'GRABACIONES NATIVAS · CÓDIGO REAL',
          '原生录屏 · 真实代码',
        ])
      }}</span>
    </div>
    <RecipeGrid :items="filtered" />
    <div v-if="!filtered.length" class="recipe-empty">
      <h2>
        {{
          t([
            'No motion found. Yet.',
            'Nenhum movimento por aqui.',
            'No encontramos movimiento.',
            '暂未找到动效。',
          ])
        }}
      </h2>
      <p>
        {{
          t([
            'Try a different word or explore every category.',
            'Tente outra palavra ou explore todas as categorias.',
            'Prueba otra palabra o explora todas las categorías.',
            '换个关键词，或探索所有类别。',
          ])
        }}
      </p>
      <button class="button-acid" @click="resetFilters">
        {{ t(['Reset filters', 'Limpar filtros', 'Borrar filtros', '清除筛选']) }} ↗
      </button>
    </div>
    <div class="library-note">
      <span class="live-dot"></span>
      <p>
        {{
          t([
            'Each preview is an actual native recording. Open a recipe for capture details, the core API example and the complete demo.',
            'Cada preview é uma gravação nativa real. Abra a receita para ver os detalhes da captura, o exemplo da API e a demo completa.',
            'Cada preview es una grabación nativa real. Abre la receta para ver los detalles de captura, el ejemplo de API y la demo completa.',
            '每个预览都是真实原生录屏。打开配方，查看录制详情、核心 API 示例和完整演示。',
          ])
        }}
      </p>
    </div>
  </section>
</template>
