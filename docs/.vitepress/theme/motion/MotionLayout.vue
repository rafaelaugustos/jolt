<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import OrbitSignature from '../OrbitSignature.vue'
import { labels, useWords } from './copy'
import { reduceMotionKey } from './preferences'

const { frontmatter } = useData()
const route = useRoute()
const { locale, t, link } = useWords()
const menu = ref(false)
const reduced = ref(false)
provide(reduceMotionKey, reduced)
watch(
  () => route.path,
  () => {
    menu.value = false
  },
)
onMounted(() => {
  try {
    reduced.value = localStorage.getItem('jolt-reduce-motion') === 'true'
  } catch {
    /* optional preference */
  }
})
watch(reduced, (value) => {
  try {
    localStorage.setItem('jolt-reduce-motion', String(value))
  } catch {
    /* private browsing */
  }
})
const localizedPath = computed(() =>
  route.path.replace(/^\/(pt-BR|es|zh-Hans)(?=\/)/, ''),
)
function changeLanguage(event: Event) {
  const language = (event.target as HTMLSelectElement).value
  window.location.assign(
    `${language === 'en' ? '' : `/${language}`}${localizedPath.value}`,
  )
}
</script>

<template>
  <div
    v-if="frontmatter.motionSite"
    class="motion-site"
    :class="{ 'motion-reduced': reduced }"
  >
    <a class="motion-skip" href="#main-content">{{
      t(['Skip to content', 'Ir para o conteúdo', 'Ir al contenido', '跳转到正文'])
    }}</a>
    <header class="motion-nav">
      <a :href="link('/')" class="motion-brand" aria-label="Jolt">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M18 2 5 18h10l-2 12L28 12H18l4-10Z" fill="currentColor" />
        </svg>
        jolt<span class="brand-dot">.</span>
      </a>
      <nav
        class="motion-nav-links"
        :class="{ open: menu }"
        :aria-label="
          t(['Main navigation', 'Navegação principal', 'Navegación principal', '主导航'])
        "
      >
        <a
          :href="link('/recipes/')"
          :aria-current="route.path.includes('/recipes') ? 'page' : undefined"
          >{{ t(labels.recipes) }}<span class="nav-count">12</span></a
        >
        <a :href="link('/#playground')">{{ t(labels.playground) }}</a>
        <a :href="link('/guide/')"
          >{{ t(labels.docs) }} <span aria-hidden="true">↗</span></a
        >
      </nav>
      <div class="motion-nav-tools">
        <label class="motion-language"
          ><span class="sr-only">{{ t(['Language', 'Idioma', 'Idioma', '语言']) }}</span>
          <select :value="locale" @change="changeLanguage">
            <option value="en">EN</option>
            <option value="pt-BR">PT</option>
            <option value="es">ES</option>
            <option value="zh-Hans">中文</option>
          </select>
        </label>
        <a
          class="nav-github"
          href="https://github.com/rafaelaugustos/jolt"
          aria-label="Jolt on GitHub"
          ><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.99 1.03-2.69-.11-.26-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.03A9.6 9.6 0 0 1 12 6.8c.85 0 1.71.11 2.51.34 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.21 2.4.1 2.66.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
            /></svg
        ></a>
        <button
          class="motion-menu"
          :aria-label="t(labels.menu)"
          :aria-expanded="menu"
          @click="menu = !menu"
        >
          <span></span><span></span>
        </button>
      </div>
    </header>
    <main id="main-content" tabindex="-1"><Content /></main>
    <footer id="site-footer" class="site-footer">
      <div class="footer-directory">
        <div class="footer-identity">
          <a :href="link('/')" class="footer-brand" aria-label="Jolt">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M18 2 5 18h10l-2 12L28 12H18l4-10Z" fill="currentColor" />
            </svg>
            jolt<span>.</span>
          </a>
          <p>
            {{
              t([
                'Native motion. Open source.',
                'Movimento nativo. Código aberto.',
                'Movimiento nativo. Código abierto.',
                '原生动效，开放源码。',
              ])
            }}
          </p>
          <span class="footer-made"
            ><span class="live-dot"></span
            >{{
              t([
                'This site moves with Jolt Web.',
                'Este site se move com Jolt Web.',
                'Este sitio se mueve con Jolt Web.',
                '本网站动效由 Jolt Web 驱动。',
              ])
            }}</span
          >
        </div>
        <nav
          class="footer-links"
          :aria-label="t(['Explore Jolt', 'Explore o Jolt', 'Explora Jolt', '探索 Jolt'])"
        >
          <span class="footer-column-title">{{
            t(['EXPLORE', 'EXPLORE', 'EXPLORA', '探索'])
          }}</span>
          <a :href="link('/recipes/')">{{ t(labels.recipes) }}</a>
          <a :href="link('/guide/showcase')">Showcase</a>
          <a :href="link('/guide/performance-study')">{{
            t([
              'Performance study',
              'Estudo de desempenho',
              'Estudio de rendimiento',
              '性能研究',
            ])
          }}</a>
        </nav>
        <nav
          class="footer-links"
          :aria-label="
            t(['Build with Jolt', 'Crie com Jolt', 'Crea con Jolt', '使用 Jolt 构建'])
          "
        >
          <span class="footer-column-title">{{
            t(['BUILD', 'CRIE', 'CREA', '构建'])
          }}</span>
          <a :href="link('/guide/install')">{{
            t(['Installation', 'Instalação', 'Instalación', '安装'])
          }}</a>
          <a :href="link('/guide/api')">{{
            t(['API reference', 'Referência da API', 'Referencia de API', 'API 参考'])
          }}</a>
          <a href="https://github.com/rafaelaugustos/jolt"
            >GitHub <span aria-hidden="true">↗</span></a
          >
        </nav>
        <a class="footer-top-link" href="#main-content"
          >{{ t(['Back to top', 'Voltar ao topo', 'Volver arriba', '返回顶部'])
          }}<span aria-hidden="true">↑</span></a
        >
      </div>
      <div class="motion-footer-bottom">
        <span>© {{ new Date().getFullYear() }} Jolt · Cortex Labs</span
        ><a href="https://github.com/rafaelaugustos/jolt/blob/main/LICENSE"
          >MIT · Open source</a
        ><a :href="link('/guide/release-history')">{{
          t([
            'Release history',
            'Histórico de versões',
            'Historial de versiones',
            '版本历史',
          ])
        }}</a
        ><button :aria-pressed="reduced" @click="reduced = !reduced">
          <span class="motion-toggle" :class="{ active: reduced }"></span
          >{{ t(labels.reduced) }}
        </button>
      </div>
      <OrbitSignature />
    </footer>
  </div>
  <DefaultTheme.Layout v-else
    ><template #layout-bottom><OrbitSignature /></template
  ></DefaultTheme.Layout>
</template>
