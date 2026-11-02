<script setup lang="ts">
const { data } = useFetch('/api/content', {
  key: 'home-items',
  getCachedData: (key, app) => (app.isHydrating ? app.payload.data[key] : undefined),
})
</script>
<template>
  <div class="page">
    <section v-enter class="card">
      <strong>01 · Deferred entry</strong>
      <p>The directive can mount before the document receives this page.</p>
    </section>
    <section v-enter class="card">
      <strong>02 · Live ownership</strong>
      <p>Enter only after insertion. Navigation releases the previous work.</p>
    </section>
    <section v-if="data" v-enter class="card">
      <strong>03 · Return safely</strong>
      <p>Use Details, browser Back and retained pages.</p>
    </section>
  </div>
</template>
