<script setup lang="ts">
import { File, knownFolders, isIOS, type EventData, type View } from '@nativescript/core'
import {
  requestAnimationFrame,
  cancelAnimationFrame,
} from '@nativescript/core/animation-frame'
import { onUnmounted, ref } from 'nativescript-vue'
import { configure } from '@rafaelaugusto/jolt'
import {
  recordInteraction,
  parseTrace,
  type InteractionTrace,
  type TraceRecorder,
  type TraceInput,
  type ReplayReport,
} from '@rafaelaugusto/jolt/testing'
import {
  motionTraceGraph,
  observeTraceInputs,
  replayWithDriver,
  traceMetadata,
  traceNow,
  traceSettings,
  type MotionTraceGraph,
} from '@rafaelaugusto/jolt/testing/native'
import { runInteractionReplayChecks } from '../../../benchmarks/interaction-replay-checks'
import spring from '../../../benchmarks/traces/interrupted-spring.json'
import { usePreviewI18n } from '../showcase/i18n'
import { launchArgument } from '../launch'

defineProps<{ embedded?: boolean }>()
defineEmits(['back'])
const { t } = usePreviewI18n()
const recording = ref(false),
  busy = ref(false),
  count = ref(0),
  status = ref('Ready to record'),
  mode = ref<'spring' | 'drag'>('spring')
let card: View | undefined,
  graph: MotionTraceGraph | undefined,
  recorder: TraceRecorder | undefined,
  saved: InteractionTrace | undefined
let needsBaseline = false
let frame: number | undefined,
  lastSample = -Infinity,
  stopInputs = () => {},
  cancelTimer: ReturnType<typeof setTimeout> | undefined,
  deadline: ReturnType<typeof setTimeout> | undefined
