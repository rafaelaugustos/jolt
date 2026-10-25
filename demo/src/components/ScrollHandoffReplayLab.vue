<script setup lang="ts">
import {
  Color,
  File,
  GridLayout,
  Label,
  ScrollView,
  StackLayout,
  knownFolders,
  isIOS,
  type EventData,
} from '@nativescript/core'
import { ref, onUnmounted } from 'nativescript-vue'
import { bind, configure } from '@rafaelaugusto/jolt'
import { GestureSurface, gestures, type Gestures } from '@rafaelaugusto/jolt/gestures'
import {
  parseTrace,
  recordInteraction,
  scrollHandoffTraceGraph,
  type InteractionTrace,
  type TraceRecorder,
  type ReplayReport,
} from '@rafaelaugusto/jolt/testing'
import {
  nativeScrollHandoffTraceGraph,
  observeScrollHandoffInputs,
  replayWithDriver,
  traceNow,
  traceMetadata,
  traceSettings,
} from '@rafaelaugusto/jolt/testing/native'
import fixture from '../../../benchmarks/traces/scroll-sheet-handoff.json'
import { runScrollHandoffChecks } from '../../../benchmarks/scroll-handoff-checks'
import { launchArgument } from '../launch'
import { usePreviewI18n } from '../showcase/i18n'

defineEmits(['back'])
const { t } = usePreviewI18n()
const busy = ref(false),
  recording = ref(false),
  status = ref('Scroll first. Then the sheet.'),
  count = ref(0)
let host: GridLayout,
  sheet: GestureSurface,
  scroll: ScrollView,
  live: Gestures | undefined
let unbind = () => {},
  unobserve = () => {},
  recorder: TraceRecorder | undefined,
  saved: InteractionTrace | undefined
let timer: ReturnType<typeof setTimeout> | undefined
const abort = { aborted: false }
function write(name: string, data: unknown) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  knownFolders.documents().getFile(name).writeTextSync(text)
  if (!isIOS)
    File.fromPath(
      sheet._context.getExternalFilesDir(null).getAbsolutePath() + '/' + name,
    ).writeTextSync(text)
}
function releaseLive() {
  unobserve()
  unobserve = () => {}
  unbind()
  unbind = () => {}
  live?.dispose()
  live = undefined
}
function mount(event: EventData) {
  host = event.object as GridLayout
  configure({ timeScale: 1, reducedMotion: 'never' })
  sheet = new GestureSurface()
  sheet.automationText = 'handoff-sheet'
  sheet.height = 200
  sheet.rows = '36,*'
  sheet.verticalAlignment = 'top'
  sheet.backgroundColor = new Color('#FFFCF4')
  sheet.borderRadius = 22
  const title = new Label()
  title.text = t('WEEKEND NOTES') + '  ↕'
  title.fontSize = 12
  title.fontWeight = 'bold'
  title.color = new Color('#244A3D')
  title.padding = '10 16'
  sheet.addChild(title)
  scroll = new ScrollView()
  scroll.automationText = 'handoff-scroll'
  scroll.height = 164
  GridLayout.setRow(scroll, 1)
  const content = new StackLayout()
  content.height = 564
  const names = [
    'Slow mornings',
    'A place to wander',
    'Small discoveries',
    'One more chapter',
    'An open window',
    'The way home',
    'Nothing in a hurry',
    'Keep this feeling',
  ]
  for (const [i, name] of names.entries()) {
    const row = new Label()
    row.text = `0${i + 1}   ${t(name)}`
    row.height = 70
    row.padding = '22 16'
    row.fontSize = 16
    row.color = new Color('#244A3D')
    row.backgroundColor = new Color(i % 2 ? '#F3EAD8' : '#FFFCF4')
    content.addChild(row)
  }
  scroll.content = content
  sheet.addChild(scroll)
  host.addChild(sheet)
  timer = setTimeout(() => {
    if (abort.aborted) return
    if (launchArgument('handoff-checks') !== undefined) void checks()
    else reset()
  }, 350)
}
function reset() {
  if (busy.value) return
  finish()
  live = gestures(sheet, {
    pan: { axis: 'y', bounds: { top: 0, bottom: 160 } },
    scrollView: scroll,
    onStart: () => {
      status.value = 'The sheet has the gesture'
    },
    onEnd: () => {
      status.value = 'Contact released'
    },
  })
  unbind = bind(sheet, { y: live.y })
  live.jumpTo({ y: 0 })
  scroll.scrollToVerticalOffset(80, false)
  status.value = 'Scroll first. Then the sheet.'
}
function finish() {
  if (timer) clearTimeout(timer)
  timer = undefined
  releaseLive()
  if (recorder) {
    saved = recorder.stop()
    recorder = undefined
    write('jolt-handoff-trace.json', saved)
  }
  recording.value = false
}
function record() {
  reset()
  const trace = parseTrace(fixture)
  recorder = recordInteraction({
    now: traceNow,
    metadata: traceMetadata(),
    settings: traceSettings(),
    motions: trace.motions,
    seed: 63,
  })
  // Capture this version's independent reference once while recording. Replays never update it.
  const reference = scrollHandoffTraceGraph(trace.motions)
  unobserve = observeScrollHandoffInputs(
    scroll,
    {
      input(event) {
        if (!recorder) return
        try {
          recorder.input(event)
          reference.input(event)
          for (const id of ['sheet', 'scroll'])
            recorder.checkpoint(id, reference.read(id), { position: 3, velocity: 30 })
          count.value = recorder.size
        } catch {
          finish()
          status.value = 'Recording failed'
        }
      },
    },
    traceNow,
  )
  const detach = unobserve
  unobserve = () => {
    detach()
    reference.dispose()
  }
  recording.value = true
  status.value = 'Drag inside the notes, then reverse'
  timer = setTimeout(finishTake, 30000)
}
function finishTake() {
  finish()
  status.value = 'Trace saved'
}
async function replay(broken = false) {
  if (busy.value) return
  finish()
  busy.value = true
  status.value = 'Replaying recorded time'
  try {
    const trace = parseTrace(saved ?? fixture)
    if (broken) {
      const checkpoint = trace.entries.find((e) => 'expected' in e && e.id === 'scroll')
      if (checkpoint && 'expected' in checkpoint) checkpoint.expected.position += 80
    }
    const reports: ReplayReport[] = []
    for (const native of [false, true])
      reports.push(
        await replayWithDriver(
          trace,
          (t) =>
            native
              ? nativeScrollHandoffTraceGraph(t.motions, sheet, scroll)
              : scrollHandoffTraceGraph(t.motions),
          { native, signal: abort },
        ),
      )
    write('jolt-handoff-replay.json', { broken, reports })
    write('jolt-handoff-replay.svg', reports[1]!.plot)
    status.value = broken
      ? reports.every(
          (r) =>
            !r.passed &&
            r.remainingResources === 0 &&
            r.observations.some((o) => o.positionError > 70),
        )
        ? 'Ownership regression caught'
        : 'Regression was missed'
      : reports.every((r) => r.passed)
        ? 'Replay matched'
        : 'Replay diverged'
  } catch (error) {
    status.value = 'Replay failed'
    write('jolt-handoff-replay.json', { error: String(error) })
  } finally {
    busy.value = false
  }
}
async function checks() {
  finish()
  busy.value = true
  status.value = 'Running native regressions'
  try {
    const report = await runScrollHandoffChecks(host, 'preview-handoff', abort)
    write('jolt-handoff-checks.json', { status: 'passed', ...report })
    status.value = 'Native regressions passed'
  } catch (error) {
    status.value = 'Native regressions failed'
    write('jolt-handoff-checks.json', { status: 'failed', error: String(error) })
  } finally {
    busy.value = false
  }
}
onUnmounted(() => {
  abort.aborted = true
  finish()
})
</script>

