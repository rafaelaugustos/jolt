<script lang="ts" setup>
import { isAndroid } from '@nativescript/core'
const props = withDefaults(
  defineProps<{ name: string; size?: number; color?: string }>(),
  {
    size: 22,
    color: '#292b28',
  },
)
// SF Symbols draw the iOS icons; Android uses the Material Icons font with the same meaning.
const material: Record<string, string> = {
  'arrow.left': 'arrow_back',
  'arrow.triangle.2.circlepath': 'autorenew',
  'arrow.up': 'arrow_upward',
  'doc.text': 'description',
  'icloud.and.arrow.up': 'cloud_upload',
  magnifyingglass: 'search',
  mic: 'mic',
  pause: 'pause',
  'pause.fill': 'pause',
  'pencil.tip.crop.circle': 'draw',
  'person.crop.circle': 'account_circle',
  'photo.on.rectangle.angled': 'photo_library',
  play: 'play_arrow',
  'play.fill': 'play_arrow',
  plus: 'add',
  'questionmark.bubble': 'help_outline',
  'slider.horizontal.3': 'tune',
  sparkles: 'auto_awesome',
  'square.3.layers.3d': 'layers',
  tablecells: 'table_chart',
  viewfinder: 'document_scanner',
}
const glyph = () => material[props.name] ?? 'circle'
</script>

<template>
  <Label
    v-if="isAndroid"
    :text="glyph()"
    fontFamily="MaterialIcons-Regular"
    :fontSize="size"
    :color="color"
    horizontalAlignment="center"
    verticalAlignment="middle"
    isUserInteractionEnabled="false"
    accessible="false"
  />
  <Image
    v-else
    :src="`sys://${name}`"
    :width="size"
    :height="size"
    :tintColor="color"
    stretch="aspectFit"
    isUserInteractionEnabled="false"
    accessible="false"
  />
</template>
