<script setup lang="ts">
import { File, knownFolders, isIOS, type EventData, type View } from '@nativescript/core'
import { ref, computed, onUnmounted } from 'nativescript-vue'
import { configure } from '@rafaelaugusto/jolt'
import { getDriver } from '../../../dist/driver/index.js'
import type { Track } from '../../../dist/track.js'
import {
  samplingTrack,
  uniformSamplingTrack,
  runCurveSamplingChecks,
} from '../../../benchmarks/curve-sampling-checks'
import { usePreviewI18n } from '../showcase/i18n'
import { launchArgument } from '../launch'

defineEmits(['back'])
const { t } = usePreviewI18n()
const fast = ref(true),
  busy = ref(false),
  status = ref('Same curve. A better fit.')
const counts = ref([0, 0]),
  errors = ref([0, 0])
const mode = computed(() => (fast.value ? 'Fast spring' : 'Slow glide'))
let adaptive: View, uniform: View
let prepared: Track, baseline: Track
const handles: { view: View; handle: unknown }[] = []
const abort = { aborted: false }
let timer: ReturnType<typeof setTimeout> | undefined
function error(track: Track) {
  let max = 0,
    j = 0
  for (let time = 0; time < track.duration; time += 0.2) {
    const p = time / track.duration
    while (j < track.times.length - 2 && track.times[j + 1]! < p) j++
    const f = (p - track.times[j]!) / (track.times[j + 1]! - track.times[j]!)
    max = Math.max(
      max,
      Math.abs(
        track.values[j]! +
          f * (track.values[j + 1]! - track.values[j]!) -
          track.valueAt(time),
      ),
    )
  }
  return max
}
function loaded(event: EventData, which: number) {
  const view = event.object as View
  if (which === 0) adaptive = view
  else uniform = view
  if (adaptive && uniform) {
    configure({ timeScale: 1, reducedMotion: 'never' })
    prepare()
    if (launchArgument('sampling-checks') !== undefined)
      timer = setTimeout(() => void checks(), 350)
  }
}
function stop() {
  const driver = getDriver()
  for (const { view, handle } of handles.splice(0)) driver.stop(view, handle)
}
function prepare() {
  stop()
  prepared = samplingTrack(fast.value)
  baseline = uniformSamplingTrack(prepared)
  counts.value = [prepared.values.length, baseline.values.length]
  errors.value = [error(prepared), error(baseline)]
  adaptive.translateX = uniform.translateX = 0
  status.value = 'Same curve. A better fit.'
}
function select(value: boolean) {
  if (busy.value) return
  fast.value = value
  prepare()
}
function play() {
  stop()
  const driver = getDriver(),
    started = driver.now()
  // Slow only the comparison's native playback, preserving the exact prepared point sets.
  const factor = fast.value ? 4 : 1
  for (const [view, track] of [
    [adaptive, prepared],
    [uniform, baseline],
  ] as const) {
    const stretched = {
      ...track,
      duration: track.duration * factor,
      end: track.end * factor,
      arrival: track.arrival * factor,
      valueAt: (time: number) => track.valueAt(time / factor),
      velocityAt: (time: number) => track.velocityAt(time / factor) / factor,
    }
    // Match the engine contract: the model keeps the target after native completion.
    view.translateX = track.to
    handles.push({ view, handle: driver.play(view, stretched, started, () => {}) })
  }
  status.value = fast.value
    ? 'Four times slower. Look at the first turn.'
    : 'Fewer points through the quiet parts.'
}
async function checks() {
  if (busy.value) return
  stop()
  busy.value = true
  status.value = 'Checking native precision'
  try {
    const report = await runCurveSamplingChecks(adaptive, abort)
    const text = JSON.stringify(report, null, 2)
    knownFolders.documents().getFile('jolt-curve-sampling.json').writeTextSync(text)
    if (!isIOS)
      File.fromPath(
        adaptive._context.getExternalFilesDir(null).getAbsolutePath() +
          '/jolt-curve-sampling.json',
      ).writeTextSync(text)
    status.value = 'Native precision checked'
  } catch (error) {
    status.value = 'Native precision failed'
    knownFolders
      .documents()
      .getFile('jolt-curve-sampling.json')
      .writeTextSync(JSON.stringify({ status: 'failed', error: String(error) }))
  } finally {
    busy.value = false
  }
}
onUnmounted(() => {
  abort.aborted = true
  if (timer) clearTimeout(timer)
  stop()
})
</script>

