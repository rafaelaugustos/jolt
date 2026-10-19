<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { useMotionScope } from '@rafaelaugusto/jolt/vue'
import type { Animation } from '@rafaelaugusto/jolt'
const scope = useMotionScope()
const list = ref()
const cards = ref([1, 2, 3])
const expanded = ref<number>()
const slow = ref(false)
const scaleSize = ref(true)
const status = ref('Ready')
let next = 3,
  request = 0
let current: Animation | undefined
function change(name: string, mutate: () => void) {
  const version = ++request
  status.value = `Moving · ${name}`
  current = scope.animateLayout(list.value, mutate, {
    ...(slow.value
      ? { duration: 4000, ease: 'linear' as const }
      : { type: 'spring' as const, duration: 450, bounce: 0 }),
    size: scaleSize.value ? 'scale' : false,
  })
  void current.finished.then((finished) => {
    if (version === request)
      status.value = `${finished ? 'Settled' : 'Cancelled'} · ${name}`
  })
}
function insert() {
  change('Insert', () => cards.value.splice(1, 0, ++next))
}
function remove() {
  if (cards.value.length > 1) change('Remove', () => cards.value.splice(1, 1))
}
function reverse() {
  change('Reverse', () => cards.value.reverse())
}
function expand(card: number) {
  change(
    `Card ${card}`,
    () => (expanded.value = expanded.value === card ? undefined : card),
  )
}
function stop() {
  request++
  current?.stop()
  status.value = 'Stopped'
}
</script>
<template>
  <StackLayout>
    <Label
      class="muted"
      text="Insert, reorder or tap a card to resize it."
      textWrap="true"
    />
    <GridLayout columns="*,*,*">
      <Button text="Insert" @tap="insert" :isEnabled="cards.length < 5" />
      <Button col="1" text="Remove" @tap="remove" :isEnabled="cards.length > 1" />
      <Button col="2" text="Reverse" @tap="reverse" />
    </GridLayout>
    <Label :text="status" accessibilityIdentifier="layout-status" class="note" />
    <StackLayout ref="list" marginTop="12" horizontalAlignment="left">
      <Button
        v-for="card in cards"
        :key="card"
        :text="`Card ${card}`"
        :accessibilityLabel="`Layout card ${card}`"
        :accessibilityIdentifier="`layout-card-${card}`"
        :width="expanded === card ? 300 : 240"
        :height="expanded === card ? 100 : 54"
        :backgroundColor="card === 1 ? '#315f95' : '#455f41'"
        color="white"
        margin="0 0 8 0"
        borderRadius="12"
        horizontalAlignment="left"
        @tap="expand(card)"
      />
    </StackLayout>
    <GridLayout columns="*,*" marginTop="12">
      <Button :text="slow ? 'Normal layout' : 'Slow layout'" @tap="slow = !slow" />
      <Button col="1" text="Stop layout" @tap="stop" />
    </GridLayout>
    <Button
      :text="scaleSize ? 'Size: scale' : 'Size: instant'"
      @tap="scaleSize = !scaleSize"
    />
    <Label
      class="note"
      textWrap="true"
      text="Scale smooths size changes and temporarily stretches content. Instant size only animates the other cards moving into place."
    />
  </StackLayout>
</template>
