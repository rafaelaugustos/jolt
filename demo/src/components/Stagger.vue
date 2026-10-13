<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { animate, type Stagger } from '@rafaelaugusto/jolt'

const rows = ref([])
const items = ['Inbox', 'Starred', 'Snoozed', 'Sent', 'Drafts']

function replay(stagger: Stagger) {
  animate(rows.value, 'fadeInLeft', { stagger })
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Stagger" />
    <Label
      class="muted"
      textWrap="true"
      text="animate(rows, 'fadeInLeft', { stagger: 50 })"
    />

    <StackLayout class="list">
      <Label v-for="item in items" :key="item" ref="rows" class="row" :text="item" />
    </StackLayout>

    <GridLayout columns="*, *">
      <Button class="button" text="From the top" @tap="replay({ each: 50 })" />
      <Button
        col="1"
        class="button"
        text="From the center"
        @tap="replay({ each: 50, from: 'center' })"
      />
    </GridLayout>
  </StackLayout>
</template>
