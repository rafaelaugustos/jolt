<script setup lang="ts">
import { useRouter } from 'vue-router-ns'
import type { EventData, View } from '@nativescript/core'
import { usePreviewI18n } from './i18n'
import {
  interactiveAudit,
  interactiveLocked,
  interactiveResult,
  interactiveControl,
  interactiveCancelNext,
  createInteractiveEntry,
} from './interactive-navigation'
const router = useRouter(),
  { t } = usePreviewI18n()
async function nested(event: EventData) {
  const motion = createInteractiveEntry((event.object as View).page.frame)
  try {
    await router.push('/interactive-navigation/nested', { transition: motion.transition })
    if (motion.state === 'ready') motion.dispose()
  } catch (error) {
    motion.dispose()
    throw error
  }
}
</script>
<template>
  <Page
    id="interactive-detail-page"
    actionBarHidden="true"
    backgroundColor="#123E3B"
    statusBarStyle="light"
    :enableSwipeBackNavigation="!interactiveLocked"
  >
    <GridLayout rows="auto,*,auto,auto" backgroundColor="#123E3B" padding="18 24 24">
      <GridLayout columns="auto,*,auto" height="54" marginBottom="16">
        <Label
          text="←"
          width="44"
          height="44"
          borderRadius="22"
          backgroundColor="#28544F"
          color="#F5F1E4"
          fontSize="26"
          textAlignment="center"
          verticalAlignment="middle"
          accessibilityIdentifier="interactive-back"
          :accessibilityLabel="t('Back to the coast')"
          accessibilityRole="button"
          @tap="router.back()"
        />
        <Label
          col="1"
          :text="t('OUT OF OFFICE')"
          fontSize="10"
          letterSpacing="0.16"
          color="#B7D3C7"
          horizontalAlignment="center"
          verticalAlignment="middle"
        />
        <Label
          col="2"
          text="01 / 03"
          fontSize="10"
          color="#B7D3C7"
          verticalAlignment="middle"
        />
      </GridLayout>
      <GridLayout
        row="1"
        rows="*,auto"
        borderRadius="12"
        clipToBounds="true"
        backgroundColor="#47776B"
      >
        <Image
          src="~/assets/studio/cove.png"
          stretch="aspectFill"
          rowSpan="2"
          accessibilityIdentifier="interactive-detail-image"
        />
        <StackLayout row="1" padding="22" backgroundColor="rgba(18,62,59,0.75)">
          <Label
            :text="t('Stay a\nlittle longer.')"
            textWrap="true"
            fontSize="42"
            fontWeight="700"
            color="#FFF9E9"
          />
          <Label
            text="CALA SERENA  ·  41° 18′ N"
            fontSize="9"
            letterSpacing="0.1"
            marginTop="12"
            color="#D9E8DC"
          />
        </StackLayout>
      </GridLayout>
      <GridLayout row="2" columns="auto,*" marginTop="24" marginBottom="22">
        <Label
          text="←"
          fontSize="32"
          color="#DCF1A5"
          marginRight="18"
          verticalAlignment="middle"
        />
        <StackLayout col="1">
          <Label
            :text="t('Nothing is final until you let go.')"
            fontSize="17"
            fontWeight="600"
            color="#F5F1E4"
            textWrap="true"
          />
          <Label
            :text="t('Drag a little to peek. Go further to return.')"
            fontSize="12"
            color="#B7D3C7"
            marginTop="8"
            textWrap="true"
          />
        </StackLayout>
      </GridLayout>
      <StackLayout row="3" borderTopWidth="1" borderTopColor="#3C6159" paddingTop="16">
        <Label
          :text="t(interactiveResult)"
          fontSize="11"
          color="#B7D3C7"
          textWrap="true"
          accessibilityIdentifier="interactive-detail-result"
        />
        <GridLayout v-if="interactiveAudit" columns="*,*">
          <Button
            :text="interactiveLocked ? 'Unlock' : 'Lock'"
            accessibilityIdentifier="interactive-lock"
            @tap="interactiveLocked = !interactiveLocked"
            fontSize="10"
          />
          <Button
            col="1"
            text="Dispose"
            accessibilityIdentifier="interactive-dispose"
            @tap="interactiveControl?.dispose()"
            fontSize="10"
          />
        </GridLayout>
        <GridLayout v-if="interactiveAudit" columns="*,*">
          <Button
            text="Cancel next"
            accessibilityIdentifier="interactive-cancel-next"
            @tap="interactiveCancelNext = true"
            fontSize="10"
          />
          <Button
            col="1"
            text="Nested"
            accessibilityIdentifier="interactive-nested"
            @tap="nested"
            fontSize="10"
          />
        </GridLayout>
      </StackLayout>
    </GridLayout>
  </Page>
</template>