<template>
  <GridLayout rows="auto,*,auto" backgroundColor="#20242D" padding="20" borderRadius="26">
    <StackLayout marginBottom="18">
      <Label
        :text="t('THE SHAPE OF MOTION')"
        color="#B7A7E8"
        fontSize="10"
        letterSpacing=".12"
      />
      <Label
        :text="t('Every curve.\nJust enough detail.')"
        textWrap="true"
        color="#F8F5ED"
        fontSize="29"
        fontWeight="bold"
        marginTop="8"
      />
      <Label
        :text="t(status)"
        automationText="sampling-status"
        textWrap="true"
        color="#B6B6B9"
        fontSize="12"
        marginTop="10"
      />
    </StackLayout>
    <StackLayout row="1" verticalAlignment="center">
      <GridLayout rows="auto" columns="*,auto" marginBottom="16">
        <Label :text="t(mode)" color="#F8F5ED" fontSize="17" fontWeight="bold" />
        <Label
          col="1"
          :text="fast ? t('4× slow replay') : t('Original speed')"
          color="#B7A7E8"
          fontSize="11"
          verticalAlignment="center"
        />
      </GridLayout>
      <StackLayout
        backgroundColor="#2B3434"
        borderRadius="20"
        padding="14"
        marginBottom="12"
      >
        <GridLayout rows="auto" columns="*,auto" marginBottom="14">
          <Label :text="t('Adaptive')" color="#DFFA61" fontSize="13" fontWeight="bold" />
          <Label
            col="1"
            :text="counts[0] + ' ' + t('points')"
            color="#DFFA61"
            fontSize="12"
          />
        </GridLayout>
        <GridLayout height="42">
          <Label height="2" backgroundColor="#4C5B45" verticalAlignment="center" />
          <Label
            automationText="sampling-adaptive"
            width="30"
            height="30"
            borderRadius="15"
            backgroundColor="#DFFA61"
            horizontalAlignment="left"
            verticalAlignment="center"
            @loaded="loaded($event, 0)"
          />
        </GridLayout>
        <Label
          :text="errors[0].toFixed(3) + ' DIP · ' + t('peak sampled error')"
          color="#C5CEAD"
          fontSize="11"
          marginTop="10"
        />
      </StackLayout>
      <StackLayout backgroundColor="#353039" borderRadius="20" padding="14">
        <GridLayout rows="auto" columns="*,auto" marginBottom="14">
          <Label
            :text="t('Fixed 60 / second')"
            color="#F0B5C8"
            fontSize="13"
            fontWeight="bold"
          />
          <Label
            col="1"
            :text="counts[1] + ' ' + t('points')"
            color="#F0B5C8"
            fontSize="12"
          />
        </GridLayout>
        <GridLayout height="42">
          <Label height="2" backgroundColor="#64505A" verticalAlignment="center" />
          <Label
            automationText="sampling-uniform"
            width="30"
            height="30"
            borderRadius="15"
            backgroundColor="#F0B5C8"
            horizontalAlignment="left"
            verticalAlignment="center"
            @loaded="loaded($event, 1)"
          />
        </GridLayout>
        <Label
          :text="errors[1].toFixed(3) + ' DIP · ' + t('peak sampled error')"
          color="#CDB8C0"
          fontSize="11"
          marginTop="10"
        />
      </StackLayout>
    </StackLayout>
    <StackLayout row="2" marginTop="18">
      <GridLayout rows="auto" columns="*,*" marginBottom="8">
        <Button
          :text="t('Fast spring')"
          automationText="sampling-fast"
          :isEnabled="!busy"
          @tap="select(true)"
          backgroundColor="#373442"
          color="#D7C7FF"
          height="40"
          borderRadius="14"
          fontSize="12"
          marginRight="4"
        />
        <Button
          col="1"
          :text="t('Slow glide')"
          automationText="sampling-slow"
          :isEnabled="!busy"
          @tap="select(false)"
          backgroundColor="#373442"
          color="#D7C7FF"
          height="40"
          borderRadius="14"
          fontSize="12"
          marginLeft="4"
        />
      </GridLayout>
      <Button
        :text="t('Feel the curve')"
        automationText="sampling-play"
        :isEnabled="!busy"
        @tap="play"
        backgroundColor="#DFFA61"
        color="#20242D"
        height="46"
        borderRadius="16"
        fontWeight="bold"
        fontSize="13"
      />
      <Button
        :text="t('Check native precision')"
        automationText="sampling-checks"
        :isEnabled="!busy"
        @tap="checks"
        backgroundColor="transparent"
        color="#B7A7E8"
        height="36"
        fontSize="11"
        marginTop="4"
      />
    </StackLayout>
  </GridLayout>
</template>
