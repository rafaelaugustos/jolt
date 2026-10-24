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
defineProps<{ embedded?: boolean }>()
</script>
<template>
  <StackLayout v-if="embedded" class="exhibit">
    <StackLayout class="ex-controls"
      ><GridLayout columns="*,*,*"
        ><Button col="0" text="Insert" @tap="insert" class="ex-primary" /><Button
          col="1"
          text="Remove"
          @tap="remove" /><Button
          col="2"
          text="Reverse"
          @tap="reverse" /></GridLayout></StackLayout
    ><StackLayout ref="list" marginTop="18"
      ><GridLayout
        v-for="card in cards"
        :key="card"
        :accessibilityLabel="`Layout card ${card}`"
        :accessibilityIdentifier="`layout-card-${card}`"
        columns="56,*,auto"
        :width="expanded === card ? 300 : 260"
        :height="expanded === card ? 142 : 86"
        :backgroundColor="['#DCE5CC', '#E5DDEE', '#EDDFD0'][(card - 1) % 3]"
        borderRadius="23"
        marginBottom="12"
        padding="16"
        horizontalAlignment="left"
        @tap="expand(card)"
        accessibilityRole="button"
        ><Label
          :text="['✦', '◉', '↗'][(card - 1) % 3]"
          fontSize="40"
          :color="['#5D7449', '#78628E', '#9A7356'][(card - 1) % 3]"
          verticalAlignment="middle" /><StackLayout col="1" verticalAlignment="middle"
          ><Label
            :text="['Make room.', 'Stay curious.', 'Go somewhere.'][(card - 1) % 3]"
            fontSize="18"
            fontWeight="bold"
            color="#34412E" /><Label
            v-if="expanded === card"
            text="A little more space&#10;for something good."
            textWrap="true"
            fontSize="12"
            color="#74816A"
            marginTop="12" /></StackLayout
        ><Label
          col="2"
          :text="expanded === card ? '−' : '+'"
          fontSize="20"
          color="#76816B"
          verticalAlignment="middle" /></GridLayout></StackLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*"
        ><Button
          col="0"
          :text="slow ? 'Normal layout' : 'Slow layout'"
          @tap="slow = !slow" /><Button
          col="1"
          text="Stop layout"
          @tap="stop" /></GridLayout></StackLayout
    ><Label
      text="Tap a card to make room. Add, remove or rearrange the collection."
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
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
</template>
