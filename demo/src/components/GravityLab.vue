<script setup lang="ts">
import {
  Application,
  File,
  isIOS,
  knownFolders,
  Screen,
  type View,
} from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import {
  bind,
  configure,
  motionScope,
  motionValue,
  set,
  stop,
  type PlaybackAnimation,
} from '@rafaelaugusto/jolt'
import { usePreviewI18n } from '../showcase/i18n'
import { launchArgument } from '../launch'
const { t } = usePreviewI18n()
defineProps<{ embedded?: boolean }>()
const world = ref(),
  ball = ref(),
  shadow = ref()
const mood = ref(1),
  paused = ref(false),
  reduced = ref(false)
const status = ref('Ready to let go.')
const names = ['Soft landing', 'Extra bounce', 'No bounce']
const restitution = [0.35, 0.72, 0]
const height = motionValue(0)
const owner = motionScope()
let current: PlaybackAnimation | undefined
let floor = 200,
  releaseBindings: (() => void)[] = [],
  ready = false,
  disposed = false
const auditMode = launchArgument('gravity-audit') !== undefined
const events: object[] = []
const view = (target: any): View => target.value?.nativeView
function audit(name: string) {
  if (!auditMode) return
  const node = view(ball)?.nativeViewProtected
  const presented = node
    ? isIOS
      ? (node.layer.presentationLayer() ?? node.layer).valueForKeyPath(
          'transform.translation.y',
        )
      : node.getTranslationY() / Screen.mainScreen.scale
    : null
  events.push({
    name,
    time: Date.now(),
    value: height.get(),
    presented,
    floor,
    progress: current?.progress,
    paused: current?.paused,
    resources: owner.size,
    reduced: reduced.value,
    restitution: restitution[mood.value],
  })
  File.fromPath(
    (isIOS
      ? knownFolders.documents().path
      : Application.android.context.getExternalFilesDir(null).getAbsolutePath()) +
      '/gravity-audit.json',
  ).writeTextSync(
    JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }, null, 2),
  )
}
function layout() {
  if (disposed || !view(world)?.isLoaded) return
  const next = Math.max(40, view(world).getActualSize().height - 148)
  if (ready && Math.abs(next - floor) < 0.5) return
  const fraction = ready ? Math.max(0, Math.min(1, height.get() / floor)) : 0
  current?.stop()
  current = undefined
  paused.value = false
  releaseBindings.forEach((stop) => stop())
  releaseBindings = []
  floor = next
  set(height, fraction * floor)
  releaseBindings.push(
    owner.use(() =>
      bind(view(ball), {
        y: height,
        rotate: height.to([0, floor], [-12, 12]),
      }),
    ),
  )
  releaseBindings.push(
    owner.use(() =>
      bind(view(shadow), {
        scaleX: height.to([0, floor], [0.35, 1]),
        opacity: height.to([0, floor], [0.08, 0.4]),
      }),
    ),
  )
  ready = true
  audit('layout')
}
function loaded() {
  if (!isIOS) view(ball)?.android?.setClipToOutline(true)
  if (owner.suspended) owner.resume()
  layout()
}
function play(toss = false) {
  if (!ready || disposed) return
  if (owner.suspended) owner.resume()
  paused.value = false
  if (!toss) set(height, 0)
  const velocity = toss ? -Math.sqrt(2 * 1100 * floor) * 0.85 : 0
  const animation = owner.animate(height, floor, {
    type: 'gravity',
    acceleration: 1100,
    restitution: restitution[mood.value],
    velocity,
  })
  current = animation
  status.value = reduced.value
    ? 'Right where it belongs.'
    : 'Every bounce, a little quieter.'
  audit(toss ? 'toss' : 'drop')
  void animation.finished.then((finished) => {
    if (current !== animation || disposed) return
    status.value = finished ? 'Right where it belongs.' : 'A moment of stillness.'
    paused.value = false
    audit(finished ? 'landed' : 'stopped')
  })
}
function togglePause() {
  if (!current) return
  if (paused.value) {
    current.play()
    status.value = 'Every bounce, a little quieter.'
  } else {
    current.pause()
    status.value = 'A moment of stillness.'
  }
  paused.value = !paused.value
  audit(paused.value ? 'pause' : 'resume')
}
function returnUp() {
  if (!ready || owner.suspended) return
  const animation = owner.animate(height, 0, 'smooth')
  current = animation
  paused.value = false
  status.value = 'A fresh start, with the same momentum.'
  audit('return')
}
function reduce() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
  if (reduced.value) {
    set(height, floor)
    paused.value = false
    status.value = 'Right where it belongs.'
  }
  audit('reduced')
}
function choose(index: number) {
  mood.value = index
  play()
}
function suspend() {
  if (!disposed) {
    owner.suspend()
    audit('suspend')
  }
}
function resume() {
  if (!disposed) {
    owner.resume()
    audit('foreground')
  }
}
Application.on(Application.suspendEvent, suspend)
Application.on(Application.resumeEvent, resume)
onUnmounted(() => {
  disposed = true
  owner.dispose()
  stop(height)
  Application.off(Application.suspendEvent, suspend)
  Application.off(Application.resumeEvent, resume)
  configure({ reducedMotion: 'user' })
  audit('disposed')
})
</script>

