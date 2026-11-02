<script setup lang="ts">
await useFetch('/api/content')
</script>
<template>
  <main id="slow-page" class="page">
    <section v-enter class="card">
      <strong>Async content ready</strong>
      <p>Suspense resolved, then the entrance began after actual attachment.</p>
    </section>
  </main>
</template>
