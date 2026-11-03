<script setup lang="ts">
import { useWords } from './copy'
import { categoryNames, type Recipe } from './recipes'
import NativeVideo from './NativeVideo.vue'

defineProps<{ items: Recipe[] }>()
const { t, link } = useWords()
const players = new Map<string, InstanceType<typeof NativeVideo>>()
function setPlayer(slug: string, instance: unknown) {
  if (instance) players.set(slug, instance as InstanceType<typeof NativeVideo>)
  else players.delete(slug)
}
</script>

<template>
  <div class="recipe-grid">
    <a
      v-for="(recipe, i) in items"
      :key="recipe.slug"
      :href="link(`/recipes/${recipe.slug}`)"
      class="recipe-card"
      @pointerenter="players.get(recipe.slug)?.play()"
      @pointerleave="players.get(recipe.slug)?.leave()"
      @focus="players.get(recipe.slug)?.play()"
      @blur="players.get(recipe.slug)?.leave()"
    >
      <div class="recipe-card-stage" :style="{ '--recipe-color': recipe.color }">
        <span class="recipe-card-index"
          >{{ String(i + 1).padStart(2, '0') }} /
          {{ recipe.category.toUpperCase() }}</span
        >
        <div class="recipe-device">
          <NativeVideo
            :ref="(el) => setPlayer(recipe.slug, el)"
            :name="recipe.video"
            :caption="t(recipe.caption)"
            :controls="false"
            preview
          />
        </div>
        <span class="recipe-platform"
          >{{ recipe.platform }} <span aria-hidden="true">↗</span></span
        >
        <span class="recipe-play" aria-hidden="true">↗</span>
      </div>
      <div class="recipe-card-copy">
        <h3>{{ t(recipe.title) }}</h3>
        <p>{{ t(recipe.description) }}</p>
        <span
          >{{ t(categoryNames[recipe.category])
          }}<template v-if="recipe.project"> · {{ recipe.project.name }}</template></span
        >
      </div>
    </a>
  </div>
</template>
