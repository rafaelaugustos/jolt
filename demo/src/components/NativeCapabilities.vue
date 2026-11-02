<script setup lang="ts">
import {
  Color,
  GridLayout,
  FlexboxLayout,
  StackLayout,
  Label,
  knownFolders,
  type EventData,
  type View,
} from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import {
  animateSize,
  bind,
  configure,
  motionValue,
  seekableTimeline,
  set,
  springValue,
  type PlaybackAnimation,
  type SizeAnimation,
  type SpringValue,
} from '@rafaelaugusto/jolt'
import { physicsWorld, type PhysicsWorld } from '@rafaelaugusto/jolt/physics'
import { runNativeCapabilitiesChecks } from '../../../benchmarks/native-capabilities-checks'
import { launchArgument } from '../launch'
import { usePreviewI18n } from '../showcase/i18n'
const { t } = usePreviewI18n()
defineProps<{ embedded?: boolean }>()
defineEmits<{ back: [] }>()
const mode = ref(0),
  paused = ref(false),
  status = ref('Change the target while the spring is moving.'),
  busy = ref(false)
const bodyReady = ref(false)
let pending: ReturnType<typeof setTimeout> | undefined
const bodyEvents: unknown[] = []
function saveBodies(name: string) {
  if (!world || launchArgument('native-capabilities') === undefined) return
  bodyEvents.push({ name, time: Date.now(), snapshot: world.snapshot() })
  knownFolders
    .documents()
    .getFile('jolt-body-spring-input.json')
    .writeTextSync(JSON.stringify(bodyEvents, null, 2))
}
const titles = [
  'Live color & corners',
  'Seekable scene',
  'Flexbox reflow',
  'Connected bodies',
]
let host: GridLayout | undefined,
  card: View | undefined,
  scene: PlaybackAnimation | undefined
let spring: SpringValue | undefined,
  world: PhysicsWorld | undefined,
  size: SizeAnimation | undefined
let input = motionValue(0),
  release: (() => void) | undefined,
  target = false
