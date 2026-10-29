<script setup lang="ts">
import { useData, withBase } from 'vitepress'

const { frontmatter } = useData()
</script>

<template>
  <section
    v-if="frontmatter.homeVideos"
    class="home-videos"
    aria-labelledby="home-videos-title"
  >
    <div class="container">
      <header class="section-header">
        <h2 id="home-videos-title">{{ frontmatter.homeVideos.title }}</h2>
        <p>{{ frontmatter.homeVideos.description }}</p>
      </header>
      <div class="video-grid">
        <article
          v-for="video in frontmatter.homeVideos.items"
          :key="video.name"
          class="video-card"
          :class="{ portrait: video.height > video.width }"
        >
          <header class="video-header">
            <p class="eyebrow">
              {{ video.label }} <span aria-hidden="true">·</span> {{ video.duration }}
            </p>
            <h3>{{ video.title }}</h3>
          </header>
          <figure>
            <video
              :src="withBase(`/media/${video.name}.mp4`)"
              :poster="withBase(`/media/${video.name}.jpg`)"
              :width="video.width"
              :height="video.height"
              :aria-label="video.title"
              :aria-describedby="`${video.name}-caption`"
              controls
              playsinline
              preload="none"
            />
            <figcaption :id="`${video.name}-caption`">{{ video.caption }}</figcaption>
          </figure>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-videos {
  padding: 0 24px 64px;
}

.container {
  max-width: 1152px;
  margin: 0 auto;
}

.section-header {
  margin-bottom: 24px;
}

h2 {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.section-header p {
  margin-top: 12px;
  color: var(--vp-c-text-2);
  line-height: 1.7;
}

.video-grid {
  display: grid;
  gap: 24px;
  align-items: start;
}

.video-card {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 24px;
  background: var(--vp-c-bg-soft);
}

.video-header {
  margin-bottom: 20px;
}

.eyebrow {
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.eyebrow span {
  margin: 0 6px;
}

h3 {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.35;
}

figure {
  margin: 0;
}

video {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 12px;
  background: #080d12;
}

.portrait video {
  max-width: 248px;
  margin: 0 auto;
}

figcaption {
  margin-top: 16px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

@media (min-width: 640px) {
  .home-videos {
    padding-right: 48px;
    padding-left: 48px;
  }
}

@media (min-width: 960px) {
  .home-videos {
    padding-right: 64px;
    padding-left: 64px;
  }

  .video-grid {
    grid-template-columns: minmax(0, 2.1fr) minmax(0, 1fr);
  }

  .video-card {
    padding: 24px;
  }
}
</style>