let cancelArmed = false
const abort = { aborted: false }
function loaded(event: EventData) {
  card = event.object as View
  configure({ reducedMotion: 'never', timeScale: 1 })
  if (launchArgument('replay-checks') !== undefined) setTimeout(() => void checks(), 350)
}
function write(name: string, value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  knownFolders.documents().getFile(name).writeTextSync(text)
  if (!isIOS && card) {
    const folder = card._context?.getExternalFilesDir(null)
    if (folder) File.fromPath(folder.getAbsolutePath() + '/' + name).writeTextSync(text)
  }
}
function finish() {
  if (frame !== undefined) cancelAnimationFrame(frame)
  if (deadline !== undefined) clearTimeout(deadline)
  if (cancelTimer !== undefined) clearTimeout(cancelTimer)
  frame = undefined
  deadline = undefined
  cancelTimer = undefined
  stopInputs()
  stopInputs = () => {}
  if (recorder) {
    saved = recorder.stop()
    // Keep the real presentation capture separately: native startup and frame
    // scheduling do not share the controlled engine's clock origin.
    write('jolt-recorded-presentation.json', saved)
    needsBaseline = true
    recorder = undefined
  }
  recording.value = false
  graph?.dispose()
  graph = undefined
}
async function prepareBaseline() {
  if (!needsBaseline || !saved || !card) return
  const report = await replayWithDriver(saved, (trace) =>
    motionTraceGraph(trace.motions, () => card!),
  )
  const checkpoints = saved.entries.filter((entry) => 'expected' in entry)
  if (
    report.observations.length !== checkpoints.length ||
    report.remainingResources !== 0 ||
    report.errors.some((error) => !error.startsWith('card at '))
  )
    throw new Error('Could not capture the engine baseline.')
  // Freeze this engine version's observations ONCE, when accepting the take.
  // Subsequent replays compare against this saved oracle; they never regenerate it.
  checkpoints.forEach((entry, index) => {
    entry.expected = report.observations[index]!.observed
  })
  needsBaseline = false
  write('jolt-interaction-trace.json', saved)
}
async function finishTake() {
  finish()
  busy.value = true
  try {
    await prepareBaseline()
    status.value = 'Trace saved'
  } catch {
    status.value = 'Recording failed'
  } finally {
    busy.value = false
  }
}
function sample() {
  if (!recording.value || !recorder || !graph) return
  try {
    if (traceNow() - lastSample >= 40) {
      lastSample = traceNow()
      recorder.checkpoint('card', graph.read('card'), { position: 6, velocity: 35 })
      count.value = recorder.size
    }
    frame = requestAnimationFrame(sample)
  } catch {
    finish()
    status.value = 'Recording failed'
  }
}
function start(kind: 'spring' | 'drag') {
  if (!card || busy.value) return
  finish()
  mode.value = kind
  const source = parseTrace(spring),
    motion = { ...source.motions[0]!, kind, snap: kind === 'drag' ? [0, 240] : [] }
  graph = motionTraceGraph([motion], () => card!, { native: true })
  recorder = recordInteraction({
    now: traceNow,
    metadata: traceMetadata(),
    settings: traceSettings(),
    motions: [motion],
    seed: 63,
  })
  lastSample = -Infinity
  count.value = 0
  cancelArmed = kind === 'drag'
  if (kind === 'drag')
    stopInputs = observeTraceInputs(card, 'card', {
      input(event) {
        recorder?.input(event)
        if (cancelArmed && event.type === 'gesture' && event.phase === 'move') {
          cancelArmed = false
          cancelTimer = setTimeout(() => {
            if (!recorder || !graph) return
            const event: TraceInput = {
              type: 'gesture',
              id: 'card',
              phase: 'cancel',
              x: 0,
              y: 0,
              velocityX: 0,
              velocityY: 0,
              pointers: [],
            }
            recorder.input(event)
            graph.input(event)
            status.value = 'Drag cancelled by the app'
          }, 120)
        }
      },
    })
  recording.value = true
  status.value =
    kind === 'spring'
      ? 'Tap right, then reverse'
      : 'Drag the card. Cancellation is armed.'
  frame = requestAnimationFrame(sample)
  deadline = setTimeout(() => {
    void finishTake()
  }, 30_000)
}
function target(value: number) {
  if (!recorder || !graph || mode.value !== 'spring') return
  const event: TraceInput = { type: 'target', id: 'card', value }
  recorder.input(event)
  graph.input(event)
}
async function replay(broken = false) {
  if (!card || busy.value) return
  finish()
  busy.value = true
  status.value = 'Replaying recorded time'
  try {
    await prepareBaseline()
    const trace = parseTrace(saved ?? spring)
    if (broken) {
      const sample = trace.entries.find((entry) => 'expected' in entry)
      if (sample && 'expected' in sample) sample.expected.position += 80
    }
    const reports: ReplayReport[] = []
    for (const native of [false, true])
      reports.push(
        await replayWithDriver(
          trace,
          (trace) => motionTraceGraph(trace.motions, () => card!, { native }),
          { native, signal: abort },
        ),
      )
    write('jolt-interaction-replay.json', { broken, reports })
    write('jolt-interaction-replay.svg', reports[1]!.plot)
    const passed = reports.every((report) => report.passed)
    status.value = broken
      ? !passed
        ? 'Regression caught'
        : 'Regression was missed'
      : passed
        ? 'Replay matched'
        : 'Replay diverged'
  } catch (error) {
    status.value = 'Replay failed'
    write('jolt-interaction-replay.json', { error: String(error) })
  } finally {
    busy.value = false
  }
}
async function checks() {
  if (!card || busy.value) return
  finish()
  busy.value = true
  status.value = 'Running native regressions'
  try {
    const report = await runInteractionReplayChecks(card, 'preview', abort)
    write('jolt-replay-checks.json', { status: 'passed', ...report })
    status.value = 'Native regressions passed'
  } catch (error) {
    write('jolt-replay-checks.json', { status: 'failed', error: String(error) })
    status.value = 'Native regressions failed'
  } finally {
    busy.value = false
  }
}
onUnmounted(() => {
  abort.aborted = true
  finish()
  configure({ reducedMotion: 'user', timeScale: 1 })
})
</script>

