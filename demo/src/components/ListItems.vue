<script lang="ts" setup>
import { isAndroid, type EventData, type ListView } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { animateItems } from '@rafaelaugusto/jolt'

const once = ref(false)
const items = ref(rows())
let list: ListView | undefined
let unlink: (() => void) | undefined

function rows() {
  return Array.from({ length: 60 }, (_, index) => ({ title: `Row ${index + 1}` }))
}
function arm() {
  unlink?.()
  unlink = list && animateItems(list, 'fadeInUp', { duration: 350, once: once.value })
}
function loaded(event: EventData) {
  list = event.object as ListView
  if (isAndroid) list.android.setNestedScrollingEnabled(true)
  arm()
}
function toggleOnce() {
  once.value = !once.value
  arm()
}
function reset() {
  items.value = rows()
  arm()
}
onUnmounted(() => unlink?.())
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="List rows" />
    <Label
      class="muted"
      textWrap="true"
      :text="`animateItems(list, 'fadeInUp', { once: ${once} })`"
    />

    <ListView
      :items="items"
      height="320"
      marginTop="12"
      separatorColor="transparent"
      @loaded="loaded"
    >
      <template #default="{ item }">
        <Label class="row" :text="item.title" />
      </template>
    </ListView>

    <GridLayout columns="*, *">
      <Button class="button" :text="once ? 'Once: on' : 'Once: off'" @tap="toggleOnce" />
      <Button col="1" class="button" text="New items" @tap="reset" />
    </GridLayout>
  </StackLayout>
</template>
