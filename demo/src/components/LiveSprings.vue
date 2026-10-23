<script setup lang="ts">
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
  const colors = ['#252B35', '#2464D9', '#C85475', '#D58523']
  for (let index = 0; index < 4; index++) {
    const lane = new GridLayout()
    lane.height = 60
    lane.marginBottom = 12
    lane.backgroundColor = new Color('#EAE9E4')
    lane.borderRadius = 20
    GridLayout.setRow(lane, index)
    const dot = new Label()
    dot.text = index === 0 ? '◎' : String(index)
    dot.fontSize = 20
    dot.fontWeight = 'bold'
    dot.color = new Color('white')
    dot.backgroundColor = new Color(colors[index]!)
    dot.width = 44
    dot.height = 44
    dot.borderRadius = 22
    dot.textAlignment = 'center'
    dot.verticalAlignment = 'middle'
    dot.horizontalAlignment = 'left'
    dot.marginLeft = 16
    dot.automationText = index === 0 ? 'Spring target' : `Follower ${index}`
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
  <GridLayout rows="auto,auto,auto,auto,auto,*" padding="24" backgroundColor="#F8F7F2">
    <GridLayout columns="*,auto" marginBottom="28">
      <Label
        text="JOLT / LIVE SPRINGS"
        fontSize="12"
        fontWeight="bold"
        color="#667078"
        verticalAlignment="middle"
      />
      <Button col="1" text="Back" @tap="$emit('back')" />
    </GridLayout>
    <StackLayout row="1" marginBottom="24">
      <Label text="Follow the lead." fontSize="34" fontWeight="bold" color="#252B35" />
      <Label
        text="Change direction. Keep the momentum."
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
      <Button text="Left" automationText="Target left" @tap="move(0)" />
      <Button col="1" text="Right" automationText="Target right" @tap="move(range())" />
      <Button col="2" text="Shake" automationText="Shake follower" @tap="shake" />
    </GridLayout>
    <StackLayout row="4" marginTop="12">
      <Button
        :text="reduced ? 'Reduced motion: on' : 'Reduced motion: off'"
        automationText="Toggle reduced motion"
        @tap="toggleReduced"
      />
      <Label
        :text="status"
        fontSize="14"
        color="#667078"
        textWrap="true"
        marginTop="16"
      />
    </StackLayout>
  </GridLayout>
</template>
