<script setup lang="ts">
import { Frame, type ContentView, type EventData } from '@nativescript/core'
import { galleryRecipe } from '../recipes/gallery'
import { sheetRecipe } from '../recipes/sheet'
import { listRecipe } from '../recipes/lists'
import { imageProfileRecipe } from '../recipes/image-profile'
const props = defineProps<{ kind: string }>()
function loaded(event: EventData) {
  const host = event.object as ContentView
  if (host.content) return
  const frame = new Frame()
  frame.navigate({
    create: () =>
      props.kind === 'gallery'
        ? galleryRecipe(frame)
        : props.kind === 'sheet'
          ? sheetRecipe()
          : props.kind === 'image-profile'
            ? imageProfileRecipe()
            : listRecipe(),
  })
  host.content = frame
}
</script>
<template><ContentView @loaded="loaded" /></template>
