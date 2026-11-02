<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useData } from 'vitepress'
import { showcaseCopy } from './showcase-copy'

import { createShowcaseClient, ShowcaseError, type AppCard } from './showcase-client'

const { lang } = useData()
const copy = computed(() => showcaseCopy(lang.value))

const apps = ref<AppCard[]>([])
const appName = ref('')
const summary = ref('')
const videoUrl = ref('')
const appUrl = ref('')
const author = ref('')
const email = ref('')
const website = ref('')
const state = ref<'idle' | 'sending' | 'sent' | 'invalid' | 'rate' | 'unavailable'>(
  'idle',
)

const showcase = createShowcaseClient()

function fileVideo(value: string) {
  try {
    const path = new URL(value).pathname.toLowerCase()
    return path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mov')
  } catch {
    return false
  }
}

onMounted(async () => {
  try {
    apps.value = await showcase.list()
  } catch {
    apps.value = []
  }
})

async function submit() {
  if (state.value === 'sending') return
  state.value = 'sending'
  try {
    await showcase.submit({
      appName: appName.value,
      summary: summary.value,
      videoUrl: videoUrl.value,
      appUrl: appUrl.value,
      author: author.value,
      email: email.value,
      website: website.value,
    })
    state.value = 'sent'
    appName.value = ''
    summary.value = ''
    videoUrl.value = ''
    appUrl.value = ''
    author.value = ''
    email.value = ''
  } catch (error) {
    state.value = error instanceof ShowcaseError ? error.reason : 'unavailable'
  }
}
</script>

<template>
  <div class="send">
    <div v-if="apps.length" class="send-list">
      <article v-for="app in apps" :key="app.id" class="send-app">
        <video
          v-if="fileVideo(app.videoUrl)"
          :src="app.videoUrl"
          controls
          playsinline
          preload="metadata"
        />
        <a
          v-else
          class="send-watch"
          :href="app.videoUrl"
          target="_blank"
          rel="noopener"
          >{{ copy.watch }}</a
        >
        <div>
          <h3>{{ app.name }}</h3>
          <p>{{ app.summary }}</p>
          <p v-if="app.author" class="send-by">{{ app.author }}</p>
          <a v-if="app.appUrl" :href="app.appUrl" target="_blank" rel="noopener">{{
            copy.open
          }}</a>
        </div>
      </article>
    </div>

    <form class="send-form" :aria-busy="state === 'sending'" @submit.prevent="submit">
      <div class="send-intro">
        <p class="showcase-kicker">{{ copy.kicker }}</p>
        <h3>{{ copy.title }}</h3>
        <p>{{ copy.lead }}</p>
        <ol class="send-steps">
          <li v-for="step in copy.steps" :key="step">{{ step }}</li>
        </ol>
      </div>
      <div class="send-fields">
        <div class="send-grid">
          <label class="wide"
            >{{ copy.name }}
            <input
              v-model="appName"
              required
              maxlength="60"
              name="app"
              :placeholder="copy.namePlaceholder"
            />
          </label>
          <label class="wide"
            >{{ copy.summary }}
            <textarea
              v-model="summary"
              required
              maxlength="280"
              name="summary"
              rows="3"
              :placeholder="copy.summaryPlaceholder"
            />
          </label>
          <label class="wide"
            >{{ copy.video }}
            <input
              v-model="videoUrl"
              required
              type="url"
              maxlength="400"
              placeholder="https://"
              name="video"
              pattern="https://.*"
              aria-describedby="showcase-video-hint"
            />
            <span id="showcase-video-hint" class="send-hint">{{ copy.videoHint }}</span>
          </label>
          <label
            >{{ copy.app }}
            <input
              v-model="appUrl"
              type="url"
              pattern="https://.*"
              maxlength="400"
              placeholder="https://"
              name="link"
            />
          </label>
          <label
            >{{ copy.author }}
            <input v-model="author" maxlength="80" name="author" autocomplete="name" />
          </label>
          <label class="wide"
            >{{ copy.email }}
            <input
              v-model="email"
              required
              type="email"
              maxlength="120"
              name="email"
              autocomplete="email"
              placeholder="you@example.com"
              aria-describedby="showcase-email-hint"
            />
            <span id="showcase-email-hint" class="send-hint">{{ copy.emailHint }}</span>
          </label>
          <label class="send-honey" aria-hidden="true"
            >Website
            <input v-model="website" tabindex="-1" autocomplete="off" name="website" />
          </label>
        </div>
        <button type="submit" :disabled="state === 'sending'">
          {{ state === 'sending' ? copy.sending : copy.send
          }}<span aria-hidden="true">↗</span>
        </button>
        <p class="send-note" role="status" aria-live="polite">
          {{
            state === 'sent'
              ? copy.sent
              : state === 'invalid'
                ? copy.invalid
                : state === 'rate'
                  ? copy.rate
                  : state === 'unavailable'
                    ? copy.unavailable
                    : ''
          }}
        </p>
      </div>
    </form>
  </div>
</template>
