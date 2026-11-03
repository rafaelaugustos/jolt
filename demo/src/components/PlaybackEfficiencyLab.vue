<script setup lang="ts">
import { Application, isAndroid, type EventData, type View } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { animate, configure, type PlaybackAnimation } from '../../../dist/index.js'
import { getDriver, setDriver } from '../../../dist/driver/index.js'
import {
  legacyNumericDriver,
  runPlaybackEfficiency,
} from '../../../benchmarks/android-playback-efficiency'
import { launchArgument } from '../launch'
import { installResourceProfile } from '../../../benchmarks/android-resource-profile'
import { PlaybackReportWriter } from '../playback-report-writer'

const pt = launchArgument('lang') === 'pt'
const text = (en: string, br: string) => (pt ? br : en)
const status = ref(
  text(
    'The same motion, with less native bookkeeping.',
    'O mesmo movimento, com menos trabalho nativo.',
  ),
)
const busy = ref(false)
let original: View, compact: View
let animations: PlaybackAnimation[] = []
const base = getDriver()
const signal = { aborted: false }
let timer: ReturnType<typeof setTimeout> | undefined
let disposeProfile: (() => void) | undefined
let reportWriter: PlaybackReportWriter | undefined
function loaded(event: EventData, lane: number) {
  if (lane === 0) original = event.object as View
  else compact = event.object as View
  if (!original || !compact || !isAndroid) return
  configure({ reducedMotion: 'never', timeScale: 1 })
  setDriver(legacyNumericDriver([original], base))
  if (launchArgument('resource-profile') !== undefined && !disposeProfile)
    timer = setTimeout(() => {
      if (!signal.aborted) disposeProfile = installResourceProfile(compact, signal)
    }, 500)
  if (launchArgument('efficiency-checks') !== undefined)
    timer = setTimeout(() => void audit(), 500)
}
function stop() {
  animations.forEach((animation) => animation.stop())
  animations = []
}
function play(target = 210) {
  if (!original || !compact || busy.value) return
  if (target === 210) {
    stop()
    original.translateX = compact.translateX = 0
  }
  animations = [original, compact].map((view) =>
    animate(
      view,
      { x: target },
      {
        type: 'spring',
        duration: 1600,
        bounce: 0.3,
      },
    ),
  )
  status.value =
    target === 210
      ? text('Both lanes follow the same spring.', 'As duas linhas seguem a mesma mola.')
      : text(
          'Interrupted: both return from their current position.',
          'Interrompidas: as duas voltam da posição atual.',
        )
}
function pause() {
  animations.forEach((animation) => animation.pause())
  status.value = text('Paused. The position stays put.', 'Pausado. A posição se mantém.')
}
function resume() {
  animations.forEach((animation) => animation.play())
  status.value = text('Resuming from the held position.', 'Retomando da posição pausada.')
}
function seek() {
  animations.forEach((animation) => {
    animation.pause()
    animation.progress = 0.7
  })
  status.value = text(
    'Held at 70%. Resume or interrupt.',
    'Pausado em 70%. Retome ou interrompa.',
  )
}
async function audit() {
  if (busy.value || !isAndroid) return
  stop()
  busy.value = true
  status.value = text(
    'Measuring on this Android device…',
    'Medindo neste dispositivo Android…',
  )
  try {
    reportWriter = new PlaybackReportWriter()
    const writer = reportWriter
    const ready = await writer.ready
    await runPlaybackEfficiency(compact, (event) => writer.send(event), signal, {
      ...ready,
      mainThreadId: android.os.Process.myTid(),
      mode: 'incremental-worker; parsing and file writes outside playback windows',
    })
    status.value = text(
      'Checks passed. Report saved.',
      'Verificações passaram. Relatório salvo.',
    )
  } catch (error) {
    status.value = String(error)
  } finally {
    reportWriter?.dispose()
    reportWriter = undefined
    busy.value = false
    if (!signal.aborted) setDriver(legacyNumericDriver([original], base))
  }
}
const suspend = () => {
  signal.aborted = true
  reportWriter?.dispose()
  stop()
}
Application.on(Application.suspendEvent, suspend)
onUnmounted(() => {
  signal.aborted = true
  disposeProfile?.()
  reportWriter?.dispose()
  clearTimeout(timer)
  stop()
  setDriver(base)
  Application.off(Application.suspendEvent, suspend)
})
</script>

