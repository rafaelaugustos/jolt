<script setup lang="ts">
import { companionRig } from '../composition-recipe'

import {
  Application,
  File,
  isIOS,
  knownFolders,
  type View,
  Label,
} from '@nativescript/core'
import { KeepAlive, ref, onUnmounted, nextTick } from 'nativescript-vue'
import {
  animate,
  configure,
  gradientText,
  motionBehaviors,
  motionScope,
  withTimelineCues,
  particles,
  type GradientText,
  type MotionBehaviors,
  type CuedTimeline,
} from '@rafaelaugusto/jolt'
import { rig2d, type Rig } from '@rafaelaugusto/jolt/rig'
import RetainedDrawing from './RetainedDrawing.vue'
import { launchArgument } from '../launch'

const mode = ref(launchArgument('native-motion') || 'resources')
const cached = ref(true),
  mounted = ref(true),
  paused = ref(false),
  reduced = ref(false)
const created = ref(0),
  destroyed = ref(0),
  status = ref('Ready'),
  title = ref('Motion feels alive')
const child = ref(),
  root = ref()
const owner = motionScope()
let rig: Rig | undefined,
  lamp: Rig | undefined,
  behavior: MotionBehaviors | undefined,
  text: GradientText | undefined,
  cues: CuedTimeline | undefined
