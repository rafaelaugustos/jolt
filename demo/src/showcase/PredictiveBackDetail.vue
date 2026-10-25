<script setup lang="ts">
import { onBeforeRouteLeave, useRouter } from 'vue-router-ns'
import { ref, onUnmounted } from 'nativescript-vue'
import type { EventData, View } from '@nativescript/core'
import type { PredictiveBack } from '@rafaelaugusto/jolt/predictive-back'
import { usePreviewI18n } from './i18n'
import {
  backAudit,
  backLocked,
  backCancelNext,
  backResult,
  bindBack,
} from './predictive-back'
const router = useRouter(),
  { t } = usePreviewI18n(),
  keyboard = ref(false)
backLocked.value = false
let surface: View | undefined, control: PredictiveBack | undefined
let reload: ReturnType<typeof setTimeout> | undefined
function loaded(event: EventData) {
  surface = event.object as View
  if (reload !== undefined) clearTimeout(reload)
  // Core unloads/reloads views when the Activity stops/starts too.
  reload = setTimeout(shown, 0)
}
function shown() {
  if (!surface?.isLoaded || (control?.supported && control.state !== 'disposed')) return
  control?.dispose()
  control = bindBack(
    surface,
    async (options) => (await router.back(options)) === undefined,
  )
}
onBeforeRouteLeave(() => !backLocked.value)
onUnmounted(() => {
  if (reload !== undefined) clearTimeout(reload)
  if (control?.state !== 'committing') control?.dispose()
})
</script>
<template>
  <Page
    id="predictive-detail-page"
    actionBarHidden="true"
    backgroundColor="#1B1515"
    androidStatusBarBackground="#1B1515"
    statusBarStyle="light"
    @navigatedTo="shown"
  >
    <GridLayout backgroundColor="#1B1515" padding="12">
      <GridLayout
        rows="auto,*,auto,auto"
        borderRadius="28"
        clipToBounds="true"
        backgroundColor="#F0E3CF"
        @loaded="loaded"
        accessibilityIdentifier="predictive-surface"
      >
        <GridLayout columns="auto,*,auto" height="66" padding="14 18">
          <Label
            text="←"
            width="38"
            height="38"
            borderRadius="19"
            backgroundColor="#E1CEB5"
            color="#38271E"
            fontSize="24"
            textAlignment="center"
            verticalAlignment="middle"
            accessibilityIdentifier="predictive-back"
            :accessibilityLabel="t('Back to the dunes')"
            accessibilityRole="button"
            @tap="control?.back()"
          />
          <Label
            col="1"
            :text="t('THE SLOW HOURS')"
            fontSize="10"
            letterSpacing=".14"
            color="#6C4F3B"
            horizontalAlignment="center"
            verticalAlignment="middle"
          />
          <Label
            col="2"
            text="☼"
            fontSize="24"
            color="#AE502B"
            verticalAlignment="middle"
          />
        </GridLayout>
        <GridLayout
          row="1"
          rows="auto,*,auto"
          margin="0 12"
          borderRadius="18"
          clipToBounds="true"
        >
          <Image rowSpan="3" src="~/assets/studio/dunes.png" stretch="aspectFill" />
          <Label
            :text="t('A softer kind\nof escape.')"
            textWrap="true"
            fontSize="39"
            fontWeight="700"
            color="#FFF1D7"
            margin="28 22"
          />
          <GridLayout
            row="2"
            columns="*,auto"
            padding="22"
            backgroundColor="rgba(43,26,24,.55)"
          >
            <Label
              :text="t('GOLDEN HOUR')"
              fontSize="10"
              letterSpacing=".16"
              color="#FFE0BF"
              verticalAlignment="middle"
            />
            <Label col="1" text="18:42" fontSize="24" fontWeight="600" color="#FFF1D7" />
          </GridLayout>
        </GridLayout>
        <StackLayout row="2" padding="22 24 18">
          <Label
            :text="t('Stay. Or drift away.')"
            fontSize="23"
            fontWeight="700"
            color="#38271E"
          />
          <Label
            :text="t('Swipe in from either edge. Pull back to stay.')"
            textWrap="true"
            fontSize="13"
            color="#6C4F3B"
            marginTop="9"
          />
          <Label
            :text="t(backResult)"
            textWrap="true"
            marginTop="16"
            fontSize="11"
            color="#886851"
            accessibilityIdentifier="predictive-detail-result"
          />
        </StackLayout>
        <StackLayout v-if="backAudit" row="3" padding="0 10 6">
          <GridLayout columns="*,*,*">
            <Button
              :text="backLocked ? 'Unlock' : 'Lock'"
              accessibilityIdentifier="predictive-lock"
              @tap="backLocked = !backLocked"
              fontSize="10"
            />
            <Button
              col="1"
              text="Cancel"
              accessibilityIdentifier="predictive-cancel"
              @tap="backCancelNext = true"
              fontSize="10"
            />
            <Button
              col="2"
              text="Dispose"
              accessibilityIdentifier="predictive-dispose"
              @tap="control?.dispose()"
              fontSize="10"
            />
          </GridLayout>
          <GridLayout columns="*,*">
            <Button
              text="Disable"
              accessibilityIdentifier="predictive-disable"
              @tap="control &amp;&amp; (control.enabled = false)"
              fontSize="10"
            />
            <Button
              col="1"
              text="Keyboard"
              accessibilityIdentifier="predictive-keyboard"
              @tap="keyboard = !keyboard"
              fontSize="10"
            />
          </GridLayout>
          <TextField
            v-if="keyboard"
            hint="Keyboard"
            accessibilityIdentifier="predictive-input"
          />
        </StackLayout>
      </GridLayout>
    </GridLayout>
  </Page>
</template>
