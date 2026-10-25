<script setup lang="ts">
import {
  ApplicationSettings,
  File,
  Utils,
  knownFolders,
  isIOS,
  type EventData,
  type View,
} from '@nativescript/core'
import { computed, onUnmounted, ref } from 'nativescript-vue'
import {
  animate,
  bind,
  configure,
  motionValue,
  set,
  stop,
  timeline,
  type Animation,
  type PlaybackAnimation,
} from '@rafaelaugusto/jolt'
import {
  createMotionInspector,
  inspectorPlot,
  inspectorSpring,
  springCode,
  type InspectorSnapshot,
  type MotionInspector,
} from '@rafaelaugusto/jolt/inspector'
import { runMotionInspectorChecks } from '../../../benchmarks/motion-inspector-checks'
import { usePreviewI18n } from '../showcase/i18n'
import { launchArgument } from '../launch'

const { t } = usePreviewI18n()
const snapshot = ref<InspectorSnapshot>(),
  selected = ref('card'),
  mode = ref('spring')
const duration = ref(ApplicationSettings.getNumber('jolt-inspector-duration', 650))
const bounce = ref(ApplicationSettings.getNumber('jolt-inspector-bounce', 0.35))
const status = ref('Select a dot. See what moves it.'),
  busy = ref(false),
  held = ref(false)
let card: View, follower: View, inspector: MotionInspector | undefined
let current: PlaybackAnimation | undefined,
  group: Animation | undefined,
  release = () => {}
let refreshTimer: ReturnType<typeof setInterval> | undefined,
  launchTimer: ReturnType<typeof setTimeout> | undefined