<template>
  <GridLayout rows="auto,*,auto,auto" padding="20" backgroundColor="#F1EEE7">
    <StackLayout marginBottom="18">
      <Label
        :text="t('THE MOTION ARCHIVE')"
        fontSize="10"
        letterSpacing=".15"
        color="#76677F"
      />
      <Label
        :text="t('Nothing lost in motion.')"
        textWrap="true"
        :fontSize="embedded ? 25 : 32"
        fontWeight="bold"
        letterSpacing="-.05"
        color="#30263C"
        marginTop="8"
      />
      <Label
        :text="t('Record the moment. Reproduce the detail.')"
        fontSize="12"
        textWrap="true"
        color="#827889"
        marginTop="8"
      />
    </StackLayout>
    <GridLayout
      row="1"
      rows="auto,*,auto"
      borderRadius="26"
      backgroundColor="#DED6E9"
      padding="18"
      minHeight="170"
    >
      <GridLayout columns="*,auto">
        <Label
          :text="recording ? t('RECORDING') : t('TAKE 01')"
          fontSize="10"
          letterSpacing=".12"
          color="#695774"
        />
        <Label col="1" :text="count + ' ' + t('events')" fontSize="10" color="#695774" />
      </GridLayout>
      <GridLayout row="1" height="90" verticalAlignment="center">
        <Label
          text="·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·"
          color="#B8A8CA"
          fontSize="24"
          verticalAlignment="center"
        />
        <GridLayout
          id="replay-card"
          automationText="replay-card"
          width="70"
          height="70"
          borderRadius="23"
          backgroundColor="#49355B"
          horizontalAlignment="left"
          @loaded="loaded"
        >
          <Label
            text="↗"
            fontSize="34"
            color="#F8F3DF"
            textAlignment="center"
            verticalAlignment="center"
          />
        </GridLayout>
      </GridLayout>
      <Label
        row="2"
        :text="t(status)"
        automationText="replay-status"
        fontSize="12"
        textWrap="true"
        color="#49355B"
      />
    </GridLayout>
    <StackLayout row="2" marginTop="14">
      <GridLayout columns="*,*">
        <Button
          :text="t('Record spring')"
          automationText="record-spring"
          :isEnabled="!busy"
          @tap="start('spring')"
          backgroundColor="#49355B"
          color="#F8F3DF"
          borderRadius="20"
          height="42"
          fontSize="12"
          marginRight="4"
        />
        <Button
          col="1"
          :text="t('Record drag')"
          automationText="record-drag"
          :isEnabled="!busy"
          @tap="start('drag')"
          backgroundColor="#49355B"
          color="#F8F3DF"
          borderRadius="20"
          height="42"
          fontSize="12"
          marginLeft="4"
        />
      </GridLayout>
      <GridLayout columns="*,*,*" marginTop="7">
        <Button
          :text="t('Left')"
          automationText="replay-left"
          :isEnabled="recording &amp;&amp; mode === 'spring'"
          @tap="target(0)"
          backgroundColor="#E4DCCB"
          color="#49355B"
          borderRadius="18"
          height="40"
          fontSize="12"
          marginRight="4"
        />
        <Button
          col="1"
          :text="t('Right')"
          automationText="replay-right"
          :isEnabled="recording &amp;&amp; mode === 'spring'"
          @tap="target(180)"
          backgroundColor="#E4DCCB"
          color="#49355B"
          borderRadius="18"
          height="40"
          fontSize="12"
          marginLeft="4"
          marginRight="4"
        />
        <Button
          col="2"
          :text="t('Finish take')"
          automationText="replay-finish"
          :isEnabled="recording"
          @tap="finishTake"
          backgroundColor="#E4DCCB"
          color="#49355B"
          borderRadius="18"
          height="40"
          fontSize="12"
          marginLeft="4"
        />
      </GridLayout>
      <GridLayout columns="*,*" marginTop="7">
        <Button
          :text="t('Replay take')"
          automationText="replay-run"
          :isEnabled="!busy"
          @tap="replay()"
          backgroundColor="#BBD1B2"
          color="#293F2C"
          borderRadius="18"
          height="42"
          fontSize="12"
          marginRight="4"
        />
        <Button
          col="1"
          :text="t('Catch a regression')"
          automationText="replay-break"
          :isEnabled="!busy"
          @tap="replay(true)"
          backgroundColor="#E9C9C7"
          color="#623C45"
          borderRadius="18"
          height="42"
          fontSize="12"
          marginLeft="4"
        />
      </GridLayout>
    </StackLayout>
    <StackLayout row="3" marginTop="8">
      <Label
        :text="t('Replay uses recorded time, not wall-clock speed.')"
        textAlignment="center"
        fontSize="9"
        color="#827889"
        textWrap="true"
      />
      <Button
        :text="t('Run native regressions')"
        automationText="replay-checks"
        :isEnabled="!busy"
        @tap="checks"
        height="32"
        fontSize="10"
        color="#695774"
        backgroundColor="transparent"
      />
    </StackLayout>
  </GridLayout>
</template>
