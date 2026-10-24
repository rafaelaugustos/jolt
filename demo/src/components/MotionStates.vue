<script setup lang="ts">
import { usePreviewI18n } from '../showcase/i18n'
import { ref } from 'nativescript-vue'
import MotionCard from './MotionCard.vue'
const { t } = usePreviewI18n()
const mounted = ref(true)
defineProps<{ embedded?: boolean }>()
</script>
<template>
  <StackLayout v-if="embedded" class="exhibit">
    <MotionCard v-if="mounted" :embedded="true" /><GridLayout v-else class="ex-stage"
      ><Label
        :text="t('A fresh start\nis one tap away.')"
        class="ex-title"
        textWrap="true"
        verticalAlignment="middle" /></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="t(mounted ? 'Unmount card' : 'Mount card')"
          @tap="mounted = !mounted" /></GridLayout></StackLayout
    ><Label
      :text="t('Interrupt, retry, start over. Every state gets a considered transition.')"
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Motion states &amp; scopes')" />
      <Label
        class="muted"
        :text="
          t(
            'Change direction during an upload. Pause the scope, or unmount the card while it moves.',
          )
        "
        textWrap="true"
      />
      <MotionCard v-if="mounted" />
      <Button
        :text="t(mounted ? 'Unmount card' : 'Mount card')"
        @tap="mounted = !mounted"
      />
    </StackLayout>
  </template>
</template>
