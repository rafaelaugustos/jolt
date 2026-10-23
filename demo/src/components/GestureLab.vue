<script setup lang="ts">
import {
  Color,
  File,
  GridLayout,
  Label,
  ScrollView,
  StackLayout,
  isIOS,
  knownFolders,
  type EventData,
} from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { bind, motionScope } from '@rafaelaugusto/jolt'
import {
  GestureSurface,
  gestures,
  type GestureEvent,
  type Gestures,
} from '@rafaelaugusto/jolt/gestures'
import { launchArgument } from '../launch'

const emit = defineEmits<{ back: [] }>()
const navigationCheck = launchArgument('gesture-navigation-check') !== undefined
const nodeCount = () =>
  isIOS ? JoltLiveSpring.nodeCount() : org.rafaelaugusto.jolt.LiveSpring.nodeCount()
const baselineNodes = navigationCheck ? nodeCount() : 0
let navigationActive = false,
  cancellations = 0,
  endings = 0
const scope = motionScope()
const status = ref('Pan, pinch and rotate the card together.')
const selected = ref('Photo')
const coreTaps = ref(0)
let host: GridLayout | undefined
let control: Gestures | undefined
let taps = 0,
  doubles = 0
function label(text: string, size = 17) {
  const view = new Label()
  view.text = text
  view.fontSize = size
  view.color = new Color('#263345')
  view.textWrap = true
  return view
}
function end(event: GestureEvent) {
  endings++
  status.value = `x ${Math.round(event.x)} · y ${Math.round(event.y)} · scale ${event.scale.toFixed(2)} · rotate ${Math.round(event.rotate)}°`
  console.log('JOLT_GESTURE', selected.value, JSON.stringify(event))
}
function select(name: string) {
  selected.value = name
  if (!host) return
  scope.reset()
  host.removeChildren()
  control = undefined
  if (name === 'Photo') {
    const surface = new GestureSurface()
    surface.automationText = 'Photo gesture surface'
    surface.backgroundColor = new Color('#E8EDF6')
    const card = new GridLayout()
    card.width = 170
    card.height = 200
    card.borderRadius = 24
    card.backgroundColor = new Color('#4168B5')
    const title = label('NORTH\n↗\nSTUDIO', 26)
    title.color = new Color('white')
    title.fontWeight = 'bold'
    title.textAlignment = 'center'
    title.verticalAlignment = 'middle'
    card.addChild(title)
    surface.addChild(card)
    host.addChild(surface)
    control = scope.add(
      gestures(surface, {
        pan: { bounds: { left: -110, right: 110, top: -140, bottom: 140 } },
        pinch: { min: 0.5, max: 2 },
        rotate: true,
        onStart: () => {
          if (navigationCheck)
            setTimeout(() => {
              navigationActive = control?.active === true
              emit('back')
            }, 60)
        },
        onEnd: end,
        onTap: () => {
          status.value = `Single tap ${++taps} · double taps ${doubles}`
        },
        onDoubleTap: () => {
          status.value = `Double tap ${++doubles} · single taps ${taps}`
        },
        onCancel: () => {
          cancellations++
          status.value = 'Gesture cancelled once.'
        },
      }),
    )
    scope.use(() =>
      bind(card, {
        x: control!.x,
        y: control!.y,
        scale: control!.scale,
        rotate: control!.rotate,
      }),
    )
    const existingTap = () => {
      coreTaps.value++
    }
    surface.on('tap', existingTap)
    scope.add(() => surface.off('tap', existingTap))
    status.value = 'Pan, pinch and rotate together. Single tap waits for double tap.'
  } else if (name === 'Carousel') {
    const scroll = new ScrollView()
    scroll.automationText = 'Outer list'
    const content = new StackLayout()
    content.addChild(label('Vertical list · swipe up to scroll', 20))
    const surface = new GestureSurface()
    surface.height = 180
    surface.marginTop = 24
    surface.backgroundColor = new Color('#E6EDE7')
    surface.automationText = 'Horizontal carousel'
    const card = label('←  SLIDE SIDEWAYS  →', 20)
    card.width = 260
    card.height = 120
    card.backgroundColor = new Color('#8BB89B')
    card.borderRadius = 20
    card.textAlignment = 'center'
    card.verticalAlignment = 'middle'
    surface.addChild(card)
    content.addChild(surface)
    for (let i = 1; i <= 12; i++) {
      const row = label(`List item ${i} · native scroll`)
      row.height = 70
      row.padding = 20
      content.addChild(row)
    }
    scroll.content = content
    host.addChild(scroll)
    control = scope.add(
      gestures(surface, {
        pan: { axis: 'x', bounds: { left: -90, right: 90 } },
        onEnd: end,
      }),
    )
    scope.use(() => bind(card, { x: control!.x }))
    status.value = 'Drag sideways on the card, then vertically on the same card.'
  } else {
    const surface = new GestureSurface()
    surface.rows = '60,*'
    surface.backgroundColor = new Color('#E8E5F0')
    surface.borderRadius = 24
    surface.automationText = 'Handoff panel'
    const header = label('↕  PANEL · DRAG OR SCROLL', 18)
    header.textAlignment = 'center'
    header.verticalAlignment = 'middle'
    surface.addChild(header)
    const scroll = new ScrollView()
    scroll.automationText = 'Inner list'
    GridLayout.setRow(scroll, 1)
    const content = new StackLayout()
    for (let i = 1; i <= 18; i++) {
      const row = label(`Result ${i} · keep your finger down`)
      row.height = 64
      row.padding = 18
      row.backgroundColor = new Color(i % 2 ? '#F7F4FB' : '#EEEBF4')
      content.addChild(row)
    }
    scroll.content = content
    surface.addChild(scroll)
    host.addChild(surface)
    control = scope.add(
      gestures(surface, {
        pan: { axis: 'y', bounds: { top: 0, bottom: 220 } },
        initial: { y: 180 },
        scrollView: scroll,
        onEnd: end,
      }),
    )
    scope.use(() => bind(surface, { y: control!.y }))
    status.value =
      'Swipe up: expand, then scroll. Pull down: reach the top, then move the panel.'
  }
}
function mount(event: EventData) {
  host = event.object as GridLayout
  if (isIOS) (host.ios as UIView).clipsToBounds = true
  select(selected.value)
}
function reset() {
  control?.jumpTo({ x: 0, y: selected.value === 'Sheet' ? 180 : 0, scale: 1, rotate: 0 })
  status.value = 'Reset. Ready for another gesture.'
}
function pause() {
  if (control?.paused) control.play()
  else control?.pause()
  status.value = control?.paused
    ? 'Paused. Native input detached from recognition.'
    : 'Ready.'
}
onUnmounted(() => {
  scope.dispose()
  if (navigationCheck)
    File.fromPath(
      `${knownFolders.documents().path}/gesture-navigation.json`,
    ).writeTextSync(
      JSON.stringify({
        activeAtNavigation: navigationActive,
        cancellations,
        endings,
        disposed: control?.disposed,
        baselineNodes,
        remainingNodes: nodeCount(),
      }),
    )
})
</script>

