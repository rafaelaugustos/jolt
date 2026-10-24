<script setup lang="ts">
import { ref } from 'nativescript-vue'
import MotionCard from './MotionCard.vue'
const mounted = ref(true)
defineProps<{ embedded?: boolean }>()
</script>
<template>
  <StackLayout v-if="embedded" class="exhibit">
    <MotionCard v-if="mounted" :embedded="true" /><GridLayout v-else class="ex-stage"
      ><Label
        text="A fresh start&#10;is one tap away."
        class="ex-title"
        textWrap="true"
        verticalAlignment="middle" /></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="mounted ? 'Unmount card' : 'Mount card'"
          @tap="mounted = !mounted" /></GridLayout></StackLayout
    ><Label
      text="Interrupt, retry, start over. Every state gets a considered transition."
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" text="Motion states & scopes" />
      <Label
        class="muted"
        text="Change direction during an upload. Pause the scope, or unmount the card while it moves."
        textWrap="true"
      />
      <MotionCard v-if="mounted" />
      <Button :text="mounted ? 'Unmount card' : 'Mount card'" @tap="mounted = !mounted" />
    </StackLayout>
  </template>
</template>
