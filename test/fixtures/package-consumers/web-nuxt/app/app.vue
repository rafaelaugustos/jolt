<script setup lang="ts">
import { shallowRef, ref } from 'vue'
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'
const target = shallowRef<HTMLElement | null>(null)
const motion = useWebMotion(target, {
  initial: { opacity: 0.3 },
  enter: { keyframes: { opacity: 1 }, transition: { duration: 240 } },
  leave: { keyframes: { opacity: 0 }, transition: { duration: 300 } },
})
const retained = ref(false)
</script>
<template>
  <div class="shell">
    <header>
      <small>JOLT · VUE / NUXT</small>
      <h1>Enter when the page is ready</h1>
      <p>SSR, out-in navigation, deferred insertion and retained pages.</p>
      <nav>
        <NuxtLink id="home" to="/">Home</NuxtLink
        ><NuxtLink id="away" to="/away">Details</NuxtLink
        ><NuxtLink id="slow" to="/slow">Async page</NuxtLink>
      </nav>
      <button id="keepalive" @click="retained = !retained">
        KeepAlive: {{ retained ? 'on' : 'off' }}
      </button>
    </header>
    <NuxtPage
      :page-key="(route) => route.path"
      :transition="{ ...motion.transition, mode: 'out-in' }"
      :keepalive="retained"
    />
  </div>
</template>
<style>
body {
  margin: 0;
  background: #111a22;
  color: #eaf1f2;
  font: 17px system-ui;
}
.shell {
  max-width: 800px;
  margin: auto;
  padding: 30px;
}
h1 {
  font-size: 34px;
  margin: 12px 0;
}
p {
  color: #aabac7;
}
nav {
  display: flex;
  gap: 22px;
  margin: 24px 0;
}
a {
  color: #9cdec5;
}
button {
  background: #253c47;
  border: 1px solid #54766f;
  border-radius: 8px;
  color: inherit;
  padding: 12px;
  cursor: pointer;
}
.page {
  display: grid;
  gap: 18px;
  margin-top: 26px;
}
.card {
  background: #1e303b;
  border: 1px solid #3e5962;
  border-radius: 16px;
  padding: 24px;
  min-height: 90px;
}
.card strong {
  color: #9cdec5;
  font-size: 24px;
}
small {
  letter-spacing: 2px;
  color: #9cdec5;
}
</style>
