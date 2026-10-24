<script lang="ts" setup>
import { onUnmounted, ref } from 'nativescript-vue'
import { rollTo, type Animation } from '@rafaelaugusto/jolt'
const balance = ref()
const stagger = ref(false)
const status = ref('Tap a button')
let value = 1249.9
let current: Animation | undefined
function format(amount: number) {
  const [whole, cents] = amount.toFixed(2).split('.')
  return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`
}
async function roll(next: number) {
  value = Math.max(0, Math.round(next * 100) / 100)
  const animation = rollTo(balance.value, value, {
    format,
    stagger: stagger.value ? 40 : 0,
  })
  current = animation
  status.value = 'Rolling…'
  const finished = await animation
  if (current === animation) {
    current = undefined
    status.value = finished ? `Settled on ${format(value)}` : 'Replaced'
  }
}
onUnmounted(() => current?.stop())
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        text="THE EVERYDAY ACCOUNT"
        class="ex-kicker"
        verticalAlignment="top" /><StackLayout verticalAlignment="middle"
        ><Label text="Your balance" color="#B3C1A8" fontSize="16" /><Label
          ref="balance"
          :text="format(value)"
          fontSize="44"
          fontWeight="bold"
          color="#F2F4DF"
          letterSpacing="-.04"
          accessible="true"
          marginTop="8" /><Label
          text="GOOD THINGS ADD UP."
          color="#A3B77E"
          fontSize="9"
          letterSpacing=".1"
          marginTop="18" /></StackLayout
      ><GridLayout columns="*,auto" verticalAlignment="bottom"
        ><Label text="JOLT / PERSONAL" class="ex-kicker" /><Label
          col="1"
          text="↗"
          fontSize="30"
          color="#E3FC62" /></GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*,*"
        ><Button
          col="0"
          text="+ 1.10"
          @tap="roll(value + 1.1)"
          class="ex-primary" /><Button
          col="1"
          text="− 1.10"
          @tap="roll(value - 1.1)" /><Button
          col="2"
          text="Random"
          @tap="roll(Math.random() * 20000)" /></GridLayout
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="stagger ? 'Stagger: 40 ms' : 'Stagger: off'"
          @tap="stagger = !stagger" /></GridLayout></StackLayout
    ><Label :text="status" class="ex-note" textWrap="true" />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" text="Rolling numbers" />
      <Label
        class="muted"
        text="Only the digits that change move. The label holds the final value from the first frame."
        textWrap="true"
      />
      <Label
        ref="balance"
        :text="format(value)"
        accessible="true"
        fontSize="44"
        fontWeight="bold"
        marginTop="16"
      />
      <Label class="muted" :text="status" marginTop="12" />
      <GridLayout columns="*, *, *">
        <Button class="button" text="+ 1.10" @tap="roll(value + 1.1)" />
        <Button col="1" class="button" text="− 1.10" @tap="roll(value - 1.1)" />
        <Button col="2" class="button" text="Random" @tap="roll(Math.random() * 20000)" />
      </GridLayout>
      <Button
        class="button"
        :text="stagger ? 'Stagger: 40 ms' : 'Stagger: off'"
        @tap="stagger = !stagger"
      />
    </StackLayout>
  </template>
</template>
