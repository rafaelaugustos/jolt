<script setup lang="ts">
import type { EventData, View } from '@nativescript/core'
import { useRoute, useRouter } from 'vue-router-ns'
import { configure } from '@rafaelaugusto/jolt'
import { usePreviewI18n } from './i18n'
import {
  navigateShared,
  navigationMissing,
  navigationReduced,
  navigationShifted,
  navigationChecks,
} from './shared-navigation'
const { t } = usePreviewI18n()
const route = useRoute(),
  router = useRouter()
const image = route.params.mode === 'image'
function back(event: EventData) {
  configure({ reducedMotion: navigationReduced.value ? 'always' : 'user' })
  navigateShared(event.object as View, image ? 'cove' : 'pass', (options) =>
    router.back(options),
  )
}
</script>
<template>
  <Page
    actionBarHidden="true"
    backgroundColor="#E9EAE2"
    androidStatusBarBackground="#E9EAE2"
    statusBarStyle="dark"
    enableSwipeBackNavigation="false"
  >
    <GridLayout rows="auto,*,auto,auto" padding="18 24 28" backgroundColor="#E9EAE2">
      <GridLayout columns="auto,*,auto" height="52" marginBottom="14">
        <Label
          text="←"
          width="44"
          height="44"
          borderRadius="22"
          backgroundColor="#DADFD3"
          color="#153A35"
          fontSize="27"
          textAlignment="center"
          verticalAlignment="middle"
          accessibilityIdentifier="navigation-back"
          :accessibilityLabel="t('Back to the places')"
          accessibilityRole="button"
          @tap="back"
        />
        <Label
          col="1"
          :text="t('THE ART OF GETTING AWAY')"
          color="#52635D"
          fontSize="9"
          letterSpacing="0.12"
          horizontalAlignment="center"
          verticalAlignment="middle"
        />
        <Label
          col="2"
          text="↗"
          color="#153A35"
          fontSize="27"
          verticalAlignment="middle"
        />
      </GridLayout>
      <GridLayout row="1" backgroundColor="#D7DED3" borderRadius="10">
        <Image
          v-if="image"
          src="~/assets/studio/cove.png"
          stretch="aspectFit"
          borderRadius="10"
          :sharedTransitionTag="navigationMissing ? undefined : 'cove'"
          accessibilityIdentifier="navigation-detail-image"
        />
        <GridLayout
          v-else
          rows="auto,*,auto"
          padding="26"
          borderRadius="10"
          backgroundColor="#D1E5C4"
          :sharedTransitionTag="navigationMissing ? undefined : 'pass'"
          accessibilityIdentifier="navigation-detail-pass"
        >
          <Label
            :text="t('YOUR DAY PASS')"
            color="#3A5848"
            fontSize="11"
            letterSpacing="0.16"
          />
          <StackLayout row="1" verticalAlignment="middle"
            ><Label text="01" fontSize="84" fontWeight="700" color="#153A35" /><Label
              :text="t('One day,\nall yours.')"
              textWrap="true"
              fontSize="38"
              fontWeight="700"
              color="#153A35" /><Label
              :text="t('A quiet cove. A long lunch.\nNo next thing.')"
              textWrap="true"
              marginTop="22"
              fontSize="15"
              color="#3A5848"
          /></StackLayout>
          <Label
            row="2"
            text="CALA SERENA     ·     41° 18′ N"
            fontSize="10"
            color="#3A5848"
            letterSpacing="0.08"
          />
        </GridLayout>
      </GridLayout>
      <StackLayout row="2" marginTop="24" marginBottom="22"
        ><Label
          :text="image ? 'Cala Serena' : t('Stay a little longer.')"
          fontSize="34"
          fontWeight="700"
          color="#153A35" /><Label
          :text="t('Find your own pace. We saved you a place.')"
          marginTop="8"
          fontSize="14"
          color="#52635D"
          textWrap="true"
      /></StackLayout>
      <GridLayout
        row="3"
        columns="*,auto"
        padding="16 0"
        borderTopWidth="1"
        borderTopColor="#CAD3C7"
        ><Label
          :text="t('A LITTLE CLOSER TO NOW')"
          fontSize="10"
          letterSpacing="0.1"
          color="#52635D" /><Label
          col="1"
          text="JOLT / 060"
          fontSize="10"
          color="#52635D"
      /></GridLayout>
      <Button
        v-if="navigationChecks"
        row="0"
        text="Move return"
        accessibilityIdentifier="navigation-move-return"
        @tap="navigationShifted = !navigationShifted"
        fontSize="10"
        horizontalAlignment="right"
      />
    </GridLayout>
  </Page>
</template>