function clear() {
  if (pending !== undefined) clearTimeout(pending)
  pending = undefined
  bodyReady.value = false
  release?.()
  release = undefined
  spring?.dispose()
  spring = undefined
  scene?.stop()
  scene = undefined
  size?.stop()
  size = undefined
  world?.dispose()
  saveBodies('disposed')
  world = undefined
  host?.removeChildren()
  card = undefined
  paused.value = false
  target = false
}
function label(text: string, width: number, height: number, color: string) {
  const view = new Label()
  view.text = t(text)
  view.width = width
  view.height = height
  view.color = new Color('#17332B')
  view.backgroundColor = new Color(color)
  view.textAlignment = 'center'
  view.fontSize = 18
  view.borderRadius = 8
  view.horizontalAlignment = 'left'
  view.verticalAlignment = 'top'
  return view
}
function select(next: number) {
  if (!host || busy.value) return
  clear()
  mode.value = next
  input = motionValue(0)
  if (next === 0) {
    card = label('Retained spring', 170, 170, '#8CB5FF')
    card.marginTop = 40
    card.marginLeft = 60
    host.addChild(card)
    spring = springValue(input, { stiffness: 140, damping: 13 })
    release = bind(card, {
      backgroundColor: spring.to([0, 1], ['#8CB5FF', '#EFA26F']),
      borderRadius: spring.to([0, 1], [8, 76]),
      rotate: spring.to([0, 1], [0, 15]),
    })
    status.value = 'Change the target while the spring is moving.'
  } else if (next === 1) {
    card = label('Scrub me', 70, 70, '#A6C86B')
    card.marginTop = 35
    host.addChild(card)
    const bar = label('', 240, 12, '#467B66')
    bar.marginTop = 180
    bar.originX = 0
    host.addChild(bar)
    release = bind(bar, { scaleX: input })
    // The host has just inserted the views; loaded is synchronous for this native tree.
    scene = seekableTimeline(
      [
        {
          target: card,
          keyframes: { x: [0, 210] },
          transition: { duration: 2400, ease: 'linear' },
        },
        {
          at: 500,
          target: card,
          keyframes: { scale: [1, 1.5, 1], opacity: [0.35, 1] },
          transition: { duration: 1600, ease: 'easeInOut' },
        },
        {
          value: input,
          keyframes: [0, 1],
          transition: { duration: 2400, ease: 'linear' },
        },
      ],
      { paused: true },
    )
    paused.value = true
    status.value = 'Drag the slider in both directions. Play continues from there.'
  } else if (next === 2) {
    const row = new FlexboxLayout()
    row.flexDirection = 'row'
    row.flexWrap = 'nowrap'
    row.alignItems = 'stretch'
    row.height = 230
    const box = new StackLayout()
    box.width = 120
    box.height = 220
    box.padding = 12
    box.backgroundColor = new Color('#D8E6C5')
    FlexboxLayout.setFlexGrow(box, 0)
    FlexboxLayout.setFlexShrink(box, 0)
    const text = new Label()
    text.text = t(
      'Real layout keeps this text sharp and wraps it as the card grows. The neighbor receives the remaining space.',
    )
    text.textWrap = true
    text.fontSize = 17
    box.addChild(text)
    const neighbor = label('Flexible neighbor', 60, 220, '#DBCFF2')
    neighbor.textWrap = true
    neighbor.padding = 10
    FlexboxLayout.setFlexGrow(neighbor, 1)
    FlexboxLayout.setFlexShrink(neighbor, 1)
    row.addChild(box)
    row.addChild(neighbor)
    host.addChild(row)
    card = box
    status.value = 'Watch the text reflow and the sibling resize. Tap again to reverse.'
  } else {
    const balls = [
      label('A', 44, 44, '#A6C86B'),
      label('B', 44, 44, '#8CB5FF'),
      label('C', 44, 44, '#EFA26F'),
    ]
    balls.forEach((ball, i) => {
      ball.borderRadius = 22
      ball.automationText = `linked-body-${i}`
      host!.addChild(ball)
    })
    status.value = 'Waiting for native layout.'
    pending = setTimeout(() => {
      pending = undefined
      if (!host || mode.value !== 3 || !host.isLoaded) return
      try {
        const width = host.getActualSize().width
        world = physicsWorld(
          host,
          balls.map((view, i) => ({
            id: String(i),
            view,
            radius: 22,
            x: width * 0.25 + i * 70,
            y: 120,
            mass: i + 1,
            drag: { type: 'spring', stiffness: 250, damping: 25 },
          })),
          {
            gravity: { x: 0, y: 0 },
            damping: 1.4,
            springs: [
              {
                id: 'ab',
                from: '0',
                to: '1',
                length: 70,
                stiffness: 150,
                damping: 20,
                line: { color: '#687C70', width: 2 },
              },
              {
                id: 'bc',
                from: '1',
                to: '2',
                length: 70,
                stiffness: 150,
                damping: 20,
                line: { color: '#687C70', width: 2 },
              },
            ],
          },
        )
        bodyReady.value = true
        status.value = 'Drag any body. The other masses follow through native springs.'
        saveBodies('ready')
      } catch (error) {
        status.value = `FAILED: ${String(error)}`
      }
    }, 120)
  }
}
function mount(event: EventData) {
  host = event.object as GridLayout
  setTimeout(() => {
    select(Number(launchArgument('native-capabilities') || 0) || 0)
    if (launchArgument('native-audit') !== undefined) void audit()
  }, 120)
}
function action() {
  target = !target
  if (mode.value === 0) set(input, target ? 1 : 0)
  else if (mode.value === 1) {
    select(1)
    scene?.play()
    paused.value = false
  } else if (mode.value === 2 && card)
    size = animateSize(card, { width: target ? 245 : 120 }, 'bouncy')
  else {
    world?.impulse('0', { x: target ? 350 : -350, y: -180 })
    saveBodies('nudge')
  }
}
function pause() {
  paused.value = !paused.value
  const handle =
    mode.value === 0 ? spring : mode.value === 1 ? scene : mode.value === 2 ? size : world
  if (paused.value) handle?.pause()
  else handle?.play()
  if (mode.value === 3) saveBodies(paused.value ? 'paused' : 'resumed')
}
function scrub(event: EventData) {
  if (mode.value === 1 && scene)
    scene.progress = Math.max(
      0,
      Math.min(1, Number((event.object as View & { value: number }).value) / 100),
    )
}
async function audit() {
  if (!host || busy.value) return
  clear()
  busy.value = true
  const report = await runNativeCapabilitiesChecks(
    host,
    (value) => (status.value = value),
  )
  busy.value = false
  status.value = report.failure
    ? `FAILED: ${report.failure}`
    : `PASS: ${report.passed.length} native checks`
}
onUnmounted(() => {
  clear()
  configure({ reducedMotion: 'user', timeScale: 1 })
})
</script>
<template>
  <StackLayout
    padding="18"
    backgroundColor="#F6F5F0"
    automationText="native-capabilities-lab"
  >
    <Label
      :text="t('Native motion lab')"
      fontSize="27"
      fontWeight="bold"
      marginBottom="8"
      color="#17332B"
    />
    <GridLayout columns="*,*,*,*" height="48" marginBottom="12">
      <Button
        v-for="(title, index) in ['Paint', 'Seek', 'Flex', 'Bodies']"
        :key="title"
        :col="index"
        :text="t(title)"
        :automationText="`native-tab-${index}`"
        @tap="select(index)"
      />
    </GridLayout>
    <Label
      :text="t(titles[mode]!)"
      fontSize="22"
      fontWeight="bold"
      color="#17332B"
      marginBottom="18"
    />
    <GridLayout height="280" @loaded="mount" automationText="native-capabilities-stage" />
    <Slider
      v-if="mode === 1"
      value="0"
      minValue="0"
      maxValue="100"
      automationText="native-scrub"
      @valueChange="scrub"
    />
    <GridLayout columns="*,*" height="48" marginTop="12">
      <Button
        col="0"
        :text="t(mode === 3 ? 'Nudge' : mode === 1 ? 'Replay' : 'Change target')"
        automationText="native-action"
        @tap="action"
      />
      <Button
        col="1"
        :text="t(paused ? 'Resume' : 'Pause')"
        automationText="native-pause"
        @tap="pause"
      />
    </GridLayout>
    <Label
      :text="t(status)"
      textWrap="true"
      fontSize="15"
      color="#466257"
      marginTop="15"
      :automationText="bodyReady ? 'native-body-ready' : 'native-status'"
    />
    <Button
      :text="t('Run native checks')"
      automationText="native-checks"
      @tap="audit"
      marginTop="12"
    />
  </StackLayout>
</template>