<template>
  <StackLayout padding="24" backgroundColor="#18181b">
    <Label
      :text="text('ANDROID · NATIVE PLAYBACK', 'ANDROID · REPRODUÇÃO NATIVA')"
      color="#a3e635"
      fontSize="11"
      marginTop="18"
    />
    <Label
      :text="text('Keep the motion.', 'Preserve o movimento.')"
      color="white"
      fontSize="28"
      fontWeight="bold"
      marginTop="12"
      textWrap="true"
    />
    <Label
      :text="text('Same curve. Same controls.', 'Mesma curva. Mesmos controles.')"
      color="#a1a1aa"
      fontSize="16"
      marginTop="8"
      marginBottom="28"
    />
    <Label
      :text="text('Original keyframes', 'Keyframes originais')"
      color="#d4d4d8"
      fontSize="13"
    />
    <GridLayout
      height="112"
      backgroundColor="#27272a"
      marginTop="8"
      marginBottom="24"
      borderRadius="12"
    >
      <GridLayout
        width="46"
        height="46"
        horizontalAlignment="left"
        marginLeft="12"
        backgroundColor="#a78bfa"
        borderRadius="12"
        @loaded="loaded($event, 0)"
      >
        <Label
          text="A"
          color="#18181b"
          fontSize="23"
          fontWeight="bold"
          textAlignment="center"
          verticalAlignment="middle"
        />
      </GridLayout>
    </GridLayout>
    <Label
      :text="text('Jolt · compact playback', 'Jolt · reprodução compacta')"
      color="#d4d4d8"
      fontSize="13"
    />
    <GridLayout
      height="112"
      backgroundColor="#27272a"
      marginTop="8"
      marginBottom="24"
      borderRadius="12"
    >
      <GridLayout
        width="46"
        height="46"
        horizontalAlignment="left"
        marginLeft="12"
        backgroundColor="#a3e635"
        borderRadius="12"
        @loaded="loaded($event, 1)"
      >
        <Label
          text="B"
          color="#18181b"
          fontSize="23"
          fontWeight="bold"
          textAlignment="center"
          verticalAlignment="middle"
        />
      </GridLayout>
    </GridLayout>
    <GridLayout columns="*,*,*" rows="auto" height="52">
      <Button :text="text('Play', 'Reproduzir')" :isEnabled="!busy" @tap="play()" />
      <Button col="1" :text="text('Pause', 'Pausar')" :isEnabled="!busy" @tap="pause" />
      <Button
        col="2"
        :text="text('Resume', 'Retomar')"
        :isEnabled="!busy"
        @tap="resume"
      />
    </GridLayout>
    <GridLayout columns="*,*,*" rows="auto" height="52">
      <Button text="70%" :isEnabled="!busy" @tap="seek" />
      <Button
        col="1"
        :text="text('Interrupt', 'Interromper')"
        :isEnabled="!busy"
        @tap="play(0)"
      />
      <Button col="2" :text="text('Stop', 'Parar')" :isEnabled="!busy" @tap="stop" />
    </GridLayout>
    <Label :text="status" color="#d4d4d8" textWrap="true" marginTop="20" fontSize="14" />
    <Label
      :text="
        text(
          'Android UI-thread playback. Heavy app work still belongs in a worker.',
          'Reprodução na thread da UI. Trabalho pesado do app ainda deve ir para um worker.',
        )
      "
      color="#a1a1aa"
      textWrap="true"
      marginTop="16"
      fontSize="12"
    />
  </StackLayout>
</template>
