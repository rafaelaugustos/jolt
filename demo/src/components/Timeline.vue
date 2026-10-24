<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { sequence, type Animation, type Step } from '@rafaelaugusto/jolt'

const badge = ref()
const title = ref()
const caption = ref()
const actions = ref()
const status = ref('Choose a rhythm and replay.')
type Mode = 'overlap' | 'sequential' | 'fixed'
let current: Animation | undefined
let generation = 0

function replay(mode: Mode) {
  current?.stop()
  const own = ++generation
  const steps: Step[] = [
    [badge.value, 'popIn', { type: 'spring', duration: 1000, bounce: 0.35 }],
    [title.value, 'fadeInUp', { duration: 700 }],
    [caption.value, 'fadeInUp', { duration: 700 }],
    [actions.value, 'fadeInUp', { duration: 500 }],
  ]
  if (mode === 'overlap') {
    steps[1] = [title.value, 'fadeInUp', { duration: 700, at: '-250' }]
    steps[2] = [caption.value, 'fadeInUp', { duration: 700, at: '<' }]
    steps[3] = [actions.value, 'fadeInUp', { duration: 500, at: 1200 }]
    status.value = 'Title overlaps the badge. Caption joins it. Actions at 1200 ms.'
  } else if (mode === 'fixed') {
    steps[1] = [title.value, 'fadeInUp', { duration: 700, at: 300 }]
    steps[2] = [caption.value, 'fadeInUp', { duration: 700, at: '<' }]
    steps[3] = [actions.value, 'fadeInUp', { duration: 500, at: 900 }]
    status.value = 'Title and caption at 300 ms. Actions at 900 ms.'
  } else status.value = 'Each step waits for the previous arrival.'
  current = sequence(steps)
  void current.finished.then((finished) => {
    if (generation === own)
      status.value = finished ? 'Finished — choose a rhythm to replay.' : 'Stopped'
  })
}
function freeze() {
  current?.stop()
}
onMounted(() => replay('overlap'))
onUnmounted(() => {
  generation++
  freeze()
})
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        ref="badge"
        text="↗"
        fontSize="38"
        color="#E3FC62"
        width="64"
        height="64"
        borderWidth="1"
        borderColor="#657C47"
        borderRadius="32"
        textAlignment="center"
        horizontalAlignment="left"
        verticalAlignment="top" /><Label
        ref="title"
        text="Your next&#10;great escape."
        class="ex-title"
        textWrap="true"
        verticalAlignment="middle" /><Label
        ref="caption"
        text="A little closer to somewhere new."
        class="ex-copy"
        verticalAlignment="bottom"
        marginBottom="62" /><GridLayout
        ref="actions"
        columns="*,auto"
        height="44"
        verticalAlignment="bottom"
        backgroundColor="#E3FC62"
        borderRadius="14"
        padding="0 16"
        ><Label
          text="LET’S GO SOMEWHERE"
          color="#2C3C29"
          fontSize="10"
          letterSpacing=".08"
          verticalAlignment="middle" /><Label
          col="1"
          text="↗"
          fontSize="24"
          color="#2C3C29"
          verticalAlignment="middle" /></GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*,*"
        ><Button
          col="0"
          text="Overlap"
          @tap="replay('overlap')"
          class="ex-primary" /><Button
          col="1"
          text="In order"
          @tap="replay('sequential')" /><Button
          col="2"
          text="Fixed times"
          @tap="replay('fixed')" /></GridLayout
      ><GridLayout columns="*"
        ><Button col="0" text="Stop" @tap="freeze" /></GridLayout></StackLayout
    ><Label :text="status" class="ex-note" textWrap="true" />
  </StackLayout>
  <template v-else>
    <StackLayout class="section" @unloaded="freeze">
      <Label class="heading" text="Overlapping timelines" />
      <Label
        class="muted"
        text="The same entrance, with three different rhythms."
        textWrap="true"
      />
      <StackLayout class="stage" padding="20" height="260">
        <Label
          ref="badge"
          text="J"
          width="52"
          height="52"
          borderRadius="16"
          backgroundColor="#dcf71d"
          color="#17230d"
          fontSize="28"
          fontWeight="bold"
          textAlignment="center"
          horizontalAlignment="center"
        />
        <Label
          ref="title"
          text="A little choreography"
          fontSize="22"
          fontWeight="bold"
          textAlignment="center"
          marginTop="16"
        />
        <Label
          ref="caption"
          text="Let the next idea arrive a little sooner."
          class="muted"
          textAlignment="center"
          textWrap="true"
          marginTop="8"
        />
        <GridLayout ref="actions" columns="*, *" marginTop="20">
          <Label
            text="Continue"
            textAlignment="center"
            backgroundColor="#18181b"
            color="#ffffff"
            borderRadius="12"
            padding="10"
            marginRight="4"
          />
          <Label
            col="1"
            text="Save for later"
            textAlignment="center"
            backgroundColor="#ffffff"
            borderRadius="12"
            padding="10"
            marginLeft="4"
          />
        </GridLayout>
      </StackLayout>
      <GridLayout columns="*, *, *">
        <Button class="button" text="Overlap" @tap="replay('overlap')" />
        <Button col="1" class="button" text="In order" @tap="replay('sequential')" />
        <Button col="2" class="button" text="Fixed times" @tap="replay('fixed')" />
      </GridLayout>
      <Button class="button" text="Stop" @tap="freeze" />
      <Label class="muted" :text="status" textWrap="true" />
    </StackLayout>
  </template>
</template>
