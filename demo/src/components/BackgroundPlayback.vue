<script setup lang="ts">
import { Application, File, knownFolders, isIOS, type View } from '@nativescript/core'
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { useMotionScope } from '@rafaelaugusto/jolt/vue'
import type { PlaybackAnimation } from '@rafaelaugusto/jolt'
import { launchArgument } from '../launch'

// A normal Vue-owned native scene. The opt-in probe only observes presentation;
// it never supplies animation frames or restores/restarts the handles.
const motion = useMotionScope()
const planet = ref(),
  spark0 = ref(),
  spark1 = ref(),
  spark2 = ref()
const shadow = ref(),
  floating = ref(),
  held = ref()
const returns = ref(0),
  status = ref('Running'),
  manual = ref(false)
const handles: Record<string, PlaybackAnimation> = {}
const ended: Record<string, boolean> = {}
const probe = launchArgument('background-probe') !== undefined
const events: unknown[] = []
let views: Record<string, View> = {}
let timer: ReturnType<typeof setInterval> | undefined
const file = () =>
  File.fromPath(
    (isIOS
      ? knownFolders.documents().path
      : Application.android.context.getExternalFilesDir(null).getAbsolutePath()) +
      '/background-playback.json',
  )
function pose(view: View) {
  const native = view.nativeViewProtected
  if (!native) return null
  if (isIOS) {
    const layer = native.layer.presentationLayer() ?? native.layer
    const m = layer.transform
    return {
      x: m.m41,
      y: m.m42,
      scaleX: Math.hypot(m.m11, m.m12),
      opacity: layer.opacity,
    }
  }
  return {
    x: native.getTranslationX(),
    y: native.getTranslationY(),
    scaleX: native.getScaleX(),
    opacity: native.getAlpha(),
  }
}
function sample(event: string) {
  if (!probe) return
  events.push({
    event,
    at: Date.now(),
    appSuspended: Application.suspended,
    scopeSuspended: motion.suspended,
    size: motion.size,
    ended: { ...ended },
    paused: Object.fromEntries(
      Object.entries(handles).map(([key, h]) => [key, h.paused]),
    ),
    poses: Object.fromEntries(
      Object.entries(views).map(([key, view]) => [key, pose(view)]),
    ),
  })
  // No per-frame writes; this diagnostic samples at 5 Hz only when requested.
  if (event !== 'sample' || events.length % 10 === 0)
    file().writeTextSync(JSON.stringify(events))
}
function suspend() {
  sample('suspend')
}
function resume() {
  returns.value++
  sample('resume')
}
function toggle() {
  manual.value = !manual.value
  if (manual.value) motion.suspend()
  else motion.resume()
  status.value = manual.value ? 'Paused by you' : 'Running'
  sample('manual-toggle')
}
function stop() {
  motion.reset()
  status.value = 'Stopped'
  sample('reset')
}
onMounted(() => {
  views = Object.fromEntries(
    Object.entries({ planet, spark0, spark1, spark2, shadow, floating, held }).map(
      ([key, element]) => [key, element.value.nativeView],
    ),
  )
  handles.path = motion.animate(
    planet.value,
    {
      path: 'M 58 0 A 58 30 0 1 1 -58 0 A 58 30 0 1 1 58 0',
      scale: [0.75, 1.15, 0.75],
      opacity: [0.5, 1, 0.5],
    },
    { duration: 6000, ease: 'linear', repeat: Infinity },
  )
  handles.stagger = motion.animate(
    [spark0.value, spark1.value, spark2.value],
    { opacity: [0.25, 1, 0.25], scale: [0.7, 1.2, 0.7] },
    {
      duration: 2600,
      repeat: Infinity,
      ease: 'easeInOut',
      stagger: { each: 430, from: 'center' },
    },
  )
  handles.reverse = motion.animate(
    shadow.value,
    { scaleX: [1, 0.55], opacity: [1, 0.35] },
    { duration: 1400, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' },
  )
  handles.layer = motion.animate(
    floating.value,
    { y: [0, -24] },
    {
      duration: 1400,
      repeat: Infinity,
      repeatType: 'reverse',
      ease: 'easeInOut',
      layer: 'idle',
    },
  )
  handles.composed = motion.animate(
    floating.value,
    { y: [0, 8] },
    {
      duration: 1700,
      repeat: Infinity,
      repeatType: 'reverse',
      ease: 'easeInOut',
      layer: 'accent',
    },
  )
  handles.held = motion.animate(
    held.value,
    { x: [0, 40] },
    { duration: 1000, repeat: Infinity },
  )
  handles.held.pause()
  for (const [key, handle] of Object.entries(handles))
    void handle.finished.then((value) => {
      ended[key] = value
      sample('settled:' + key)
    })
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  sample('mounted')
  if (probe) timer = setInterval(() => sample('sample'), 200)
})
onUnmounted(() => {
  Application.off(Application.suspendEvent, suspend)
  Application.off(Application.resumeEvent, resume)
  if (timer) clearInterval(timer)
  sample('unmounted')
})
</script>

<template>
  <StackLayout backgroundColor="#f6f5f0" padding="24" verticalAlignment="stretch">
    <Label
      text="JOLT / PLAYBACK"
      color="#537359"
      fontSize="12"
      fontWeight="bold"
      marginTop="18"
    />
    <Label
      text="Back in motion."
      color="#172a24"
      fontSize="32"
      fontWeight="bold"
      marginTop="10"
    />
    <Label
      :text="'Leave the app, then come back.\nThe same loops continue.'"
      textWrap="true"
      color="#52635c"
      fontSize="16"
      marginTop="12"
    />
    <GridLayout rows="130,130" columns="*,*" marginTop="24">
      <GridLayout
        row="0"
        col="0"
        rows="*,auto"
        margin="4"
        backgroundColor="#e2e9dc"
        borderRadius="18"
      >
        <Label
          ref="planet"
          text="●"
          fontSize="34"
          color="#3f694c"
          horizontalAlignment="center"
          verticalAlignment="middle"
        />
        <Label
          row="1"
          text="Orbit + fade"
          textAlignment="center"
          marginBottom="12"
          color="#324d3b"
        />
      </GridLayout>
      <GridLayout
        row="0"
        col="1"
        rows="*,auto"
        margin="4"
        backgroundColor="#e8e2d7"
        borderRadius="18"
      >
        <StackLayout
          orientation="horizontal"
          horizontalAlignment="center"
          verticalAlignment="middle"
        >
          <Label ref="spark0" text="✦" fontSize="30" color="#9a6339" margin="3" /><Label
            ref="spark1"
            text="✦"
            fontSize="30"
            color="#9a6339"
            margin="3"
          /><Label ref="spark2" text="✦" fontSize="30" color="#9a6339" margin="3" />
        </StackLayout>
        <Label
          row="1"
          text="Stagger"
          textAlignment="center"
          marginBottom="12"
          color="#70523c"
        />
      </GridLayout>
      <GridLayout
        row="1"
        col="0"
        rows="*,auto"
        margin="4"
        backgroundColor="#dedeea"
        borderRadius="18"
      >
        <GridLayout
          ref="shadow"
          width="80"
          height="30"
          borderRadius="15"
          backgroundColor="#777198"
          horizontalAlignment="center"
          verticalAlignment="middle"
        />
        <Label
          row="1"
          text="Reverse"
          textAlignment="center"
          marginBottom="12"
          color="#57516f"
        />
      </GridLayout>
      <GridLayout
        row="1"
        col="1"
        rows="*,auto"
        margin="4"
        backgroundColor="#dae5e9"
        borderRadius="18"
      >
        <Label
          ref="floating"
          text="●"
          fontSize="48"
          color="#45798c"
          horizontalAlignment="center"
          verticalAlignment="middle"
        />
        <Label
          row="1"
          text="Two layers"
          textAlignment="center"
          marginBottom="12"
          color="#3d5e6a"
        />
      </GridLayout>
    </GridLayout>
    <StackLayout orientation="horizontal" horizontalAlignment="center" marginTop="22">
      <Label ref="held" text="●" color="#a9afa8" marginRight="12" /><Label
        text="Manually paused — stays still"
        color="#69736c"
        fontSize="13"
      />
    </StackLayout>
    <Label
      :text="status + ' · Returns: ' + returns"
      accessibilityIdentifier="background-status"
      textAlignment="center"
      color="#324d3b"
      fontSize="16"
      marginTop="24"
    />
    <GridLayout columns="*,*" height="52" marginTop="16">
      <Button
        col="0"
        :text="manual ? 'Resume' : 'Pause'"
        accessibilityIdentifier="background-pause"
        @tap="toggle"
      />
      <Button
        col="1"
        text="Stop all"
        accessibilityIdentifier="background-stop"
        @tap="stop"
      />
    </GridLayout>
  </StackLayout>
</template>
