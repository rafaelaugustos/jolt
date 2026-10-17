<script setup lang="ts">
withDefaults(defineProps<{ name: string; caption?: string; width?: number }>(), {
  caption: '',
  width: 280,
})
</script>

<template>
  <figure class="clip" :style="{ width: `${width}px` }">
    <video
      :src="`/media/${name}.mp4`"
      :width="width"
      autoplay
      loop
      muted
      playsinline
      preload="metadata"
    />
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.clip {
  margin: 24px auto;
  max-width: 100%;
}
.clip video {
  display: block;
  width: 100%;
  border-radius: 28px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}
.clip figcaption {
  margin-top: 8px;
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
</style>
