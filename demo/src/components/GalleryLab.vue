<script setup lang="ts">
import ReturnTargetsLab from './ReturnTargetsLab.vue'
defineProps<{ embedded?: boolean }>()
defineEmits(['back'])
</script>
<template>
  <ReturnTargetsLab :embedded="embedded" gallery @back="$emit('back')" />
</template>