<template>
  <GridLayout rows="auto,auto,auto,*,auto,auto" padding="24" backgroundColor="#F8F7F2">
    <GridLayout columns="*,auto" marginBottom="12">
      <Label
        text="JOLT / GESTURES"
        fontSize="12"
        fontWeight="bold"
        color="#657080"
        verticalAlignment="middle"
      />
      <Button col="1" text="Back" @tap="$emit('back')" />
    </GridLayout>
    <Label
      row="1"
      text="Move together."
      fontSize="32"
      fontWeight="bold"
      color="#263345"
      marginBottom="16"
    />
    <GridLayout row="2" columns="*,*,*" marginBottom="16">
      <Button text="Photo" @tap="select('Photo')" />
      <Button col="1" text="Carousel" @tap="select('Carousel')" />
      <Button col="2" text="Sheet" @tap="select('Sheet')" />
    </GridLayout>
    <GridLayout row="3" id="gesture-stage" @loaded="mount" />
    <GridLayout row="4" columns="*,*" marginTop="16">
      <Button text="Reset" @tap="reset" />
      <Button col="1" text="Pause / resume" @tap="pause" />
    </GridLayout>
    <StackLayout row="5" height="76" marginTop="12">
      <Label :text="status" textWrap="true" color="#657080" fontSize="14" />
      <Label
        :text="`Existing tap listener: ${coreTaps}`"
        color="#657080"
        fontSize="12"
        marginTop="8"
      />
    </StackLayout>
  </GridLayout>
</template>