let latest: View | undefined
let probing = false
let setupPaused = false
const events: object[] = []
const host = () => root.value?.nativeView as View | undefined
const target = (id: string) => host()?.getViewById(id)!
function audit(name: string) {
  if (launchArgument('native-motion-audit') === undefined) return
  let rigState: object | undefined
  if (rig && !rig.disposed) {
    try {
      rigState = { paused: rig.paused, grip: rig.point('grip') }
    } catch (error) {
      rigState = { paused: rig.paused, unavailable: String(error) }
    }
  }
  const event = {
    name,
    time: Date.now(),
    mode: mode.value,
    created: created.value,
    destroyed: destroyed.value,
    status: status.value,
    resource: child.value?.snapshot(),
    text: text?.snapshot(),
    rig: rigState,
    behavior: behavior && { current: behavior.current, paused: behavior.paused },
    cue: cues && { paused: cues.paused },
    scope: owner.size,
  }
  events.push(event)
  const directory = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null).getAbsolutePath()
  File.fromPath(directory + '/native-motion.json').writeTextSync(
    JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }, null, 2),
  )
}
function clear() {
  owner.reset()
  rig = lamp = undefined
  behavior = undefined
  text = undefined
  cues = undefined
  latest = undefined
}
async function choose(next: string) {
  clear()
  mode.value = next
  paused.value = false
  status.value = 'Ready'
  await nextTick()
  setup()
}
function setup() {
  if (setupPaused || !host()?.isLoaded) return
  const main = mode.value === 'resources' ? host() : target('motion-main')
  if (!main?.isLoaded || main === latest) return
  latest = main
  if (mode.value === 'text') {
    text = owner.resource(() =>
      gradientText(main as Label, {
        colors: ['#7C3AED', '#DB2777', '#F59E0B'],
        angle: 0,
        sheen: { width: 0.35, color: '#FFFFFFFF' },
      }),
    )
  }
  if (mode.value === 'rig') {
    rig = owner.resource(() =>
      rig2d(companionRig, {
        body: main,
        head: target('rig-head'),
        hand: target('rig-hand'),
      }),
    )
    rig.accessory('grip', target('rig-flower'))
    lamp = owner.resource(() =>
      rig2d(
        {
          parts: {
            base: { pivot: { x: 0.5, y: 1 }, rest: { rotate: 0 }, rotation: [-35, 35] },
            shade: { parent: 'base', pivot: { x: 0.5, y: 0.5 }, rest: { rotate: 0 } },
          },
          poses: {
            rest: {},
            wave: { base: { rotate: -25 }, shade: { rotate: 20 } },
            reach: { base: { rotate: 35 }, shade: { rotate: -35 } },
          },
        },
        { base: target('lamp-base'), shade: target('lamp-shade') },
      ),
    )
  }
  if (mode.value === 'behaviors') {
    const feedback = target('behavior-feedback')
    const make =
      (x: number, rotate: number) =>
      async ({ scope, wait }: any) => {
        await wait(
          scope.timeline([
            [main, { x, rotate }, { duration: 1800 }],
            [feedback, { scale: 1.15, opacity: 0.6 }, { at: 0, duration: 1800 }],
          ]),
        )
      }
    behavior = owner.retain(
      motionBehaviors(
        {
          rest: {
            priority: -1,
            run: async ({ scope, wait }) => {
              status.value = 'Rest'
              await wait(
                scope.timeline([
                  [main, { x: 0, rotate: 0 }, { duration: 450 }],
                  [feedback, { scale: 1, opacity: 1 }, { at: 0, duration: 450 }],
                ]),
              )
            },
          },
          touch: { priority: 1, run: make(-65, -18) },
          dress: { priority: 2, run: make(65, 18) },
          eat: { priority: 3, blocks: ['touch', 'dress'], run: make(0, 25) },
        },
        {
          rest: 'rest',
          onError: (error) => {
            status.value = String(error)
          },
        },
      ),
    )
  }
  if (!probing) audit('setup')
  if (!probing && launchArgument('native-motion-probe') !== undefined) {
    probing = true
    setTimeout(() => {
      void probe().catch((error) => {
        status.value = String(error)
        audit('probe-error')
      })
    }, 700)
  }
}
async function probe() {
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  const now = () =>
    isIOS
      ? CACurrentMediaTime() * 1000
      : android.os.SystemClock.elapsedRealtimeNanos() / 1e6
  const measurements: object[] = []
  const startedAt = Date.now()
  const started = now()
  if (mode.value === 'text') {
    const label = target('motion-main') as Label
    for (let i = 0; i < 24; i++) {
      setupPaused = true
      clear()
      title.value = i % 2 ? 'Native motion\nمرحبا بالعالم' : 'Motion feels alive'
      label.fontSize = i % 2 ? 23 : 29
      label.fontWeight = i % 2 ? 'normal' : 'bold'
      label.textAlignment = i % 2 ? 'right' : 'center'
      label.textWrap = true
      await nextTick()
      await delay(40)
      setupPaused = false
      const begin = now()
      setup()
      text!.refresh()
      await nextTick()
      const setupMs = now() - begin
      await delay(40)
      const handle = text!.play({ duration: 120 })
      handle.pause()
      const held = handle.progress
      await delay(30)
      if (handle.progress !== held) throw new Error('Paused text advanced')
      handle.play()
      await handle.finished
      measurements.push({
        iteration: i,
        setupMs,
        ...text!.snapshot(),
        nativeCount: isIOS ? undefined : org.rafaelaugusto.jolt.TextGradient.liveCount(),
      })
    }
    clear()
    measurements.push({
      disposed: true,
      nativeCount: isIOS ? undefined : org.rafaelaugusto.jolt.TextGradient.liveCount(),
      scope: owner.size,
    })
    title.value = 'Motion feels alive'
    label.fontSize = 29
    label.fontWeight = 'bold'
    label.textAlignment = 'center'
    await nextTick()
    setup()
  } else if (mode.value === 'rig') {
    for (let i = 0; i < 30; i++) {
      const begin = now()
      const result = rig!.to(i % 2 ? 'wave' : 'reach', { duration: 150, ease: 'linear' })
      const setupMs = now() - begin
      if (i % 3 === 0) {
        rig!.pause()
        const point = rig!.point('grip')
        await delay(30)
        const held = rig!.point('grip')
        if (Math.abs(point.x - held.x) > 1 || Math.abs(point.y - held.y) > 1)
          throw new Error('Paused socket moved')
        rig!.play()
      }
      await result.finished
      const angle = target('rig-hand').rotate
      if (angle < -70.01 || angle > 70.01) throw new Error('Rotation exceeded limits')
      measurements.push({ iteration: i, setupMs, angle, scope: owner.size })
    }
    clear()
    measurements.push({ disposed: true, scope: owner.size })
    setup()
  } else if (mode.value === 'cues') {
    for (let i = 0; i < 12; i++) {
      const result = withTimelineCues(
        animate(
          target('motion-main'),
          { x: i % 2 ? -100 : 100 },
          { duration: 180, ease: 'linear' },
        ),
        [
          {
            name: 'sample',
            at: 90,
            effect(event) {
              measurements.push({ iteration: i, ...event })
            },
          },
        ],
      )
      await result.finished
    }
    if (measurements.length !== 12) throw new Error('Missing cue')
  } else if (mode.value === 'resources') {
    for (let i = 0; i < 12; i++) {
      await cache()
      await delay(40)
      await cache()
      await delay(40)
      await mount()
      await delay(40)
      await mount()
      await delay(40)
      measurements.push({
        iteration: i,
        created: created.value,
        destroyed: destroyed.value,
        ...child.value?.snapshot(),
      })
      if (created.value - destroyed.value !== 1) throw new Error('Drawing ownership grew')
    }
  } else {
    for (let i = 0; i < 30; i++) {
      behavior!.request('touch')
      behavior!.request('dress')
      behavior!.request('eat')
      behavior!.cancel()
      await delay(20)
    }
    clear()
    measurements.push({ disposed: true, scope: owner.size })
    setup()
  }
  const directory = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null).getAbsolutePath()
  File.fromPath(directory + '/native-motion-probe.json').writeTextSync(
    JSON.stringify(
      {
        platform: isIOS ? 'ios' : 'android',
        mode: mode.value,
        startedAt,
        elapsedMs: now() - started,
        measurements,
      },
      null,
      2,
    ),
  )
  status.value = 'Validation complete'
  audit('probe-complete')
}
function action(name: string) {
  if (mode.value === 'behaviors') {
    const run = behavior!.request(name)
    status.value =
      behavior!.current === name ? name : 'Blocked during ' + behavior!.current
    void run.finished.then((result) => audit(name + ':' + result.status))
  } else if (mode.value === 'rig') {
    rig!.to(name, { type: 'spring', duration: 1100, bounce: 0.35 })
    lamp!.to(name, 'smooth')
    status.value = name
  }
  audit(name)
}
function togglePause() {
  paused.value = !paused.value
  if (mode.value === 'resources')
    paused.value ? child.value?.pause() : child.value?.resume()
  else paused.value ? owner.suspend() : owner.resume()
  status.value = paused.value ? 'Paused' : 'Resumed'
  audit(status.value)
}
function toggleReduced() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'never' })
  audit('reduced')
}
function shine() {
  text?.play({ duration: 1800, ease: 'easeInOut' })
  status.value = 'Native glyph sheen'
  audit('sheen')
}
function cueCancel() {
  cues?.dispose()
  status.value = 'Cancelled'
}
function cuePlay() {
  cues?.dispose()
  const main = target('motion-main'),
    burst = target('cue-burst')
  main.translateX = -100
  burst.opacity = 0
  cues = owner.add(
    withTimelineCues(
      animate(main, { x: [-100, 100] }, { duration: 2400, ease: 'linear' }),
      [
        {
          name: 'impact',
          at: 1200,
          effect() {
            status.value = 'impact: particles + haptic'
            return animate(
              burst,
              { scale: [0.2, 1.6], opacity: [1, 0], rotate: [0, 45] },
              { duration: 650, haptic: { style: 'light', times: [0.001] } },
            )
          },
        },
        {
          name: 'impact-particles',
          at: 1200,
          effect: () =>
            particles(host()!, {
              source: 'center',
              colors: ['#F59E0B', '#8B5CF6'],
              rate: 90,
              duration: 150,
              lifetime: 600,
              spread: 360,
              velocity: 150,
              size: 5,
            }),
        },
      ],
    ),
  )
  status.value = 'Approaching cue'
  audit('cue-play')
}
async function cache() {
  cached.value = !cached.value
  await nextTick()
  status.value = cached.value ? 'Cache restored' : 'Cached / paused'
  audit('cache')
}
async function mount() {
  mounted.value = !mounted.value
  await nextTick()
  status.value = mounted.value ? 'Mounted' : 'Disposed'
  audit('mount')
}
onUnmounted(() => {
  owner.dispose()
  configure({ reducedMotion: 'system' })
  audit('unmounted')
})
</script>
<template>
  <GridLayout
    ref="root"
    rows="auto,auto,auto,*,auto,auto"
    backgroundColor="#F7F4EF"
    padding="18"
    @loaded="setup"
    @layoutChanged="setup"
  >
    <Label text="Native motion" fontSize="26" fontWeight="700" color="#242038" />
    <GridLayout row="1" columns="*,*,*,*,*" marginTop="12">
      <Button text="Own" col="0" @tap="choose('resources')" /><Button
        text="Act"
        col="1"
        @tap="choose('behaviors')"
      /><Button text="Rig" col="2" @tap="choose('rig')" /><Button
        text="Text"
        col="3"
        @tap="choose('text')"
      /><Button text="Cue" col="4" @tap="choose('cues')" />
    </GridLayout>
    <Label
      row="2"
      :text="
        mode === 'resources'
          ? 'Keep drawing • pause playback • dispose on unmount'
          : mode === 'behaviors'
            ? 'Priority, interruption and return to rest'
            : mode === 'rig'
              ? 'Character + lamp • native joints and socket'
              : mode === 'text'
                ? 'Native text • cached glyphs • moving light'
                : 'A named impact cue owns its visual and haptic effects'
      "
      textWrap="true"
      color="#655D75"
      fontSize="15"
      margin="10 0"
    />
    <GridLayout row="3">
      <GridLayout v-if="mode === 'resources'" rows="*,auto">
        <KeepAlive v-if="mounted"
          ><RetainedDrawing
            v-if="cached"
            ref="child"
            @created="created++"
            @disposed="destroyed++"
        /></KeepAlive>
        <Label
          v-if="!cached || !mounted"
          :text="mounted ? 'Drawing cached' : 'Drawing disposed'"
          textAlignment="center"
          color="#6C6380"
        />
        <Label
          row="1"
          :text="'Created ' + created + '  •  Disposed ' + destroyed"
          automationText="resource-counts"
          textAlignment="center"
        />
      </GridLayout>
      <GridLayout v-else-if="mode === 'behaviors'" rows="*,auto">
        <GridLayout
          id="motion-main"
          width="110"
          height="140"
          backgroundColor="#BDA7ED"
          borderRadius="45"
          @loaded="setup"
          ><Label text="• ᴗ •" fontSize="32" textAlignment="center"
        /></GridLayout>
        <GridLayout
          row="1"
          id="behavior-feedback"
          backgroundColor="#E5DDF3"
          padding="20"
          borderRadius="15"
          ><Label
            text="The same policy can coordinate a UI confirmation"
            textWrap="true"
            textAlignment="center"
        /></GridLayout>
      </GridLayout>
      <GridLayout v-else-if="mode === 'rig'" columns="*,*">
        <AbsoluteLayout id="motion-main" width="140" height="230" @loaded="setup">
          <GridLayout
            left="32"
            top="95"
            width="76"
            height="105"
            backgroundColor="#A78BFA"
            borderRadius="30"
          />
          <GridLayout
            id="rig-head"
            left="26"
            top="35"
            width="88"
            height="76"
            backgroundColor="#C4B5FD"
            borderRadius="34"
            ><Label text="• ᴗ •" fontSize="25" textAlignment="center"
          /></GridLayout>
          <AbsoluteLayout
            id="rig-hand"
            left="100"
            top="105"
            width="24"
            height="95"
            backgroundColor="#A78BFA"
            borderRadius="12"
            ><Label
              id="rig-flower"
              left="0"
              top="0"
              width="40"
              height="40"
              text="✿"
              fontSize="36"
              color="#DB2777"
          /></AbsoluteLayout>
        </AbsoluteLayout>
        <AbsoluteLayout
          col="1"
          id="lamp-base"
          width="95"
          height="170"
          backgroundColor="transparent"
        >
          <GridLayout
            left="41"
            top="45"
            width="12"
            height="125"
            backgroundColor="#D97706"
            borderRadius="6"
          />
          <GridLayout
            id="lamp-shade"
            left="10"
            top="25"
            width="80"
            height="50"
            backgroundColor="#FBBF24"
            borderRadius="22"
          />
        </AbsoluteLayout>
      </GridLayout>
      <StackLayout v-else-if="mode === 'text'" verticalAlignment="middle">
        <Label
          id="motion-main"
          :text="title"
          fontSize="36"
          fontWeight="700"
          textAlignment="center"
          textWrap="true"
          @loaded="setup"
        />
        <Label
          text="Native Label remains the accessible text"
          fontSize="14"
          textAlignment="center"
          marginTop="24"
          color="#6C6380"
        />
      </StackLayout>
      <GridLayout v-else>
        <Label
          id="cue-burst"
          text="✦"
          fontSize="100"
          color="#F59E0B"
          opacity="0"
          textAlignment="center"
        />
        <GridLayout
          id="motion-main"
          width="44"
          height="44"
          borderRadius="22"
          backgroundColor="#8B5CF6"
          @loaded="setup"
        />
        <Label
          text="impact"
          verticalAlignment="bottom"
          textAlignment="center"
          color="#655D75"
        />
      </GridLayout>
    </GridLayout>
    <StackLayout row="4" marginTop="10">
      <GridLayout v-if="mode === 'resources'" columns="*,*"
        ><Button
          text="Cache / restore"
          automationText="resource-cache"
          @tap="cache" /><Button
          col="1"
          text="Unmount / mount"
          automationText="resource-mount"
          @tap="mount"
      /></GridLayout>
      <GridLayout v-if="mode === 'behaviors'" columns="*,*,*"
        ><Button
          text="Touch"
          automationText="behavior-touch"
          @tap="action('touch')" /><Button
          col="1"
          text="Dress"
          automationText="behavior-dress"
          @tap="action('dress')" /><Button
          col="2"
          text="Eat"
          automationText="behavior-eat"
          @tap="action('eat')"
      /></GridLayout>
      <GridLayout v-if="mode === 'rig'" columns="*,*,*"
        ><Button text="Rest" automationText="rig-rest" @tap="action('rest')" /><Button
          col="1"
          text="Wave"
          automationText="rig-wave"
          @tap="action('wave')" /><Button
          col="2"
          text="Reach"
          automationText="rig-reach"
          @tap="action('reach')"
      /></GridLayout>
      <GridLayout v-if="mode === 'text'" columns="*,*"
        ><Button text="Sheen" automationText="text-sheen" @tap="shine" /><Button
          col="1"
          text="Change text"
          automationText="text-change"
          @tap="
            title =
              title === 'Motion feels alive' ? 'Olá, motion! مرحبا' : 'Motion feels alive'
          "
      /></GridLayout>
      <GridLayout v-if="mode === 'cues'" columns="*,*"
        ><Button text="Play cue" automationText="cue-play" @tap="cuePlay" /><Button
          col="1"
          text="Cancel"
          automationText="cue-cancel"
          @tap="cueCancel"
      /></GridLayout>
      <GridLayout columns="*,*,*"
        ><Button
          text="Pause / resume"
          automationText="motion-pause"
          @tap="togglePause" /><Button
          col="1"
          text="Reduce motion"
          automationText="motion-reduce"
          @tap="toggleReduced" /><Button
          col="2"
          text="Snapshot"
          automationText="motion-snapshot"
          @tap="audit('snapshot')"
      /></GridLayout>
    </StackLayout>
    <Label
      row="5"
      :text="status"
      automationText="motion-status"
      textWrap="true"
      color="#655D75"
      fontSize="14"
      marginTop="8"
    />
  </GridLayout>
</template>