const signal = { aborted: false }
const settings = () => ({ duration: duration.value, bounce: bounce.value })
const plot = computed(() => inspectorPlot(snapshot.value?.samples ?? []))
const observationKind = computed(() => {
  if (snapshot.value?.status !== 'Sampling native values')
    return t('Sampling paused. Select a dot.')
  const s = snapshot.value.samples.at(-1)
  if (!s || s.observed === null) return t('Native observation unavailable')
  return s.expected === null
    ? t('Native only. Model unavailable.')
    : t(isIOS ? 'iOS presentation layer · DIP' : 'Android view properties · DIP')
})
const rows = computed(() => snapshot.value?.properties ?? [])
const primary = computed(() => rows.value.find((p) => p.property === 'x'))
const lastEvent = computed(
  () =>
    snapshot.value?.events.findLast((e) => e.kind === 'replace') ??
    snapshot.value?.events.at(-1),
)
const eventText = computed(() => {
  const e = lastEvent.value
  return e
    ? `${t(e.previousLabel ?? e.previous ?? 'Resting')} → ${t(e.label ?? e.owner)}`
    : t('No ownership changes yet')
})
const bindingText = computed(() => {
  const b = snapshot.value?.bindings[0]
  return b
    ? `${t(b.source.label)} → ${b.source.mappings.length} ${t('mapping')} → ${b.property}`
    : t('Direct view animation')
})
const sampleText = computed(() => {
  const s = snapshot.value?.samples.at(-1)
  return s?.observed === null || !s
    ? t('Waiting for native samples')
    : `${s.observed.toFixed(1)} DIP · ${snapshot.value!.samples.length} ${t('samples')}`
})
function refresh() {
  if (inspector) snapshot.value = inspector.read()
}
function loaded(event: EventData, id: string) {
  if (id === 'card') card = event.object as View
  else follower = event.object as View
  if (!card || !follower || inspector) return
  configure({ timeScale: 1, reducedMotion: 'never' })
  startInspector()
  if (launchArgument('inspector-checks') !== undefined)
    launchTimer = setTimeout(() => void checks(), 350)
}
function startInspector() {
  inspector = createMotionInspector({ development: true, capacity: 180, hertz: 60 })
  inspector.watch(card, 'card')
  inspector.watch(follower, 'follower')
  inspector.select(selected.value)
  refresh()
  refreshTimer = setInterval(refresh, 200)
}
function select(id: string) {
  if (busy.value || !inspector) return
  selected.value = id
  inspector.select(id)
  refresh()
  status.value = 'Selection is read-only'
}
function cleanMotion() {
  release()
  release = () => {}
  group?.stop()
  current?.stop()
  group = undefined
  current = undefined
  held.value = false
  if (card) {
    stop(card)
    set(card, { x: 0 })
  }
  if (follower) {
    stop(follower)
    set(follower, { x: 0 })
  }
}
function replay() {
  if (busy.value || !inspector) return
  cleanMotion()
  const transition = { ...inspectorSpring(settings()), velocity: 0 }
  if (mode.value === 'binding') {
    const progress = motionValue(0)
    inspector.label(progress, 'Progress')
    release = bind(follower, { x: progress.to([0, 1], [0, 220]) })
    selected.value = 'follower'
    inspector.select('follower')
    current = animate(progress, 1, { ...transition, duration: duration.value * 2 })
    inspector.label(current, 'Bound progress')
  } else {
    selected.value = 'card'
    inspector.select('card')
    if (mode.value === 'sequence') {
      group = timeline([
        {
          run: () => {
            current = animate(card, { x: 220 }, { ...transition, delay: 400 })
            inspector!.label(current, 'Delayed entrance')
            return current
          },
        },
        {
          at: 1400,
          run: () => {
            current = animate(card, { x: 30 }, transition)
            inspector!.label(current, 'Second step')
            return current
          },
        },
      ])
    } else {
      current = animate(card, { x: [0, 220] }, transition)
      inspector.label(current, 'Entrance')
      if (mode.value === 'layers') {
        const layer = animate(
          card,
          { x: [0, 25, 0] },
          { duration: duration.value * 2, ease: 'easeInOut', layer: 'press' },
        )
        inspector.label(layer, 'Press layer')
      }
    }
  }
  status.value =
    mode.value === 'layers' ? 'Two owners. One property.' : 'Native playback is running'
  refresh()
}
function choose(value: string) {
  if (!busy.value) {
    mode.value = value
    replay()
  }
}
function interrupt() {
  if (!inspector || busy.value) return
  group?.stop()
  group = undefined
  release()
  release = () => {}
  const target = selected.value === 'card' ? card : follower
  current = animate(target, { x: 20 }, inspectorSpring(settings()))
  inspector.label(current, 'Return')
  held.value = false
  status.value = 'Ownership changed. Velocity continues.'
  refresh()
}
function scrub() {
  if (!current || !inspector || current.duration === Infinity) return
  if (!snapshot.value?.properties.length) {
    status.value = 'Replay before scrubbing'
    return
  }
  inspector.control(current, 'seek', 0.25)
  held.value = true
  status.value = 'Paused at 25%. Explicit edit.'
  refresh()
}
function resume() {
  if (!current || !inspector) return
  inspector.control(current, 'play')
  held.value = false
  status.value = 'Native playback is running'
}
function durationChanged(event: EventData & { value?: number }) {
  duration.value = Math.round(event.value ?? duration.value)
}
function bounceChanged(event: EventData & { value?: number }) {
  bounce.value = Math.round(event.value ?? bounce.value * 100) / 100
}
function write(name: string, value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  knownFolders.documents().getFile(name).writeTextSync(text)
  if (!isIOS && card)
    File.fromPath(
      card._context.getExternalFilesDir(null).getAbsolutePath() + '/' + name,
    ).writeTextSync(text)
}
function copy() {
  const code = springCode({ to: 220, spring: settings() })
  Utils.copyToClipboard(code)
  ApplicationSettings.setNumber('jolt-inspector-duration', duration.value)
  ApplicationSettings.setNumber('jolt-inspector-bounce', bounce.value)
  write('jolt-inspector-settings.json', { spring: settings(), code })
  status.value = 'TypeScript copied. Settings saved.'
}
async function checks() {
  if (busy.value) return
  busy.value = true
  cleanMotion()
  if (refreshTimer) clearInterval(refreshTimer)
  inspector?.dispose()
  inspector = undefined
  status.value = 'Checking the inspector'
  try {
    const report = await runMotionInspectorChecks(card, signal)
    write('jolt-inspector-checks.json', report)
    status.value = 'Inspector checks passed'
  } catch (error) {
    write('jolt-inspector-checks.json', {
      status: 'failed',
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    status.value = 'Inspector checks failed'
  } finally {
    busy.value = false
    if (!signal.aborted) startInspector()
  }
}
onUnmounted(() => {
  signal.aborted = true
  if (launchTimer) clearTimeout(launchTimer)
  if (refreshTimer) clearInterval(refreshTimer)
  inspector?.dispose()
  inspector = undefined
  cleanMotion()
})
</script>

<template>
  <GridLayout rows="auto,150,*" backgroundColor="#F4F0E8" padding="16">
    <StackLayout marginBottom="12">
      <Label
        :text="t('BEHIND THE MOTION')"
        color="#856C54"
        fontSize="10"
        letterSpacing=".12"
      />
      <Label
        :text="t('Motion, explained.')"
        color="#252A34"
        fontSize="28"
        fontWeight="bold"
        marginTop="5"
      />
      <Label
        :text="t(status)"
        automationText="inspector-status"
        height="28"
        color="#666B72"
        fontSize="11"
        textWrap="true"
        marginTop="5"
      />
    </StackLayout>
    <GridLayout
      row="1"
      rows="auto,*"
      backgroundColor="#252A34"
      borderRadius="22"
      padding="14"
      marginBottom="12"
    >
      <GridLayout rows="auto" columns="*,auto">
        <Label :text="t('THE STAGE')" color="#A4A9B5" fontSize="10" letterSpacing=".08" />
        <Label :text="t('Tap a dot to inspect')" color="#A4A9B5" fontSize="10" col="1" />
      </GridLayout>
      <AbsoluteLayout row="1" clipToBounds="false">
        <Label top="30" left="16" width="260" height="1" backgroundColor="#4C515C" />
        <Label top="80" left="16" width="260" height="1" backgroundColor="#4C515C" />
        <Label
          text="A"
          top="8"
          left="0"
          width="44"
          height="44"
          borderRadius="22"
          backgroundColor="#DFFF69"
          color="#252A34"
          fontSize="18"
          fontWeight="bold"
          textAlignment="center"
          verticalTextAlignment="middle"
          automationText="inspector-card"
          @loaded="loaded($event, 'card')"
          @tap="select('card')"
        />
        <Label
          text="B"
          top="61"
          left="5"
          width="34"
          height="34"
          borderRadius="17"
          backgroundColor="#C3B1F0"
          color="#252A34"
          fontSize="14"
          fontWeight="bold"
          textAlignment="center"
          verticalTextAlignment="middle"
          automationText="inspector-follower"
          @loaded="loaded($event, 'follower')"
          @tap="select('follower')"
        />
      </AbsoluteLayout>
    </GridLayout>
    <ScrollView row="2" scrollBarIndicatorVisible="false">
      <StackLayout backgroundColor="#FFFDFA" borderRadius="22" padding="16">
        <GridLayout rows="auto" columns="*,auto" marginBottom="8">
          <Label :text="t('Inspector')" color="#252A34" fontSize="20" fontWeight="bold" />
          <Label
            col="1"
            :text="`${selected === 'card' ? 'A' : 'B'} · x · ${t('read-only')}`"
            color="#4E6D48"
            fontSize="10"
            verticalAlignment="center"
          />
        </GridLayout>
        <Label
          :text="eventText"
          automationText="inspector-owner"
          color="#796541"
          fontSize="11"
          textWrap="true"
          marginBottom="8"
        />
        <GridLayout rows="auto" columns="*,*,*" marginBottom="9">
          <StackLayout
            ><Label :text="t('TARGET')" color="#8A8D91" fontSize="9" /><Label
              :text="primary ? primary.target.toFixed(0) + ' DIP' : '—'"
              color="#252A34"
              fontSize="16"
              fontWeight="bold"
          /></StackLayout>
          <StackLayout col="1"
            ><Label :text="t('VELOCITY')" color="#8A8D91" fontSize="9" /><Label
              :text="primary ? primary.velocity.toFixed(0) + ' /s' : '0 /s'"
              color="#252A34"
              fontSize="16"
              fontWeight="bold"
          /></StackLayout>
          <StackLayout col="2"
            ><Label :text="t('ELAPSED')" color="#8A8D91" fontSize="9" /><Label
              :text="primary ? primary.elapsed.toFixed(0) + ' ms' : t('Resting')"
              color="#252A34"
              fontSize="16"
              fontWeight="bold"
          /></StackLayout>
        </GridLayout>
        <SVGView
          :src="plot"
          height="104"
          stretch="fill"
          automationText="inspector-plot"
        />
        <GridLayout rows="auto" columns="*,auto" marginTop="6" marginBottom="9">
          <Label :text="t('Lime: model · Pink: native')" color="#777B82" fontSize="9" />
          <Label col="1" :text="sampleText" color="#777B82" fontSize="9" />
        </GridLayout>
        <Label
          :text="bindingText"
          automationText="inspector-graph"
          color="#6D608B"
          fontSize="11"
          textWrap="true"
        />
        <Label
          :text="observationKind"
          color="#8A8D91"
          fontSize="9"
          marginTop="3"
          textWrap="true"
        />
        <StackLayout height="28">
          <Label
            v-for="p in rows"
            :key="p.owner + p.property"
            :text="`${t(p.label)} · ${p.property}${p.layer ? ' / ' + p.layer : ''} · ${t('delay')} ${p.delay.toFixed(0)} ms`"
            color="#777B82"
            fontSize="10"
            marginTop="3"
          />
        </StackLayout>
        <GridLayout rows="auto" columns="*,*,*,*" marginTop="12">
          <Button
            :text="t('Spring')"
            automationText="inspector-spring"
            :backgroundColor="mode === 'spring' ? '#E5ECCF' : '#F0EEE8'"
            class="inspect-small"
            @tap="choose('spring')"
          />
          <Button
            col="1"
            :text="t('Sequence')"
            automationText="inspector-sequence"
            :backgroundColor="mode === 'sequence' ? '#E5ECCF' : '#F0EEE8'"
            class="inspect-small"
            @tap="choose('sequence')"
          />
          <Button
            col="2"
            :text="t('Layers')"
            automationText="inspector-layers"
            :backgroundColor="mode === 'layers' ? '#E5ECCF' : '#F0EEE8'"
            class="inspect-small"
            @tap="choose('layers')"
          />
          <Button
            col="3"
            :text="t('Binding')"
            automationText="inspector-binding"
            :backgroundColor="mode === 'binding' ? '#E5ECCF' : '#F0EEE8'"
            class="inspect-small"
            @tap="choose('binding')"
          />
        </GridLayout>
        <GridLayout rows="auto" columns="*,auto" marginTop="10"
          ><Label :text="t('Duration')" color="#666B72" fontSize="11" /><Label
            col="1"
            :text="duration + ' ms'"
            color="#252A34"
            fontSize="11"
            automationText="inspector-duration-value"
        /></GridLayout>
        <Slider
          minValue="300"
          maxValue="1500"
          :value="duration"
          color="#736092"
          backgroundColor="#E9E2F0"
          height="28"
          automationText="inspector-duration"
          @valueChange="durationChanged"
        />
        <GridLayout rows="auto" columns="*,auto"
          ><Label :text="t('Bounce')" color="#666B72" fontSize="11" /><Label
            col="1"
            :text="bounce.toFixed(2)"
            color="#252A34"
            fontSize="11"
        /></GridLayout>
        <Slider
          minValue="0"
          maxValue="75"
          :value="bounce * 100"
          color="#736092"
          backgroundColor="#E9E2F0"
          height="28"
          automationText="inspector-bounce"
          @valueChange="bounceChanged"
        />
        <GridLayout rows="auto" columns="*,*" marginTop="7">
          <Button
            :text="t('Replay')"
            automationText="inspector-replay"
            backgroundColor="#DFFF69"
            class="inspect-button"
            @tap="replay"
          />
          <Button
            col="1"
            :text="t('Interrupt')"
            automationText="inspector-interrupt"
            backgroundColor="#F7D4E5"
            class="inspect-button"
            @tap="interrupt"
          />
        </GridLayout>
        <GridLayout rows="auto" columns="*,*" marginTop="4">
          <Button
            :text="held ? t('Resume') : t('Hold at 25%')"
            automationText="inspector-scrub"
            backgroundColor="#F0EEE8"
            class="inspect-button"
            @tap="held ? resume() : scrub()"
          />
          <Button
            col="1"
            :text="t('Copy TypeScript')"
            automationText="inspector-copy"
            backgroundColor="#F0EEE8"
            class="inspect-button"
            @tap="copy"
          />
        </GridLayout>
        <Label
          :text="t('Tuning applies on Replay. Selecting never changes motion.')"
          color="#8A8D91"
          fontSize="9"
          textWrap="true"
          marginTop="8"
        />
        <Button
          :text="t('Check inspector')"
          automationText="inspector-checks"
          class="inspect-small"
          marginTop="8"
          @tap="checks"
        />
        <Label
          :text="`${t('Bounded native buffer')} · ${snapshot?.overhead.dropped ?? 0} ${t('dropped')}`"
          color="#8A8D91"
          fontSize="9"
          textAlignment="center"
        />
      </StackLayout>
    </ScrollView>
  </GridLayout>
</template>

<style scoped>
.inspect-small {
  font-size: 10;
  color: #353943;
  border-radius: 10;
  height: 32;
  padding: 0;
  margin: 1;
  border-width: 0;
}
.inspect-button {
  font-size: 12;
  font-weight: bold;
  color: #252a34;
  border-radius: 12;
  height: 40;
  padding: 0;
  margin: 2;
  border-width: 0;
}
</style>
