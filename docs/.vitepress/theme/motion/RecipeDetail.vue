<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData } from 'vitepress'
import { recipes, categoryNames } from './recipes'
import { data } from './recipes.data'
import { labels, useWords } from './copy'
import NativeVideo from './NativeVideo.vue'
import RecipeGrid from './RecipeGrid.vue'

const { frontmatter } = useData()
const { t, link, locale } = useWords()
const recipe = computed(() =>
  recipes.find((item) => item.slug === frontmatter.value.recipe)!,
)
const example = computed(() => data.find((item) => item.slug === recipe.value.slug)!)
const related = computed(() =>
  recipes
    .filter((item) => item.slug !== recipe.value.slug)
    .sort(
      (a, b) =>
        Number(b.category === recipe.value.category) -
        Number(a.category === recipe.value.category),
    )
    .slice(0, 3),
)
const copied = ref('')
const fallback = ref('')
const showPrompt = ref(false)
const prompt = computed(
  () => `${t(['Adapt this Jolt motion recipe to my NativeScript Vue project.', 'Adapte esta receita de movimento do Jolt ao meu projeto NativeScript Vue.', 'Adapta esta receta de movimiento de Jolt a mi proyecto NativeScript Vue.', '将这个 Jolt 动效配方适配到我的 NativeScript Vue 项目。'])}

Recipe: ${t(recipe.value.title)}
Jolt: @rafaelaugusto/jolt@${example.value.version}
Framework: NativeScript Vue 3; native views, not HTML elements.
Reference: https://jolt.rafaelaugusto.dev${link(`/recipes/${recipe.value.slug}`)}
API guide: https://jolt.rafaelaugusto.dev${link(`/guide/${recipe.value.guide}`)}
Full native demo: https://github.com/rafaelaugustos/jolt/blob/main/demo/src/${recipe.value.source}
Recording platform: ${recipe.value.platform}. ${t(recipe.value.caption)}

Core API example from the versioned guide (supply the mounted views and surrounding UI):
${example.value.code}

Inspect the project before editing. Use only documented APIs and the correct package entry points. Preserve existing styling and navigation. Match the interaction in the native recording. Use mounted NativeScript view refs; handle unload/remount and dispose owned animations, gesture controllers and effects on teardown. Respect reduced motion. Explain platform-specific limits and dependencies. Do not assume the native API and the experimental /web API are interchangeable. Validate actual input and interruption in the native demo, record the result, and document it in English and Portuguese. Respond in ${locale.value}.`,
)
async function copy(kind: 'code' | 'prompt') {
  const value = kind === 'code' ? example.value.code : prompt.value
  fallback.value = ''
  try {
    await navigator.clipboard.writeText(value)
    copied.value = kind
  } catch {
    fallback.value = value
    copied.value = ''
  }
}
</script>

<template>
  <article v-if="recipe" class="recipe-detail section-shell">
    <a class="recipe-back" :href="link('/recipes/')">← {{ t(labels.recipes) }}</a>
    <div class="recipe-detail-heading">
      <p class="eyebrow">
        {{ t(categoryNames[recipe.category]).toUpperCase() }} / {{ recipe.platform }} /
        NATIVESCRIPT VUE
      </p>
      <h1>{{ t(recipe.title) }}</h1>
      <p>{{ t(recipe.description) }}</p>
    </div>
    <div class="recipe-detail-grid">
      <figure class="recipe-full-video" :style="{ '--recipe-color': recipe.color }">
        <div class="recipe-full-screen">
          <NativeVideo
            :key="recipe.slug"
            :name="recipe.video"
            :caption="t(recipe.caption)"
          />
        </div>
        <figcaption>
          <span>{{ t(labels.native) }} · {{ recipe.platform }}</span
          >{{ t(recipe.caption) }}
        </figcaption>
      </figure>
      <div class="recipe-implementation">
        <div class="recipe-implementation-top">
          <h2>
            {{
              t([
                'The motion behind it.',
                'O movimento por trás.',
                'El movimiento detrás.',
                '动效背后的代码。',
              ])
            }}
          </h2>
          <span>Jolt {{ example.version }}</span>
        </div>
        <p>
          {{
            t([
              'The core API example, taken directly from the guide. Use the full demo for the surrounding interface and controls.',
              'O exemplo da API, extraído diretamente do guia. Veja a demo completa para a interface e os controles.',
              'El ejemplo de API, extraído del guía. Consulta la demo completa para la interfaz y los controles.',
              '直接来自指南的核心 API 示例。完整界面与控件请查看完整演示。',
            ])
          }}
        </p>
        <div class="recipe-code">
          <div class="code-topline">
            <span>TypeScript · NativeScript</span
            ><button @click="copy('code')">
              {{ copied === 'code' ? t(labels.copied) : t(labels.copy) }} ⧉
            </button>
          </div>
          <pre><code>{{ example.code }}</code></pre>
        </div>
        <div class="recipe-actions">
          <button class="button-acid" @click="copy('prompt')">
            {{ copied === 'prompt' ? t(labels.copied) : t(labels.prompt) }}
            <span aria-hidden="true">↗</span></button
          ><a
            :href="`https://github.com/rafaelaugustos/jolt/blob/main/demo/src/${recipe.source}`"
            >{{ t(labels.source) }} ↗</a
          >
        </div>
        <p role="status" class="copy-status">{{ copied ? t(labels.copied) : '' }}</p>
        <label v-if="fallback" class="copy-fallback"
          >{{ t(labels.copyFailed)
          }}<textarea
            readonly
            :value="fallback"
            @focus="($event.target as HTMLTextAreaElement).select()"
          /></label
        ><button
          class="prompt-toggle"
          :aria-expanded="showPrompt"
          @click="showPrompt = !showPrompt"
        >
          {{ t(['Read the prompt', 'Ler o prompt', 'Leer el prompt', '阅读提示词']) }}
          {{ showPrompt ? '−' : '+' }}
        </button>
        <pre v-if="showPrompt" class="prompt-preview">{{ prompt }}</pre>
        <a class="recipe-guide-link" :href="link(`/guide/${recipe.guide}`)"
          >{{
            t([
              'Read the full guide',
              'Leia o guia completo',
              'Lee la guía completa',
              '阅读完整指南',
            ])
          }}
          <span>↗</span></a
        >
      </div>
    </div>
    <section class="related-recipes">
      <div class="section-heading">
        <h2>
          {{
            t([
              'Keep the feeling going.',
              'Continue explorando.',
              'Sigue explorando.',
              '继续探索。',
            ])
          }}
        </h2>
        <a class="text-link" :href="link('/recipes/')">{{ t(labels.all) }} ↗</a>
      </div>
      <RecipeGrid :items="related" />
    </section>
  </article>
</template>
