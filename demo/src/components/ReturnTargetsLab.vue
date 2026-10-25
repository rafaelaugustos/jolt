<script setup lang="ts">
import type { EventData, ItemEventData, ListView } from '@nativescript/core'
import { useRouter } from 'vue-router-ns'
import { onUnmounted } from 'nativescript-vue'
import { usePreviewI18n } from '../showcase/i18n'
import { loadCollectionCell } from '../showcase/collection-cells'
import {
  collectionRows,
  collectionStatus,
  collectionReduced,
  collectionAudit,
  setCollectionList,
  releaseCollection,
  openCollectionPhoto,
  resetCollection,
  useGalleryCollection,
} from '../showcase/photo-collection'
const router = useRouter(),
  { t } = usePreviewI18n()
const props = defineProps<{ embedded?: boolean; gallery?: boolean }>()
useGalleryCollection(!!props.gallery)
defineEmits(['back'])
onUnmounted(releaseCollection)
function loaded(e: EventData) {
  setCollectionList(e.object as ListView)
}
function cell(event: ItemEventData) {
  loadCollectionCell(event, t, (image, photo) => {
    void openCollectionPhoto(
      image,
      photo,
      router,
      props.gallery ? '/gallery-photo/' : '/return-photo/',
    )
  })
}
</script>
<template>
  <GridLayout rows="auto,*,auto" backgroundColor="#F0EEE6" padding="16 8 10">
    <GridLayout columns="*,auto" margin="0 12 16">
      <StackLayout
        ><Label
          :text="t(props.gallery ? 'THE LIVING GALLERY / 065' : 'PLACES TO KEEP / 064')"
          fontSize="9"
          color="#6A746B"
          letterSpacing="0.16" /><Label
          :text="t(props.gallery ? 'Keep a little wonder.' : 'Every place, remembered.')"
          fontSize="25"
          fontWeight="700"
          color="#193D34"
          marginTop="7"
          textWrap="true"
          automationText="collection-heading"
          accessibilityRole="header"
      /></StackLayout>
      <Label col="1" text="↗" fontSize="29" color="#193D34" />
    </GridLayout>
    <CollectionList
      row="1"
      :items="collectionRows"
      @loaded="loaded"
      @itemLoading="cell"
      separatorColor="transparent"
      backgroundColor="#F0EEE6"
      iosEstimatedRowHeight="280"
      automationText="collection-grid"
    />
    <StackLayout row="2" padding="12 12 0">
      <GridLayout columns="*,auto"
        ><Label
          :text="t(collectionStatus)"
          fontSize="10"
          color="#5C6A5B"
          textWrap="true"
          verticalAlignment="middle"
          automationText="collection-result" /><Label
          col="1"
          :text="t('Start again')"
          fontSize="11"
          color="#193D34"
          padding="10"
          accessibilityRole="button"
          automationText="collection-reset"
          @tap="resetCollection"
      /></GridLayout>
      <Button
        v-if="collectionAudit()"
        text="Reduce"
        automationText="collection-reduce"
        fontSize="9"
        @tap="collectionReduced = !collectionReduced"
      />
    </StackLayout>
  </GridLayout>
</template>
