<script setup lang="ts">
import { usePreviewI18n } from '../showcase/i18n'
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
const { t } = usePreviewI18n()

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
  card.accessibilityLabel = t('Size card')
  card.backgroundColor = new Color(props.embedded ? '#344D37' : '#E4EEFF')
  card.borderRadius = 22
  card.padding = 20
  card.marginBottom = 12
  card.height = props.embedded ? 220 : 86
  card.horizontalAlignment = 'left'
  card.verticalAlignment = 'top'
  card.clipToBounds = true
  const title = new Label()
  title.text = t('Made to fit.')
  title.fontSize = 27
  title.fontWeight = 'bold'
  title.color = new Color(props.embedded ? '#EDF2DE' : '#153561')
  card.addChild(title)
  body = new Label()
  body.text = t(copy)
  body.fontSize = 17
  body.textWrap = true
  body.marginTop = 18
  body.color = new Color(props.embedded ? '#BCCCAE' : '#315277')
  card.addChild(body)
  const icon = new Label()
  icon.text = t('●  Natural size, every frame')
  icon.fontSize = 15
  icon.marginTop = 18
  icon.color = new Color(props.embedded ? '#E3FC62' : '#1764DA')
  card.addChild(icon)
  const neighbour = new Button()
  neighbour.text = t(
    props.embedded ? 'Room for something else.  ↗' : 'Tap the following row',
  )
  neighbour.automationText = 'Following row'
  neighbour.accessibilityLabel = t('Following row')
  neighbour.height = 50
  neighbour.borderRadius = 16
  neighbour.backgroundColor = new Color(props.embedded ? '#C8D9AD' : '#1764DA')
  neighbour.color = new Color(props.embedded ? '#3F5535' : 'white')
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
    body.text = t(
      long
        ? `${copy}\n\nContent can arrive while the animation is running. Jolt measures the new destination and continues from the current size.`
        : copy,
    )
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
const props = defineProps<{ embedded?: boolean }>()
</script>
<template>
  <GridLayout v-if="embedded" class="exhibit" rows="*,auto,auto">
    <GridLayout rows="auto,*" borderRadius="28" backgroundColor="#E4E8DA" padding="20"
      ><GridLayout columns="*,auto" marginBottom="24"
        ><Label
          :text="t('MAKE A LITTLE ROOM')"
          fontSize="9"
          color="#798568"
          letterSpacing=".1" /><Label
          col="1"
          text="↔"
          color="#596D41"
          fontSize="23" /></GridLayout
      ><ScrollView row="1"
        ><GridLayout
          v-if="grid"
          rows="auto,auto"
          verticalAlignment="top"
          @loaded="mount" /><StackLayout
          v-else
          verticalAlignment="top"
          @loaded="mount" /></ScrollView></GridLayout
    ><StackLayout row="1" class="ex-controls" marginTop="16"
      ><GridLayout columns="*,*,*"
        ><Button
          :text="t('Expand')"
          @tap="run({ height: 'auto' })"
          class="ex-primary" /><Button
          col="1"
          :text="t('Collapse')"
          @tap="run({ height: 86 })" /><Button
          col="2"
          :text="t('Width')"
          @tap="width" /></GridLayout
      ><GridLayout columns="*,*,*"
        ><Button :text="t('Content')" @tap="content" /><Button
          col="1"
          :text="t(paused ? 'Resume' : 'Pause')"
          @tap="pause" /><Button
          col="2"
          :text="t('Stop')"
          @tap="animation?.stop()" /></GridLayout></StackLayout
    ><Label
      row="2"
      :text="t(status)"
      automationText="Size status"
      class="ex-note"
      textWrap="true"
    />
  </GridLayout>
  <template v-else>
    <GridLayout rows="auto,auto,*,auto" backgroundColor="#F6F8FC" padding="16 20">
      <StackLayout v-if="!props.embedded">
        <Label
          :text="t('REAL DIMENSIONS')"
          fontSize="11"
          letterSpacing="0.2"
          color="#1764DA"
        />
        <Label
          :text="t('Space that moves.')"
          fontSize="30"
          fontWeight="bold"
          color="#152C48"
          marginTop="8"
        />
        <Label
          :text="t('Width, height &amp; auto. No stretched content.')"
          fontSize="14"
          color="#60738D"
          marginTop="8"
          textWrap="true"
        />
      </StackLayout>
      <StackLayout row="1" marginTop="16" marginBottom="12">
        <GridLayout columns="*,*,*">
          <Button :text="t('Expand')" @tap="run({ height: 'auto' })" />
          <Button col="1" :text="t('Collapse')" @tap="run({ height: 86 })" />
          <Button col="2" :text="t('Width')" @tap="width" />
        </GridLayout>
        <GridLayout columns="*,*,*">
          <Button :text="t('Content')" @tap="content" />
          <Button col="1" :text="t(paused ? 'Resume' : 'Pause')" @tap="pause" />
          <Button col="2" :text="t('Stop')" @tap="animation?.stop()" />
        </GridLayout>
        <GridLayout columns="*,*,*">
          <Button :text="t(grid ? 'Grid' : 'Stack')" @tap="grid = !grid" />
          <Button col="1" :text="t(slow ? 'Speed 0.25x' : 'Speed 1x')" @tap="speed" />
          <Button col="2" :text="t(reduced ? 'Reduced' : 'System')" @tap="motion" />
        </GridLayout>
      </StackLayout>
      <ScrollView row="2">
        <GridLayout
          v-if="grid"
          rows="auto,auto"
          verticalAlignment="top"
          @loaded="mount"
        />
        <StackLayout v-else verticalAlignment="top" @loaded="mount" />
      </ScrollView>
      <StackLayout row="3" marginTop="8">
        <Label
          :text="t(status)"
          automationText="Size status"
          fontSize="12"
          color="#60738D"
          textWrap="true"
        />
        <GridLayout :columns="props.embedded ? '*' : '*,*'">
          <Button v-if="!props.embedded" :text="t('Back')" @tap="$emit('back')" />
          <Button
            :col="props.embedded ? 0 : 1"
            :text="t(checking ? 'Checking…' : 'Run size checks')"
            @tap="checks"
          />
        </GridLayout>
      </StackLayout>
    </GridLayout>
  </template>
</template>
