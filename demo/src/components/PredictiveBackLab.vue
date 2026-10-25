<script setup lang="ts">
import { isAndroid } from '@nativescript/core'
import { useRouter } from 'vue-router-ns'
import { usePreviewI18n } from '../showcase/i18n'
import { backAudit, backReduced, backResult } from '../showcase/predictive-back'
const { t } = usePreviewI18n(),
  router = useRouter()
defineProps<{ embedded?: boolean }>()
defineEmits(['back'])
const available = isAndroid && android.os.Build.VERSION.SDK_INT >= 34
let opening = false
async function open() {
  if (opening || !available) return
  opening = true
  try {
    await router.push('/predictive-back', { animated: false })
  } finally {
    opening = false
  }
}
</script>
<template>
  <GridLayout rows="auto,*,auto" backgroundColor="#F0E3CF" padding="22">
    <GridLayout columns="*,auto" marginBottom="18">
      <StackLayout>
        <Label
          :text="t('AFTER HOURS / 062')"
          fontSize="10"
          letterSpacing=".16"
          color="#886851"
        />
        <Label
          :text="t('Chase the quiet.')"
          fontSize="29"
          fontWeight="700"
          color="#38271E"
          marginTop="8"
        />
      </StackLayout>
      <Label col="1" text="↗" fontSize="32" color="#AE502B" />
    </GridLayout>
    <GridLayout
      row="1"
      rows="*,auto"
      backgroundColor="#38271E"
      borderRadius="24"
      clipToBounds="true"
      accessibilityIdentifier="predictive-open"
      :accessibilityLabel="t('Open the dunes')"
      accessibilityRole="button"
      @tap="open"
    >
      <Image src="~/assets/studio/dunes.png" stretch="aspectFill" />
      <GridLayout row="1" columns="*,auto" padding="20">
        <StackLayout>
          <Label
            :text="t('The last light.')"
            fontSize="27"
            fontWeight="700"
            color="#FFF1D7"
          />
          <Label
            :text="t('No rush to leave.')"
            fontSize="12"
            color="#DDBDA1"
            marginTop="6"
          />
        </StackLayout>
        <Label
          col="1"
          text="→"
          fontSize="28"
          color="#F8AC69"
          verticalAlignment="middle"
        />
      </GridLayout>
    </GridLayout>
    <StackLayout row="2" marginTop="20">
      <Label
        :text="
          t(
            available
              ? 'Open the dunes. Swipe from either edge to return.'
              : 'Try this on Android 14 or later with gesture navigation.',
          )
        "
        textWrap="true"
        fontSize="13"
        color="#6C4F3B"
      />
      <Label
        :text="t(backResult)"
        textWrap="true"
        marginTop="9"
        fontSize="11"
        color="#886851"
        accessibilityIdentifier="predictive-result"
      />
      <Button
        v-if="backAudit"
        :text="backReduced ? 'Reduce ON' : 'Reduce OFF'"
        accessibilityIdentifier="predictive-reduce"
        @tap="backReduced = !backReduced"
        fontSize="10"
      />
    </StackLayout>
  </GridLayout>
</template>
