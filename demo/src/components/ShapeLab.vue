<script setup lang="ts">
import { Application, File, isIOS, knownFolders, type View } from '@nativescript/core'
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { configure, motionScope, type PlaybackAnimation } from '@rafaelaugusto/jolt'
import { shape, type Shape } from '@rafaelaugusto/jolt/shapes'
import { launchArgument } from '../launch'
import { usePreviewI18n } from '../showcase/i18n'
const { t } = usePreviewI18n()
defineProps<{ embedded?: boolean }>()
const root = ref(),
  paused = ref(false),
  reduced = ref(false),
  switched = ref(false),
  compact = ref(false)
const owner = motionScope(),
  auditMode = launchArgument('shape-audit') !== undefined
const PLAY = 'M34 24L54 36L54 64L34 76Z M54 36L78 50L78 50L54 64Z'
const PAUSE = 'M34 26L46 26L46 74L34 74Z M60 26L72 26L72 74L60 74Z'
const CHECK = 'M22 51L43 71L79 28'
const RING = 'M50 13A37 37 0 1 1 50 87A37 37 0 1 1 50 13'
const LINE = 'M8 18C50 5 88 30 128 16S208 5 252 18'
const surfaces: { id: string; view: View; shape: Shape }[] = []
let handles: PlaybackAnimation[] = [],
  ended = false,
  attached = false
const events: object[] = []
function audit(name: string, error?: string) {
  if (!auditMode) return
  const layers = isIOS
    ? surfaces.reduce((sum, s) => {
        const children = s.view.nativeViewProtected?.layer?.sublayers
        let count = 0
        for (let i = 0; i < (children?.count ?? 0); i++)
          if (children.objectAtIndex(i).name === 'jolt:shape') count++
        return sum + count
      }, 0)
    : (global as any).org.rafaelaugusto.jolt.ShapeLayer.liveCount()
  events.push({
    name,
    error,
    time: Date.now(),
    reduced: reduced.value,
    paused: paused.value,
    compact: compact.value,
    resources: owner.size,
    layers,
    surfaces: surfaces.map((s) => ({
      id: s.id,
      size: s.view.getActualSize(),
      ...s.shape.snapshot(),
    })),
  })
  const folder = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null).getAbsolutePath()
  File.fromPath(folder + '/shape-audit.json').writeTextSync(
    JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }, null, 2),
  )
}
const definitions = [
  {
    id: 'symbol',
    d: PLAY,
    viewBox: [0, 0, 100, 100],
    fill: '#F4B992',
    stroke: '#00000000',
    strokeWidth: 0,
  },
  {
    id: 'check',
    d: CHECK,
    viewBox: [0, 0, 100, 100],
    stroke: '#C8E4CF',
    strokeWidth: 5,
    strokeEnd: 1,
  },
  {
    id: 'ring',
    d: RING,
    viewBox: [0, 0, 100, 100],
    stroke: '#D5C4F2',
    strokeWidth: 5,
    strokeEnd: 1,
  },
  {
    id: 'line',
    d: LINE,
    viewBox: [0, 0, 260, 36],
    stroke: '#F4B992',
    strokeWidth: 2.2,
    strokeEnd: 1,
  },
]
onMounted(() => {
  const host: View = root.value?.nativeView
  for (const definition of definitions) {
    const view = host.getViewById('shape-' + definition.id)
    const ink = shape(view, {
      ...definition,
      viewBox: definition.viewBox as [number, number, number, number],
    })
    owner.add(ink)
    surfaces.push({ id: definition.id, view, shape: ink })
  }
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  audit('created')
})
function layout() {
  if (ended || attached || surfaces.some((s) => !s.shape.snapshot().attached)) return
  attached = true
  audit('attached')
}
function ink(id: string) {
  return surfaces.find((s) => s.id === id)?.shape
}
function remember(handle: PlaybackAnimation | undefined) {
  if (handle) handles.push(handle)
}
function draw() {
  paused.value = false
  for (const id of ['check', 'ring', 'line']) {
    ink(id)?.set({ strokeStart: 0, strokeEnd: 0 })
    remember(
      ink(id)?.animate(
        { strokeEnd: 1 },
        { duration: auditMode ? 1800 : 1200, ease: auditMode ? 'linear' : 'easeInOut' },
      ),
    )
  }
  audit('draw')
}
function morph() {
  audit('before-morph')
  paused.value = false
  switched.value = !switched.value
  remember(
    ink('symbol')?.animate(
      { d: switched.value ? PAUSE : PLAY },
      auditMode
        ? { duration: 1600, ease: 'linear' }
        : { type: 'spring', duration: 650, bounce: 0.18 },
    ),
  )
  audit('morph')
}
function pause() {
  paused.value = !paused.value
  for (const handle of handles) paused.value ? handle.pause() : handle.play()
  audit(paused.value ? 'pause' : 'play')
}
function reset() {
  handles.forEach((h) => h.stop())
  handles = []
  paused.value = switched.value = false
  ink('symbol')?.set({ d: PLAY })
  for (const id of ['check', 'ring', 'line'])
    ink(id)?.set({ strokeStart: 0, strokeEnd: 0 })
  audit('reset')
}
function reduce() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
  audit('reduced')
}
function seek() {
  handles.forEach((h) => {
    h.pause()
    h.progress = 0.5
  })
  paused.value = true
  audit('seek')
}
function loop() {
  ink('ring')?.set({ strokeEnd: 0 })
  remember(
    ink('ring')?.animate(
      { strokeEnd: 1 },
      { duration: 700, delay: 1400, repeat: 1, repeatType: 'reverse', ease: 'linear' },
    ),
  )
  audit('loop')
}
function invalid() {
  try {
    ink('symbol')?.animate({ d: 'M0 0L20 20' })
  } catch (e) {
    audit('rejected', String(e))
  }
}
function resize() {
  compact.value = !compact.value
  audit('resize')
}
const suspend = () => audit('background'),
  resume = () => audit('foreground')
