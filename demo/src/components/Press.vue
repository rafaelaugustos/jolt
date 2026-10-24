<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { press } from '@rafaelaugusto/jolt'

const plain = ref()
const dim = ref()
const tilt = ref()
let removers: (() => void)[] = []

onMounted(() => {
  removers = [
    press(plain.value),
    press(dim.value, { scale: 0.94, opacity: 0.6 }),
    press(tilt.value, { scale: 0.9, rotate: -4 }, 'bouncy'),
  ]
})

onUnmounted(() => removers.forEach((remove) => remove()))
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout rows="190,14,190" columns="*,14,*"
      ><GridLayout
        ref="plain"
        colSpan="3"
        backgroundColor="#263A2D"
        borderRadius="28"
        padding="24"
        accessibilityRole="button"
        accessibilityLabel="Press softly"
        ><Label
          text="A LITTLE CONNECTION"
          class="ex-kicker"
          verticalAlignment="top" /><Label
          text="Press play."
          fontSize="39"
          fontWeight="bold"
          color="#E3FC62"
          verticalAlignment="middle" /><Label
          text="↗"
          color="#E3FC62"
          fontSize="30"
          verticalAlignment="bottom"
          horizontalAlignment="right" /></GridLayout
      ><GridLayout
        ref="dim"
        row="2"
        backgroundColor="#E5DDEB"
        borderRadius="28"
        padding="20"
        accessibilityRole="button"
        accessibilityLabel="Dim on press"
        ><Label text="☾" fontSize="64" color="#715A83" verticalAlignment="top" /><Label
          text="Lights down."
          fontSize="20"
          fontWeight="bold"
          color="#59476A"
          verticalAlignment="bottom"
          textWrap="true" /></GridLayout
      ><GridLayout
        ref="tilt"
        row="2"
        col="2"
        backgroundColor="#EDDFCF"
        borderRadius="28"
        padding="20"
        accessibilityRole="button"
        accessibilityLabel="Tilt on press"
        ><Label text="✦" fontSize="64" color="#986F51" verticalAlignment="top" /><Label
          text="A little twist."
          fontSize="20"
          fontWeight="bold"
          color="#77513C"
          verticalAlignment="bottom"
          textWrap="true" /></GridLayout></GridLayout
    ><Label
      text="Hold each card. Let go. Notice the way it comes back."
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" text="Press" />
      <Label
        class="muted"
        textWrap="true"
        text="press(card), press(card, { scale: 0.94, opacity: 0.6 })"
      />

      <GridLayout columns="*, *, *" class="tiles">
        <Label ref="plain" class="tile" text="press()" />
        <Label ref="dim" col="1" class="tile" text="dim" />
        <Label ref="tilt" col="2" class="tile" text="tilt" />
      </GridLayout>
    </StackLayout>
  </template>
</template>
