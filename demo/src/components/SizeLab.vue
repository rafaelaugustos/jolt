<script setup lang="ts">
import {
  Color,
  GridLayout,
  StackLayout,
  Label,
  Button,
  type EventData,
  type View,
} from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import {
  animateSize,
  configure,
  motionScope,
  type SizeAnimation,
  type SizeDimensions,
} from '@rafaelaugusto/jolt'
import { runSizeChecks } from '../../../benchmarks/size-checks'

defineEmits<{ back: [] }>()
const scope = motionScope()
const status = ref('StackLayout · actual layout dimensions')
const grid = ref(false)
const slow = ref(false)
const reduced = ref(false)
const paused = ref(false)
const checking = ref(false)
let host: StackLayout | GridLayout
let card: StackLayout
let body: Label
let animation: SizeAnimation | undefined
let long = false
let narrow = false
let taps = 0
const copy =
  'A real layout change. These letters keep their shape as the card gets narrower. The next row follows the changing bounds, and stays tappable.'

function mount(event: EventData) {
  host = event.object as StackLayout | GridLayout
  host.removeChildren()
  card = new StackLayout()
  card.id = 'size-card'
  card.automationText = 'Size card'
  card.backgroundColor = new Color('#E4EEFF')
  card.borderRadius = 22
  card.padding = 20
  card.marginBottom = 12
  card.height = 86
  card.horizontalAlignment = 'left'
  card.verticalAlignment = 'top'
  card.clipToBounds = true
  const title = new Label()
  title.text = 'Made to fit.'
  title.fontSize = 27
  title.fontWeight = 'bold'
  title.color = new Color('#153561')
  card.addChild(title)
  body = new Label()
  body.text = copy
  body.fontSize = 17
  body.textWrap = true
  body.marginTop = 18
  body.color = new Color('#315277')
  card.addChild(body)
  const icon = new Label()
  icon.text = '●  Natural size, every frame'
  icon.fontSize = 15
  icon.marginTop = 18
  icon.color = new Color('#1764DA')
  card.addChild(icon)
  const neighbour = new Button()
  neighbour.text = 'Tap the following row'
  neighbour.automationText = 'Following row'
  neighbour.height = 50
  neighbour.borderRadius = 16
  neighbour.backgroundColor = new Color('#1764DA')
  neighbour.color = new Color('white')
  neighbour.on('tap', () => {
    status.value = `Following row tapped ${++taps}`
  })
  GridLayout.setRow(neighbour, 1)
  host.addChild(card)
  host.addChild(neighbour)
  long = false
  narrow = false
}
function run(dimensions: SizeDimensions, change?: () => void) {
  try {
    paused.value = false
    animation = change
      ? scope.animateSize(card, dimensions, change, {
          duration: 1100,
          ease: 'cubicInOut',
        })
      : scope.animateSize(card, dimensions, { duration: 1100, ease: 'cubicInOut' })
    status.value = 'Resizing actual bounds'
    const active = animation
    void active.finished.then(
      (done) => {
        if (animation === active)
          status.value = done
            ? `Settled · ${String(card.width)} × ${String(card.height)}`
            : 'Stopped'
      },
      (error) => {
        status.value = String(error)
      },
    )
  } catch (error) {
    status.value = String(error)
  }
}
function content() {
  long = !long
  run({ height: 'auto' }, () => {
    body.text = long
      ? `${copy}\n\nContent can arrive while the animation is running. Jolt measures the new destination and continues from the current size.`
      : copy
  })
}
function width() {
  narrow = !narrow
  run({ width: narrow ? 235 : 'auto', height: 'auto' })
}
function pause() {
  paused.value = !paused.value
  if (paused.value) animation?.pause()
  else animation?.play()
  status.value = paused.value ? 'Paused at real bounds' : 'Resumed'
}
function speed() {
  slow.value = !slow.value
  configure({ timeScale: slow.value ? 0.25 : 1 })
}
function motion() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
}
async function checks() {
  if (checking.value) return
  checking.value = true
  scope.reset()
  try {
    await runSizeChecks(host, (message) => {
      status.value = message
    })
  } finally {
    checking.value = false
    mount({ object: host, eventName: 'loaded' })
  }
}
onUnmounted(() => {
  scope.dispose()
  configure({ timeScale: 1, reducedMotion: 'user' })
})
</script>
<template>
  <GridLayout rows="auto,auto,*,auto" backgroundColor="#F6F8FC" padding="16 20">
    <StackLayout>
      <Label text="REAL DIMENSIONS" fontSize="11" letterSpacing="0.2" color="#1764DA" />
      <Label
        text="Space that moves."
        fontSize="30"
        fontWeight="bold"
        color="#152C48"
        marginTop="8"
      />
      <Label
        text="Width, height &amp; auto. No stretched content."
        fontSize="14"
        color="#60738D"
        marginTop="8"
        textWrap="true"
      />
    </StackLayout>
    <StackLayout row="1" marginTop="16" marginBottom="12">
      <GridLayout columns="*,*,*">
        <Button text="Expand" @tap="run({ height: 'auto' })" />
        <Button col="1" text="Collapse" @tap="run({ height: 86 })" />
        <Button col="2" text="Width" @tap="width" />
      </GridLayout>
      <GridLayout columns="*,*,*">
        <Button text="Content" @tap="content" />
        <Button col="1" :text="paused ? 'Resume' : 'Pause'" @tap="pause" />
        <Button col="2" text="Stop" @tap="animation?.stop()" />
      </GridLayout>
      <GridLayout columns="*,*,*">
        <Button :text="grid ? 'Grid' : 'Stack'" @tap="grid = !grid" />
        <Button col="1" :text="slow ? 'Speed 0.25x' : 'Speed 1x'" @tap="speed" />
        <Button col="2" :text="reduced ? 'Reduced' : 'System'" @tap="motion" />
      </GridLayout>
    </StackLayout>
    <ScrollView row="2">
      <GridLayout v-if="grid" rows="auto,auto" verticalAlignment="top" @loaded="mount" />
      <StackLayout v-else verticalAlignment="top" @loaded="mount" />
    </ScrollView>
    <StackLayout row="3" marginTop="8">
      <Label
        :text="status"
        automationText="Size status"
        fontSize="12"
        color="#60738D"
        textWrap="true"
      />
      <GridLayout columns="*,*">
        <Button text="Back" @tap="$emit('back')" />
        <Button
          col="1"
          :text="checking ? 'Checking…' : 'Run size checks'"
          @tap="checks"
        />
      </GridLayout>
    </StackLayout>
  </GridLayout>
</template>
