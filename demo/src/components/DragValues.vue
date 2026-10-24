<script setup lang="ts">
import { onMounted, ref } from 'nativescript-vue'
import { animate, bind } from '@rafaelaugusto/jolt'
import { useBinding, useMotionScope, useMotionValue } from '@rafaelaugusto/jolt/vue'
defineEmits<{ back: [] }>()

const closed = 380
const stops: Record<number, string> = {
  0: 'Open',
  [closed / 2]: 'Half way',
  [closed]: 'Closed',
}
const y = useMotionValue(closed)
const progress = y.to([closed, 0], [0, 1])
const page = useBinding({
  scale: progress.to([0, 1], [1, 0.9]),
  y: progress.to([0, 1], [0, -14]),
})
const backdrop = useBinding({ opacity: progress.to([0, 1], [0, 0.5]) })
const hint = useBinding({ opacity: y.to([closed, closed / 2], [1, 0]) })
const scope = useMotionScope()
const sheet = ref()
const status = ref('Closed')

onMounted(() => {
  scope.use(() => bind(sheet.value, { y }))
  scope.drag(sheet.value, {
    axis: 'y',
    value: y,
    bounds: { top: 0, bottom: closed },
    snap: [0, closed / 2, closed],
    rubberband: true,
    onStart: () => (status.value = 'Dragging'),
    onRelease: ({ target }) => (status.value = stops[target.y]!),
  })
})

function toggle() {
  const to = y.get() > closed / 2 ? 0 : closed
  status.value = stops[to]!
  animate(y, to, 'snappy')
}
const props = defineProps<{ embedded?: boolean }>()
</script>

<template>
  <GridLayout v-if="embedded" class="exhibit" rows="*,auto">
    <GridLayout clipToBounds="true" borderRadius="28" backgroundColor="#1F2D27"
      ><GridLayout :ref="page" backgroundColor="#DDE5CF" borderRadius="28" padding="26"
        ><StackLayout verticalAlignment="top"
          ><Label
            text="THE JOLT SESSIONS"
            color="#7B896C"
            fontSize="9"
            letterSpacing=".1" /><Label
            text="Your daily&#10;rotation."
            fontSize="34"
            fontWeight="bold"
            color="#34472E"
            marginTop="24"
            textWrap="true" /><GridLayout
            height="150"
            backgroundColor="#BDD199"
            borderRadius="24"
            marginTop="24"
            ><Label
              text="✦"
              fontSize="102"
              color="#566E41"
              textAlignment="center"
              verticalAlignment="middle" /></GridLayout></StackLayout></GridLayout
      ><GridLayout :ref="backdrop" backgroundColor="#132018" opacity="0" /><GridLayout
        ref="sheet"
        height="520"
        verticalAlignment="bottom"
        borderRadius="28"
        backgroundColor="#263D30"
        accessibilityLabel="Drag sheet"
        padding="22"
        ><StackLayout verticalAlignment="top"
          ><Label
            width="38"
            height="4"
            borderRadius="2"
            backgroundColor="#72886B" /><Label
            :ref="hint"
            text="PULL UP TO GET INTO IT"
            color="#94AC7D"
            fontSize="9"
            textAlignment="center"
            letterSpacing=".1"
            marginTop="16" /><Label
            text="Slow mornings."
            fontSize="28"
            fontWeight="bold"
            color="#ECF2DD"
            marginTop="20" /><Label
            text="JOLT SESSIONS / SIDE A"
            fontSize="9"
            color="#8CA078"
            marginTop="8" /><GridLayout
            width="200"
            height="200"
            borderRadius="100"
            backgroundColor="#192B21"
            marginTop="28"
            ><GridLayout
              width="150"
              height="150"
              borderRadius="75"
              borderWidth="1"
              borderColor="#4D6644" /><GridLayout
              width="94"
              height="94"
              borderRadius="47"
              backgroundColor="#C5D69E"
              ><Label
                text="✦"
                fontSize="54"
                color="#456138"
                textAlignment="center"
                verticalAlignment="middle" /></GridLayout></GridLayout
          ><Label
            text="Ⅰ◀           Ⅱ           ▶Ⅰ"
            fontSize="25"
            color="#E3FC62"
            textAlignment="center"
            marginTop="28" /></StackLayout></GridLayout></GridLayout
    ><GridLayout row="1" columns="*,auto" class="ex-controls" marginTop="14"
      ><Label
        :text="status"
        color="#7B8672"
        fontSize="12"
        verticalAlignment="middle" /><Button
        col="1"
        text="Toggle sheet"
        @tap="toggle"
        class="ex-primary"
    /></GridLayout>
  </GridLayout>
  <template v-else>
    <GridLayout rows="auto,*,auto" padding="12 20" backgroundColor="white">
      <GridLayout v-if="!props.embedded" columns="auto,*">
        <Button text="Back" @tap="$emit('back')" />
        <Label col="1" text="Drag values" class="heading" verticalAlignment="middle" />
      </GridLayout>

      <GridLayout row="1" class="stage values-stage" marginTop="8">
        <StackLayout :ref="page" class="values-page drag-values-page">
          <Label class="drag-values-title" text="Library" />
          <Label v-for="row in 5" :key="row" class="drag-values-row" />
        </StackLayout>
        <GridLayout :ref="backdrop" class="values-backdrop" opacity="0" />
        <GridLayout
          ref="sheet"
          class="values-sheet"
          height="520"
          verticalAlignment="bottom"
          accessibilityLabel="Drag sheet"
        >
          <StackLayout verticalAlignment="top">
            <Label class="values-handle" />
            <Label :ref="hint" class="drag-values-hint" text="Pull the sheet up" />
            <Label class="values-title drag-values-sheet-title" text="Now playing" />
            <Label v-for="row in 3" :key="row" class="drag-values-track" />
          </StackLayout>
        </GridLayout>
      </GridLayout>

      <GridLayout row="2" columns="*,auto" marginTop="8">
        <Label :text="status" class="muted" verticalAlignment="middle" />
        <Button
          col="1"
          class="button"
          padding="10 18"
          text="Toggle sheet"
          @tap="toggle"
        />
      </GridLayout>
    </GridLayout>
  </template>
</template>
