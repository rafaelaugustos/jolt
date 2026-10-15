<script lang="ts" setup>
import { isIOS } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { animate, stop, type Animation } from '@rafaelaugusto/jolt'
const card = ref()
const status = ref('Tap Morph, then interrupt it or stop halfway.')
let expanded = false
let current: Animation | undefined
async function morph() {
  expanded = !expanded
  const animation = animate(
    card.value,
    {
      borderRadius: expanded ? 60 : 8,
      borderWidth: expanded ? 8 : 2,
      borderColor: expanded ? '#e5a1ff' : '#b6ee64',
      rotate: expanded ? -6 : 0,
      ...(isIOS
        ? {
            shadowOpacity: expanded ? 0.65 : 0.2,
            shadowRadius: expanded ? 18 : 4,
            shadowOffsetX: expanded ? -10 : 0,
            shadowOffsetY: expanded ? 20 : 4,
          }
        : { elevation: expanded ? 28 : 2, translationZ: expanded ? 8 : 0 }),
    },
    { duration: 1800, ease: 'easeInOut' },
  )
  current = animation
  status.value = 'Changing shape…'
  const finished = await animation
  if (current === animation) status.value = finished ? 'Ready' : 'Stopped here'
}
function freeze() {
  stop(card.value)
}
onUnmounted(() => current?.stop())
</script>
<template>
  <StackLayout class="section">
    <Label class="heading" text="Corners, borders &amp; shadows" />
    <Label
      class="muted"
      :text="
        isIOS
          ? 'Core Animation keeps the shadow in shape.'
          : 'Native border redraws and real elevation shadows.'
      "
      textWrap="true"
    />
    <GridLayout height="240" marginTop="12" backgroundColor="#eeeeea">
      <GridLayout
        ref="card"
        width="180"
        height="120"
        borderRadius="8"
        borderWidth="2"
        borderColor="#b6ee64"
        backgroundColor="#263b27"
        androidElevation="2"
        :boxShadow="isIOS ? '0 4 8 rgba(0, 0, 0, 0.2)' : undefined"
      >
        <Label
          text="Jolt"
          textAlignment="center"
          verticalAlignment="middle"
          color="#d5ff91"
          fontSize="28"
          fontWeight="bold"
        />
      </GridLayout>
    </GridLayout>
    <GridLayout columns="*, *">
      <Button class="button" text="Morph" @tap="morph" />
      <Button col="1" class="button" text="Stop here" @tap="freeze" />
    </GridLayout>
    <Label class="muted" :text="status" textWrap="true" />
  </StackLayout>
</template>
