<script setup lang="ts">
import type { EventData, View } from '@nativescript/core'
import { useRouter } from 'vue-router-ns'
import { configure } from '@rafaelaugusto/jolt'
import { usePreviewI18n } from '../showcase/i18n'
import {
  navigateShared,
  navigationResult,
  navigationMissing,
  navigationReduced,
  navigationShifted,
  navigationChecks,
} from '../showcase/shared-navigation'
const { t } = usePreviewI18n()
const router = useRouter()
defineProps<{ embedded?: boolean }>()
defineEmits(['back'])
function open(event: EventData, mode: string) {
  configure({ reducedMotion: navigationReduced.value ? 'always' : 'user' })
  navigateShared(event.object as View, mode === 'image' ? 'cove' : 'pass', (options) =>
    router.push(`/shared-navigation/${mode}`, options),
  )
}
</script>
<template>
  <GridLayout rows="auto,*,auto,auto" backgroundColor="#E9EAE2" padding="22">
    <GridLayout columns="*,auto" marginBottom="18">
      <StackLayout
        ><Label
          :text="t('SOMEWHERE SLOW')"
          fontSize="10"
          letterSpacing="0.16"
          color="#52635D" /><Label
          :text="t('A change of scenery.')"
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
      :marginLeft="navigationShifted ? 35 : 0"
      :marginRight="navigationShifted ? 0 : 35"
    >
      <Image
        row="0"
        src="~/assets/studio/cove.png"
        stretch="aspectFill"
        borderRadius="26"
        sharedTransitionTag="cove"
        accessibilityIdentifier="navigation-photo"
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
      sharedTransitionTag="pass"
      columns="*,auto"
      borderRadius="18"
      backgroundColor="#D1E5C4"
      padding="16"
      accessibilityIdentifier="navigation-pass"
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
        :text="t(navigationResult)"
        color="#52635D"
        fontSize="11"
        textWrap="true"
        accessibilityIdentifier="navigation-result"
      />
      <GridLayout v-if="navigationChecks" columns="*,*,*" marginTop="4">
        <Button
          text="Missing"
          accessibilityIdentifier="navigation-missing"
          @tap="navigationMissing = !navigationMissing"
          fontSize="10"
        />
        <Button
          col="1"
          text="Reduce"
          accessibilityIdentifier="navigation-reduce"
          @tap="navigationReduced = !navigationReduced"
          fontSize="10"
        />
        <Button
          col="2"
          text="Move"
          accessibilityIdentifier="navigation-move"
          @tap="navigationShifted = !navigationShifted"
          fontSize="10"
        />
      </GridLayout>
    </StackLayout>
  </GridLayout>
</template>
