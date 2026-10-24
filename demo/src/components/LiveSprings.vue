<script setup lang="ts">
import { usePreviewI18n } from '../showcase/i18n'
const props = defineProps<{ embedded?: boolean }>()
import {
  Color,
  GridLayout,
  Label,
  type EventData,
  type TouchGestureEventData,
  type View,
} from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import {
  bind,
  configure,
  motionScope,
  motionValue,
  set,
  springValue,
  type DerivedValue,
} from '@rafaelaugusto/jolt'
const { t } = usePreviewI18n()

defineEmits<{ back: [] }>()
const scope = motionScope()
const pointer = motionValue(0)
const reduced = ref(false)
const status = ref('Drag across the lanes. Each dot follows the one above.')
let stage: GridLayout | undefined
let last: View | undefined
const range = () => Math.max(0, (stage?.getActualSize().width ?? 300) - 76)

function mount(event: EventData) {
  scope.reset()
  stage = event.object as GridLayout
  stage.removeChildren()
  const values: DerivedValue[] = [pointer]
  let source: DerivedValue = pointer
  for (let index = 0; index < 3; index++) {
    const next = scope.add(springValue(source, { stiffness: 260, damping: 24 }))
    values.push(next)
    source = next
  }
  const colors = props.embedded
    ? ['#E3FC62', '#BCD4A5', '#C0AFE7', '#E7AD91']
    : ['#252B35', '#2464D9', '#C85475', '#D58523']
  for (let index = 0; index < 4; index++) {
    const lane = new GridLayout()
    lane.height = 60
    lane.marginBottom = 12
    lane.backgroundColor = new Color(props.embedded ? '#304337' : '#EAE9E4')
    lane.borderRadius = 20
    GridLayout.setRow(lane, index)
    const dot = new Label()
    dot.text = t(
      index === 0 ? '◎' : props.embedded ? ['', '↗', '✦', '◉'][index]! : String(index),
    )
    dot.fontSize = 20
    dot.fontWeight = 'bold'
    dot.color = new Color(props.embedded ? '#34472F' : 'white')
    dot.backgroundColor = new Color(colors[index]!)
    dot.width = 44
    dot.height = 44
    dot.borderRadius = 22
    dot.textAlignment = 'center'
    dot.verticalAlignment = 'middle'
    dot.horizontalAlignment = 'left'
    dot.marginLeft = 16
    dot.automationText = index === 0 ? 'Spring target' : `Follower ${index}`
    dot.accessibilityLabel = t(dot.automationText)
    lane.addChild(dot)
    stage.addChild(lane)
    scope.use(() => bind(dot, { x: values[index]! }))
    last = dot
  }
}
function move(value: number) {
  set(pointer, Math.max(0, Math.min(range(), value)))
  status.value = reduced.value
    ? 'Reduced motion · followers move straight to the target.'
    : 'One target, three retained native springs.'
}
function touch(event: TouchGestureEventData) {
  if (event.action === 'down' || event.action === 'move') move(event.getX() - 38)
}
function shake() {
  if (last)
    scope.animate(last, { x: [0, -12, 12, -8, 0] }, { duration: 600, layer: 'feedback' })
  status.value = 'The shake adds to the third follower’s own movement.'
}
function toggleReduced() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'never' })
  move(pointer.get())
}
onUnmounted(() => {
  scope.dispose()
  configure({ reducedMotion: 'user' })
})
</script>

<template>
  <GridLayout v-if="embedded" class="exhibit" rows="*,auto,auto">
    <GridLayout
      row="0"
      rows="auto,*"
      backgroundColor="#202C28"
      borderRadius="28"
      padding="18"
      ><GridLayout columns="*,auto" margin="4 4 22"
        ><Label :text="t('FOLLOW THE FEELING')" class="ex-kicker" /><Label
          col="1"
          text="↔"
          color="#E3FC62"
          fontSize="24" /></GridLayout
      ><GridLayout
        row="1"
        id="spring-stage"
        automationText="Spring lanes"
        rows="72,72,72,72"
        height="288"
        verticalAlignment="middle"
        @loaded="mount"
        @touch="touch" /></GridLayout
    ><StackLayout row="1" class="ex-controls" marginTop="16"
      ><GridLayout columns="*,*,*"
        ><Button :text="t('Left')" automationText="Target left" @tap="move(0)" /><Button
          col="1"
          :text="t('Right')"
          class="ex-primary"
          automationText="Target right"
          @tap="move(range())" /><Button
          col="2"
          :text="t('Shake')"
          automationText="Shake follower"
          @tap="shake" /></GridLayout
      ><Button
        :text="t(reduced ? 'Reduced motion: on' : 'Reduced motion: off')"
        automationText="Toggle reduced motion"
        @tap="toggleReduced" /></StackLayout
    ><Label row="2" :text="t(status)" class="ex-note" textWrap="true" />
  </GridLayout>
  <template v-else>
    <GridLayout rows="auto,auto,auto,auto,auto,*" padding="24" backgroundColor="#F8F7F2">
      <GridLayout v-if="!props.embedded" columns="*,auto" marginBottom="28">
        <Label
          :text="t('JOLT / LIVE SPRINGS')"
          fontSize="12"
          fontWeight="bold"
          color="#667078"
          verticalAlignment="middle"
        />
        <Button col="1" :text="t('Back')" @tap="$emit('back')" />
      </GridLayout>
      <StackLayout v-if="!props.embedded" row="1" marginBottom="24">
        <Label
          :text="t('Follow the lead.')"
          fontSize="34"
          fontWeight="bold"
          color="#252B35"
        />
        <Label
          :text="t('Change direction. Keep the momentum.')"
          fontSize="16"
          marginTop="8"
          color="#667078"
          textWrap="true"
        />
      </StackLayout>
      <GridLayout
        row="2"
        id="spring-stage"
        automationText="Spring lanes"
        rows="72,72,72,72"
        height="288"
        @loaded="mount"
        @touch="touch"
      />
      <GridLayout row="3" columns="*,*,*" marginTop="12">
        <Button :text="t('Left')" automationText="Target left" @tap="move(0)" />
        <Button
          col="1"
          :text="t('Right')"
          automationText="Target right"
          @tap="move(range())"
        />
        <Button col="2" :text="t('Shake')" automationText="Shake follower" @tap="shake" />
      </GridLayout>
      <StackLayout row="4" marginTop="12">
        <Button
          :text="t(reduced ? 'Reduced motion: on' : 'Reduced motion: off')"
          automationText="Toggle reduced motion"
          @tap="toggleReduced"
        />
        <Label
          :text="t(status)"
          fontSize="14"
          color="#667078"
          textWrap="true"
          marginTop="16"
        />
      </StackLayout>
    </GridLayout>
  </template>
</template>