onUnmounted(() => {
  ended = true
  owner.dispose()
  handles = []
  audit('disposed')
  Application.off(Application.suspendEvent, suspend)
  Application.off(Application.resumeEvent, resume)
  configure({ reducedMotion: 'user' })
})
</script>
<template>
  <GridLayout
    ref="root"
    rows="auto,*,auto,auto,auto,auto,auto"
    padding="20"
    borderRadius="28"
    backgroundColor="#242638"
    automationText="shape-lab"
    @layoutChanged="layout"
  >
    <GridLayout columns="*,auto" marginBottom="12">
      <StackLayout>
        <Label
          text="LINEWORK"
          color="#F4B992"
          fontSize="12"
          fontWeight="bold"
          letterSpacing=".22"
        />
        <Label
          :text="t('A little line. A whole new feeling.')"
          color="#AAA9BB"
          fontSize="12"
          marginTop="5"
        />
      </StackLayout>
      <Image
        col="1"
        src="~/assets/jolt-header.png"
        width="28"
        height="32"
        tintColor="#F4B992"
        verticalAlignment="top"
      />
    </GridLayout>
    <GridLayout
      row="1"
      rows="auto,*,auto"
      borderRadius="22"
      backgroundColor="#2E3047"
      padding="14"
      marginBottom="12"
    >
      <GridLayout columns="*,auto">
        <Label
          :text="t('ONE SYMBOL. TWO MOODS.')"
          fontSize="9"
          color="#AAA9BB"
          letterSpacing=".12"
        />
        <Label col="1" text="01 — 02" color="#F4B992" fontSize="10" />
      </GridLayout>
      <GridLayout row="1" :height="compact ? 110 : 'auto'" minHeight="100">
        <GridLayout
          width="152"
          height="152"
          borderRadius="76"
          borderWidth="1"
          borderColor="#48465C"
          horizontalAlignment="center"
          verticalAlignment="center"
        />
        <GridLayout
          width="120"
          height="120"
          borderRadius="60"
          backgroundColor="#34364C"
          horizontalAlignment="center"
          verticalAlignment="center"
        />
        <GridLayout
          id="shape-symbol"
          automationText="shape-symbol"
          :height="compact ? 100 : 150"
          :width="compact ? 100 : 150"
          horizontalAlignment="center"
          verticalAlignment="center"
        />
      </GridLayout>
      <Label
        row="2"
        :text="t(switched ? 'Take a breath.' : 'Ready when you are.')"
        color="#F2E4DC"
        fontSize="18"
        textAlignment="center"
        marginTop="4"
      />
    </GridLayout>
    <GridLayout row="2" columns="*,*" height="132" marginBottom="10">
      <GridLayout
        rows="*,auto"
        backgroundColor="#303B3D"
        borderRadius="20"
        marginRight="6"
        padding="12"
      >
        <GridLayout
          id="shape-check"
          automationText="shape-check"
          width="80"
          height="80"
          horizontalAlignment="center"
        />
        <Label
          row="1"
          :text="t('Make your mark.')"
          color="#C8E4CF"
          fontSize="12"
          textAlignment="center"
        />
      </GridLayout>
      <GridLayout
        col="1"
        rows="*,auto"
        backgroundColor="#373349"
        borderRadius="20"
        marginLeft="6"
        padding="12"
      >
        <GridLayout
          width="58"
          height="58"
          borderRadius="29"
          borderWidth="3"
          borderColor="#514861"
          horizontalAlignment="center"
          verticalAlignment="center"
        />
        <GridLayout
          id="shape-ring"
          automationText="shape-ring"
          width="80"
          height="80"
          horizontalAlignment="center"
        />
        <Label
          row="1"
          :text="t('Come full circle.')"
          color="#D5C4F2"
          fontSize="12"
          textAlignment="center"
        />
      </GridLayout>
    </GridLayout>
    <GridLayout row="3" rows="auto,auto" marginBottom="10">
      <Label
        :text="t('Small strokes. Big personality.')"
        color="#F2E4DC"
        fontSize="15"
        textAlignment="center"
      />
      <GridLayout id="shape-line" row="1" automationText="shape-line" height="26" />
    </GridLayout>
    <GridLayout row="4" columns="*,*,*" height="42">
      <Button
        :text="t('Draw again')"
        automationText="shape-draw"
        backgroundColor="#F4B992"
        color="#44332E"
        borderRadius="15"
        margin="2"
        fontSize="12"
        @tap="draw"
      />
      <Button
        col="1"
        :text="t('Switch shape')"
        automationText="shape-morph"
        backgroundColor="#48445E"
        color="#F2E4DC"
        borderRadius="15"
        margin="2"
        fontSize="12"
        @tap="morph"
      />
      <Button
        col="2"
        :text="t(paused ? 'Resume' : 'Pause')"
        automationText="shape-pause"
        backgroundColor="#48445E"
        color="#F2E4DC"
        borderRadius="15"
        margin="2"
        fontSize="12"
        @tap="pause"
      />
    </GridLayout>
    <GridLayout row="5" columns="*,*" height="38" marginTop="5">
      <Button
        :text="t('Start fresh')"
        automationText="shape-reset"
        backgroundColor="transparent"
        color="#AAA9BB"
        fontSize="11"
        @tap="reset"
      />
      <Button
        col="1"
        :text="t(reduced ? 'Restore motion' : 'Reduce motion')"
        automationText="shape-reduce"
        backgroundColor="transparent"
        color="#AAA9BB"
        fontSize="11"
        @tap="reduce"
      />
    </GridLayout>
    <GridLayout v-if="auditMode" row="6" columns="*,*,*,*,*" height="32">
      <Button
        text="Snapshot"
        automationText="shape-snapshot"
        fontSize="8"
        @tap="audit('snapshot')"
      />
      <Button
        col="1"
        text="Midpoint"
        automationText="shape-seek"
        fontSize="8"
        @tap="seek"
      />
      <Button
        col="2"
        text="Resize"
        automationText="shape-resize"
        fontSize="8"
        @tap="resize"
      />
      <Button
        col="3"
        text="Repeat"
        automationText="shape-loop"
        fontSize="8"
        @tap="loop"
      />
      <Button
        col="4"
        text="Reject"
        automationText="shape-invalid"
        fontSize="8"
        @tap="invalid"
      />
    </GridLayout>
  </GridLayout>
</template>
