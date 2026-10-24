<script setup lang="ts">
import { usePreviewI18n } from '../showcase/i18n'
import { onUnmounted, ref } from 'nativescript-vue'
import { configure } from '@rafaelaugusto/jolt'
import LayoutSurface from './LayoutSurface.vue'
const { t } = usePreviewI18n()
defineEmits<{ back: [] }>()
const mounted = ref(true),
  reduced = ref(false)
function toggleReduced() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
}
onUnmounted(() => configure({ reducedMotion: 'user' }))
const props = defineProps<{ embedded?: boolean }>()
</script>
<template>
  <GridLayout v-if="embedded" class="exhibit" rows="*,auto">
    <ScrollView
      ><LayoutSurface v-if="mounted" :embedded="true" /><Label
        v-else
        :text="t('Ready for a fresh start.')"
        class="ex-note" /></ScrollView
    ><GridLayout row="1" columns="*,*" class="ex-controls"
      ><Button
        :text="t(mounted ? 'Unmount layout' : 'Mount layout')"
        @tap="mounted = !mounted" /><Button
        col="1"
        :text="t(reduced ? 'Motion: reduced' : 'Motion: system')"
        @tap="toggleReduced"
    /></GridLayout>
  </GridLayout>
  <template v-else>
    <GridLayout rows="auto,*,auto" padding="12 20" backgroundColor="white">
      <GridLayout v-if="!props.embedded" columns="auto,*">
        <Button :text="t('Back')" @tap="$emit('back')" />
        <Label
          col="1"
          :text="t('Layout changes')"
          class="heading"
          verticalAlignment="middle"
        />
      </GridLayout>
      <ScrollView row="1">
        <LayoutSurface v-if="mounted" />
        <Label
          v-else
          :text="t('Layout examples unmounted')"
          horizontalAlignment="center"
        />
      </ScrollView>
      <GridLayout row="2" columns="*,*">
        <Button
          :text="t(mounted ? 'Unmount layout' : 'Mount layout')"
          @tap="mounted = !mounted"
        />
        <Button
          col="1"
          :text="t(reduced ? 'Motion: reduced' : 'Motion: system')"
          @tap="toggleReduced"
        />
      </GridLayout>
    </GridLayout>
  </template>
</template>
