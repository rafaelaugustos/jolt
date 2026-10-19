<script setup lang="ts">
import { ref } from 'nativescript-vue'
import MotionCard from './MotionCard.vue'
const mounted = ref(true)
</script>
<template>
  <StackLayout class="section">
    <Label class="heading" text="Motion states & scopes" />
    <Label
      class="muted"
      text="Change direction during an upload. Pause the scope, or unmount the card while it moves."
      textWrap="true"
    />
    <MotionCard v-if="mounted" />
    <Button :text="mounted ? 'Unmount card' : 'Mount card'" @tap="mounted = !mounted" />
  </StackLayout>
</template>
