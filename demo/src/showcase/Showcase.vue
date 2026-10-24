<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { RouterView } from 'vue-router-ns'
import Splash from './Splash.vue'
const opening = ref(true)
</script>
<template>
  <GridLayout backgroundColor="#F6F5F0" iosOverflowSafeArea="true">
    <GridLayout :isUserInteractionEnabled="!opening" :accessibilityHidden="opening">
      <RouterView />
    </GridLayout>
    <Splash v-if="opening" @done="opening = false" />
  </GridLayout>
</template>