<template>
  <GridLayout rows="auto,*,auto" backgroundColor="#F1EEE7" padding="18">
    <StackLayout marginBottom="14">
      <Label
        :text="t('ONE GESTURE. TWO OWNERS.')"
        fontSize="10"
        letterSpacing=".1"
        color="#587565"
      />
      <Label
        :text="t('Pass the feeling on.')"
        fontSize="27"
        fontWeight="bold"
        color="#243B31"
        marginTop="8"
      />
      <Label
        :text="t(status)"
        automationText="handoff-status"
        textWrap="true"
        fontSize="12"
        color="#587565"
        marginTop="8"
      />
    </StackLayout>
    <GridLayout
      row="1"
      rows="*,auto"
      backgroundColor="#C7DDD4"
      borderRadius="26"
      padding="14"
      minHeight="340"
    >
      <GridLayout @loaded="mount" />
      <Label
        row="1"
        :text="count + ' ' + t('events')"
        color="#587565"
        fontSize="10"
        marginTop="6"
      />
    </GridLayout>
    <StackLayout row="2" marginTop="10">
      <GridLayout columns="*,*">
        <Button
          :text="t('Record handoff')"
          automationText="handoff-record"
          :isEnabled="!busy"
          @tap="record"
          backgroundColor="#244A3D"
          color="#FFFCF4"
          borderRadius="18"
          height="42"
          fontSize="12"
          marginRight="4"
        />
        <Button
          col="1"
          :text="t('Finish take')"
          automationText="handoff-finish"
          :isEnabled="recording"
          @tap="finishTake"
          backgroundColor="#E4DCCB"
          color="#244A3D"
          borderRadius="18"
          height="42"
          fontSize="12"
          marginLeft="4"
        />
      </GridLayout>
      <GridLayout columns="*,*" marginTop="6">
        <Button
          :text="t('Replay take')"
          automationText="handoff-replay"
          :isEnabled="!busy"
          @tap="replay()"
          backgroundColor="#BBD1B2"
          color="#244A3D"
          borderRadius="18"
          height="42"
          fontSize="12"
          marginRight="4"
        />
        <Button
          col="1"
          :text="t('Catch a regression')"
          automationText="handoff-break"
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
      <GridLayout columns="*,*,*" marginTop="6">
        <Button
          :text="t('Reset')"
          automationText="handoff-reset"
          :isEnabled="!busy"
          @tap="reset"
          height="34"
          fontSize="10"
        />
        <Button
          col="1"
          :text="t('Run native checks')"
          automationText="handoff-checks"
          :isEnabled="!busy"
          @tap="checks"
          height="34"
          fontSize="10"
        />
        <Button
          col="2"
          :text="t('Back')"
          :isEnabled="!busy"
          @tap="$emit('back')"
          height="34"
          fontSize="10"
        />
      </GridLayout>
    </StackLayout>
  </GridLayout>
</template>
