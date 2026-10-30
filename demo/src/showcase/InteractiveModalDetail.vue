<script setup lang="ts">
import type { EventData, View } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { configure } from '@rafaelaugusto/jolt'
import type { InteractiveModal } from '@rafaelaugusto/jolt/interactive-navigation'
import { usePreviewI18n } from './i18n'
import {
  modalAuditEnabled,
  modalLocked,
  modalCancelNext,
  modalReduced,
  modalRoot,
  modalSnapshot,
  modalUnmounted,
  modalDisposeNext,
} from './interactive-modal'
const { t } = usePreviewI18n()
const props = defineProps<{ motion: InteractiveModal; scroll?: boolean }>()
const scroller = ref()
const audit = modalAuditEnabled()
let view: View | undefined
function loaded(event: EventData) {
  view = event.object as View
  modalRoot(view)
}
function reduce() {
  modalReduced.value = !modalReduced.value
  configure({ reducedMotion: modalReduced.value ? 'always' : 'user' })
  modalSnapshot('reduced')
}
function dispose() {
  props.motion.dispose()
  modalSnapshot('disposed')
}
function closeTwice() {
  modalSnapshot('close-twice', [
    props.motion.close('first'),
    props.motion.close('second'),
  ])
}
onUnmounted(modalUnmounted)
</script>
<template>
  <Page
    actionBarHidden="true"
    backgroundColor="#143F3B"
    statusBarStyle="light"
    @loaded="loaded"
  >
    <GridLayout rows="auto,*,auto" padding="18 24 24" backgroundColor="#143F3B">
      <GridLayout
        rows="auto,auto"
        columns="*,auto"
        automationText="modal-handle"
        padding="10 0 20"
      >
        <Label
          text="━"
          color="#B7D3C7"
          fontSize="26"
          horizontalAlignment="center"
          colSpan="2"
        />
        <Label
          row="1"
          :text="t('STAY A LITTLE LONGER')"
          color="#D7EDA8"
          fontSize="11"
          letterSpacing="0.1"
          verticalAlignment="middle"
          textWrap="true"
        />
        <Button
          row="1"
          col="1"
          text="×"
          automationText="modal-close"
          :accessibilityLabel="t('Close')"
          fontSize="25"
          color="#F5F1E4"
          backgroundColor="#2C5C52"
          minWidth="48"
          minHeight="48"
          borderRadius="24"
          @tap="motion.close('button')"
        />
      </GridLayout>
      <GridLayout
        row="1"
        rows="*,auto"
        borderRadius="24"
        clipToBounds="true"
        automationText="modal-photo"
      >
        <Image src="~/assets/studio/cove.png" stretch="aspectFill" />
        <ScrollView
          v-if="audit && scroll"
          ref="scroller"
          row="1"
          height="110"
          automationText="modal-scroll"
          backgroundColor="#28584E"
        >
          <StackLayout
            ><Label
              v-for="n in 20"
              :key="n"
              :text="'Coastal note ' + n"
              height="44"
              color="#F5F1E4"
              padding="12"
          /></StackLayout>
        </ScrollView>
      </GridLayout>
      <StackLayout row="2" marginTop="22">
        <Label
          text="Cala Serena"
          fontSize="30"
          fontWeight="700"
          color="#F5F1E4"
          textWrap="true"
        />
        <Label
          :text="t('A little further. A little slower.')"
          fontSize="14"
          color="#B7D3C7"
          textWrap="true"
          marginTop="8"
        />
        <Label
          :text="t('Pull down to return. Let go early to stay.')"
          fontSize="13"
          color="#D7EDA8"
          textWrap="true"
          marginTop="18"
        />
        <WrapLayout v-if="audit" marginTop="12">
          <Button
            text="Snapshot"
            automationText="modal-snapshot"
            fontSize="10"
            @tap="
              modalSnapshot('snapshot', { scroll: scroller?.nativeView?.verticalOffset })
            "
          />
          <Button
            text="Lock"
            automationText="modal-lock"
            fontSize="10"
            @tap="modalLocked = !modalLocked"
          />
          <Button
            text="Cancel"
            automationText="modal-cancel"
            fontSize="10"
            @tap="modalCancelNext = true"
          />
          <Button
            text="Reduce"
            automationText="modal-reduce"
            fontSize="10"
            @tap="reduce"
          />
          <Button
            text="Dispose"
            automationText="modal-dispose"
            fontSize="10"
            @tap="dispose"
          />
          <Button
            text="Core close"
            automationText="modal-core-close"
            fontSize="10"
            @tap="view?.closeModal('core')"
          />
          <Button
            text="Close twice"
            automationText="modal-close-twice"
            fontSize="10"
            @tap="closeTwice"
          />
          <Button
            text="Dispose next"
            automationText="modal-dispose-next"
            fontSize="10"
            @tap="modalDisposeNext = true"
          />
        </WrapLayout>
      </StackLayout>
    </GridLayout>
  </Page>
</template>
