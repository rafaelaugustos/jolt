<script setup lang="ts">
import type { EventData, View } from '@nativescript/core'
import { useRouter } from 'vue-router-ns'
import { usePreviewI18n } from '../showcase/i18n'
import {
  openSharedEntry,
  entryResult,
  entryMissing,
  entryReduced,
  entryShifted,
  entryAudit,
} from '../showcase/shared-entry'
const { t } = usePreviewI18n(),
  router = useRouter()
defineProps<{ embedded?: boolean }>()
defineEmits(['back'])
function open(event: EventData, mode: string) {
  void openSharedEntry(
    (event.object as View).page.frame,
    mode,
    (options) => router.push(`/shared-entry/${mode}`, options),
    async (options) => (await router.back(options)) === undefined,
  )
}
</script>
<template>
  <GridLayout rows="auto,*,auto,auto" backgroundColor="#E9EAE2" padding="22">
    <GridLayout columns="*,auto" marginBottom="18">
      <StackLayout
        ><Label
          :text="t('ONE CONTINUOUS THING / 063')"
          fontSize="10"
          letterSpacing="0.16"
          color="#52635D" /><Label
          :text="t('Keep the connection.')"
          fontSize="25"
          fontWeight="700"
          color="#153A35"
          marginTop="6"
      /></StackLayout>
      <Label col="1" text="↗" fontSize="31" color="#153A35" />
    </GridLayout>
    <GridLayout
      row="1"
      rows="*,auto"
      :marginLeft="entryShifted ? 35 : 0"
      :marginRight="entryShifted ? 0 : 35"
    >
      <Image
        row="0"
        src="~/assets/studio/cove.png"
        stretch="aspectFill"
        borderRadius="26"
        sharedTransitionTag="interactive-cove"
        accessibilityIdentifier="shared-entry-photo"
        :accessibilityLabel="t('Open the cove')"
        accessibilityRole="button"
        @tap="open($event, 'image')"
      />
      <GridLayout row="1" columns="*,auto" padding="14 2 20">
        <StackLayout
          ><Label
            text="Cala Serena"
            fontSize="22"
            fontWeight="700"
            color="#153A35" /><Label
            :text="t('Salt in the air. Nothing on the clock.')"
            fontSize="11"
            color="#52635D"
            marginTop="4"
        /></StackLayout>
        <Label
          col="1"
          text="01"
          color="#52635D"
          fontSize="13"
          verticalAlignment="middle"
        />
      </GridLayout>
    </GridLayout>
    <GridLayout
      row="2"
      sharedTransitionTag="interactive-pass"
      columns="*,auto"
      borderRadius="18"
      backgroundColor="#D1E5C4"
      padding="16"
      accessibilityIdentifier="shared-entry-pass"
      :accessibilityLabel="t('Open the day pass')"
      accessibilityRole="button"
      @tap="open($event, 'card')"
    >
      <StackLayout
        ><Label
          :text="t('YOUR DAY PASS')"
          color="#3A5848"
          fontSize="9"
          letterSpacing="0.15" /><Label
          :text="t('One day, all yours.')"
          color="#153A35"
          fontSize="18"
          fontWeight="700"
          marginTop="6" /></StackLayout
      ><Label col="1" text="→" color="#153A35" fontSize="26" verticalAlignment="middle" />
    </GridLayout>
    <StackLayout row="3" marginTop="16">
      <Label
        :text="t(entryResult)"
        color="#52635D"
        fontSize="11"
        textWrap="true"
        accessibilityIdentifier="shared-entry-result"
      />
      <GridLayout v-if="entryAudit" columns="*,*,*" marginTop="4">
        <Button
          text="Missing"
          accessibilityIdentifier="shared-entry-missing"
          @tap="entryMissing = !entryMissing"
          fontSize="10"
        />
        <Button
          col="1"
          text="Reduce"
          accessibilityIdentifier="shared-entry-reduce"
          @tap="entryReduced = !entryReduced"
          fontSize="10"
        />
        <Button
          col="2"
          text="Move"
          accessibilityIdentifier="shared-entry-move"
          @tap="entryShifted = !entryShifted"
          fontSize="10"
        />
      </GridLayout>
    </StackLayout>
  </GridLayout>
</template>
