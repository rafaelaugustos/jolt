<script setup lang="ts">
import { useRouter } from 'vue-router-ns'
import { usePreviewI18n } from './i18n'
import {
  selectedPhoto,
  collectionEntry,
  collectionStatus,
  photoTag,
  moveSelected,
  removeSelected,
} from './photo-collection'
const { t } = usePreviewI18n(),
  router = useRouter()
const photo = selectedPhoto.value
function back() {
  if (collectionEntry?.state !== 'disposed') collectionEntry?.back()
  else void router.back()
}
</script>
<template>
  <Page
    id="return-photo-detail"
    actionBarHidden="true"
    backgroundColor="#F0EEE6"
    androidStatusBarBackground="#F0EEE6"
    statusBarStyle="dark"
  >
    <GridLayout rows="auto,*,auto,auto,auto" padding="18 24 28" backgroundColor="#F0EEE6">
      <GridLayout columns="auto,*,auto" height="48" marginBottom="18"
        ><Label
          text="←"
          width="44"
          height="44"
          borderRadius="22"
          backgroundColor="#DDE3D3"
          color="#193D34"
          fontSize="26"
          textAlignment="center"
          verticalAlignment="middle"
          accessibilityRole="button"
          :accessibilityLabel="t('Back to the collection')"
          automationText="collection-back"
          @tap="back" /><Label
          col="1"
          :text="t('A PLACE OF YOUR OWN')"
          fontSize="9"
          color="#6A746B"
          textAlignment="center"
          verticalAlignment="middle"
          letterSpacing="0.1" /><Label col="2" text="↗" fontSize="25" color="#193D34"
      /></GridLayout>
      <GridLayout row="1" backgroundColor="#DEE3D7" borderRadius="12"
        ><Image
          :src="photo?.src"
          stretch="aspectFit"
          borderRadius="12"
          :sharedTransitionTag="photo ? photoTag(photo.key) : undefined"
          automationText="collection-detail-image"
          :accessibilityLabel="t(photo?.title ?? 'Your place')"
      /></GridLayout>
      <StackLayout row="2" margin="20 0"
        ><Label
          :text="t(photo?.title ?? 'Your place')"
          fontSize="30"
          color="#193D34"
          fontWeight="700" /><Label
          :text="t(photo?.note ?? '')"
          fontSize="12"
          color="#6A746B"
          marginTop="6"
      /></StackLayout>
      <GridLayout row="3" columns="*,*" marginBottom="12"
        ><Label
          :text="t('Move to the end')"
          fontSize="12"
          color="#193D34"
          backgroundColor="#D4E3BD"
          padding="16 8"
          borderRadius="16"
          textAlignment="center"
          marginRight="5"
          accessibilityRole="button"
          automationText="collection-move"
          @tap="moveSelected" /><Label
          col="1"
          :text="t('Remove from collection')"
          fontSize="12"
          color="#6A4D39"
          backgroundColor="#E8DCCB"
          padding="16 8"
          borderRadius="16"
          textAlignment="center"
          marginLeft="5"
          accessibilityRole="button"
          automationText="collection-remove"
          @tap="removeSelected"
      /></GridLayout>
      <Label
        row="4"
        :text="t(collectionStatus)"
        fontSize="10"
        color="#6A746B"
        textWrap="true"
        textAlignment="center"
        automationText="collection-detail-status"
      />
    </GridLayout>
  </Page>
</template>
