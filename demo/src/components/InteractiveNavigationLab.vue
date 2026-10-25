<script setup lang="ts">
import type { EventData, View } from '@nativescript/core'
import { useRouter } from 'vue-router-ns'
import { configure } from '@rafaelaugusto/jolt'
import { usePreviewI18n } from '../showcase/i18n'
import {
  createInteractiveEntry,
  interactiveResult,
  interactiveAudit,
  interactiveReduced,
} from '../showcase/interactive-navigation'
const { t } = usePreviewI18n()
const router = useRouter()
defineProps<{ embedded?: boolean }>()
defineEmits(['back'])
let opening = false
async function open(event: EventData) {
  if (opening) return
  opening = true
  configure({ reducedMotion: interactiveReduced.value ? 'always' : 'user' })
  const frame = (event.object as View).page.frame
  const motion = createInteractiveEntry(frame)
  try {
    await router.push('/interactive-navigation', { transition: motion.transition })
    if (motion.state === 'ready') motion.dispose()
  } catch (error) {
    motion.dispose()
    throw error
  } finally {
    opening = false
  }
}
</script>
<template>
  <GridLayout rows="auto,*,auto,auto" backgroundColor="#E6EBE3" padding="24">
    <GridLayout columns="*,auto" marginBottom="18">
      <StackLayout>
        <Label
          :text="t('FIELD NOTES / 061')"
          fontSize="10"
          letterSpacing="0.16"
          color="#52635D"
        />
        <Label
          :text="t('Follow the tide.')"
          fontSize="29"
          fontWeight="700"
          color="#143F3B"
          marginTop="8"
        />
      </StackLayout>
      <Label col="1" text="↗" fontSize="32" color="#143F3B" />
    </GridLayout>
    <GridLayout
      row="1"
      rows="*,auto"
      backgroundColor="#184E48"
      borderRadius="24"
      clipToBounds="true"
      accessibilityIdentifier="interactive-open"
      :accessibilityLabel="t('Explore the coast')"
      accessibilityRole="button"
      @tap="open"
    >
      <Image src="~/assets/studio/cove.png" stretch="aspectFill" />
      <GridLayout row="1" columns="*,auto" padding="20">
        <StackLayout>
          <Label text="Cala Serena" fontSize="25" fontWeight="700" color="#F5F1E4" />
          <Label
            :text="t('A little further. A little slower.')"
            fontSize="12"
            color="#B7D3C7"
            marginTop="6"
          />
        </StackLayout>
        <Label
          col="1"
          text="→"
          fontSize="28"
          color="#DCF1A5"
          verticalAlignment="middle"
        />
      </GridLayout>
    </GridLayout>
    <GridLayout row="2" columns="auto,*" marginTop="22" marginBottom="16">
      <Label text="←" fontSize="28" color="#143F3B" marginRight="14" />
      <StackLayout col="1">
        <Label
          :text="t('Take a look. Come back your way.')"
          fontSize="14"
          fontWeight="600"
          color="#143F3B"
          textWrap="true"
        />
        <Label
          :text="t('Open the coast, then drag from the left edge.')"
          fontSize="12"
          color="#52635D"
          textWrap="true"
          marginTop="6"
        />
      </StackLayout>
    </GridLayout>
    <StackLayout row="3">
      <Label
        :text="t(interactiveResult)"
        fontSize="11"
        color="#52635D"
        textWrap="true"
        accessibilityIdentifier="interactive-result"
      />
      <Button
        v-if="interactiveAudit"
        text="Reduce"
        accessibilityIdentifier="interactive-reduce"
        @tap="interactiveReduced = !interactiveReduced"
        fontSize="10"
      />
    </StackLayout>
  </GridLayout>
</template>