<template>
  <GridLayout
    rows="auto,*,auto,auto"
    backgroundColor="#EFE4D0"
    borderRadius="28"
    padding="20"
    automationText="gravity-lab"
  >
    <GridLayout columns="*,auto">
      <Label
        :text="t('THE FALLING CLUB')"
        color="#6D4936"
        fontSize="11"
        letterSpacing="0.18"
        fontWeight="bold"
      />
      <Label col="1" text="↓  01" color="#A8512D" fontSize="12" />
    </GridLayout>
    <GridLayout
      row="1"
      ref="world"
      minHeight="270"
      marginTop="12"
      @loaded="loaded"
      @layoutChanged="layout"
      @unloaded="suspend"
    >
      <Label
        text="○"
        color="#E3D6BD"
        fontSize="260"
        textAlignment="center"
        verticalAlignment="middle"
        marginTop="-40"
      />
      <Label
        :text="t('A LITTLE SPACE TO FALL.')"
        color="#AB9576"
        fontSize="9"
        letterSpacing="0.16"
        rotate="-90"
        horizontalAlignment="left"
        verticalAlignment="middle"
        marginLeft="-62"
      />
      <Label
        ref="shadow"
        width="104"
        height="14"
        borderRadius="7"
        backgroundColor="#67381F"
        verticalAlignment="bottom"
        marginBottom="27"
        opacity="0.08"
      />
      <Label
        height="1"
        backgroundColor="#C6AD8B"
        verticalAlignment="bottom"
        marginBottom="32"
      />
      <GridLayout
        ref="ball"
        width="100"
        height="100"
        borderRadius="50"
        backgroundImage="linear-gradient(145deg, #FFD69B, #D4773E, #A13F27)"
        verticalAlignment="top"
        marginTop="16"
        automationText="gravity-ball"
      >
        <Label
          width="78"
          height="78"
          borderRadius="39"
          borderWidth="1"
          borderColor="#F3BF80"
          opacity="0.55"
        />
        <Image
          src="~/assets/jolt-mark.png"
          width="38"
          height="44"
          tintColor="#6E301F"
          opacity="0.85"
          stretch="aspectFit"
        />
        <Label
          width="20"
          height="10"
          borderRadius="5"
          backgroundColor="#FFE2B0"
          opacity="0.65"
          verticalAlignment="top"
          horizontalAlignment="left"
          marginTop="15"
          marginLeft="23"
          rotate="-32"
        />
      </GridLayout>
      <GridLayout columns="*,auto" verticalAlignment="bottom" marginBottom="5">
        <Label
          :text="t('GROUND / 00')"
          color="#8D7253"
          fontSize="9"
          letterSpacing="0.12"
        />
        <Label
          col="1"
          text="JOLT · MOTION STUDIES"
          color="#8D7253"
          fontSize="9"
          letterSpacing="0.08"
        />
      </GridLayout>
    </GridLayout>
    <StackLayout row="2" marginTop="10">
      <Label
        :text="t(status)"
        textWrap="true"
        textAlignment="center"
        fontSize="16"
        color="#543C2D"
        height="44"
        verticalAlignment="middle"
      />
      <GridLayout columns="*,*,*" marginBottom="10">
        <Button
          v-for="(name, i) in names"
          :key="name"
          :col="i"
          :text="t(name)"
          :automationText="'gravity-mood-' + i"
          :backgroundColor="mood === i ? '#D3B993' : '#E8D9C1'"
          color="#634932"
          borderRadius="16"
          fontSize="11"
          height="38"
          margin="2"
          padding="0"
          androidElevation="0"
          androidDynamicElevationOffset="0"
          @tap="choose(i)"
        />
      </GridLayout>
      <GridLayout columns="*,*,*">
        <Button
          :text="t('Let it fall')"
          automationText="gravity-drop"
          backgroundColor="#553B2D"
          color="#FFF0D8"
          borderRadius="22"
          height="48"
          fontSize="13"
          margin="2"
          padding="0"
          androidElevation="0"
          androidDynamicElevationOffset="0"
          @tap="play(false)"
        />
        <Button
          col="1"
          :text="t('Toss up')"
          automationText="gravity-toss"
          backgroundColor="#E0C7A0"
          color="#553B2D"
          borderRadius="22"
          height="48"
          fontSize="13"
          margin="2"
          padding="0"
          androidElevation="0"
          androidDynamicElevationOffset="0"
          @tap="play(true)"
        />
        <Button
          col="2"
          :text="t(paused ? 'Resume' : 'Pause')"
          automationText="gravity-pause"
          backgroundColor="#E0C7A0"
          color="#553B2D"
          borderRadius="22"
          height="48"
          fontSize="13"
          margin="2"
          padding="0"
          androidElevation="0"
          androidDynamicElevationOffset="0"
          @tap="togglePause"
        />
      </GridLayout>
      <GridLayout columns="*,*" marginTop="6">
        <Button
          :text="t('Return to the top')"
          automationText="gravity-return"
          backgroundColor="transparent"
          color="#74563D"
          height="40"
          fontSize="12"
          padding="0"
          androidElevation="0"
          androidDynamicElevationOffset="0"
          @tap="returnUp"
        />
        <Button
          col="1"
          :text="t(reduced ? 'Restore motion' : 'Reduce motion')"
          automationText="gravity-reduce"
          backgroundColor="transparent"
          color="#74563D"
          height="40"
          fontSize="12"
          padding="0"
          androidElevation="0"
          androidDynamicElevationOffset="0"
          @tap="reduce"
        />
      </GridLayout>
    </StackLayout>
    <Button
      v-if="auditMode"
      row="3"
      text="Snapshot"
      automationText="gravity-snapshot"
      height="35"
      androidElevation="0"
      @tap="audit('snapshot')"
    />
  </GridLayout>
</template>
