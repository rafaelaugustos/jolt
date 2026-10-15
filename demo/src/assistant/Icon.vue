<script lang="ts" setup>
withDefaults(defineProps<{ name: string; size?: number; color?: string }>(), {
  size: 22,
  color: '#292b28',
})
</script>

<template>
  <Image
    :src="`sys://${name}`"
    :width="size"
    :height="size"
    :tintColor="color"
    stretch="aspectFit"
    isUserInteractionEnabled="false"
    accessible="false"
  />
</template>
