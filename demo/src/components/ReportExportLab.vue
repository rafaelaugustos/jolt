<script setup lang="ts">
import {
  Application,
  File,
  knownFolders,
  type EventData,
  type View,
} from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { animate, configure, type Animation } from '../../../dist/index.js'
import { PlaybackReportWriter } from '../playback-report-writer'
import { launchArgument } from '../launch'

const pt = launchArgument('lang') === 'pt'
const t = (en: string, br: string) => (pt ? br : en)
const status = ref(
  t(
    'Export the same recorded audit in two ways.',
    'Exporte o mesmo relatório de duas formas.',
  ),
)
const result = ref('')
const busy = ref(false)
let view: View, animation: Animation | undefined, writer: PlaybackReportWriter | undefined
let probe: org.rafaelaugusto.jolt.fixture.BudgetProbe | undefined
let generation = 0
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const now = () => java.lang.System.nanoTime() / 1e6
const save = (value: object) =>
  knownFolders
    .externalDocuments()
    .getFile('jolt-report-export-demo.json')
    .writeTextSync(JSON.stringify(value))
function loaded(event: EventData) {
  view = event.object as View
  configure({ reducedMotion: 'never', timeScale: 1 })
}
function cancel() {
  generation++
  writer?.dispose()
  writer = undefined
  animation?.stop()
  animation = undefined
  probe?.cancel()
  probe = undefined
  busy.value = false
  status.value = t(
    'Cancelled. The worker is released.',
    'Cancelado. O worker foi liberado.',
  )
  save({ phase: 'cancelled' })
}
async function run(mode: 'main' | 'worker') {
  if (busy.value || !view?.isLoaded) return
  const folder = knownFolders.externalDocuments()
  if (!File.exists(folder.path + '/profile-input.json')) {
    status.value = t(
      'Load a recorded audit with the collector first.',
      'Carregue um relatório com o coletor primeiro.',
    )
    return
  }
  const token = ++generation
  const check = () => {
    if (generation !== token) throw Error('Cancelled')
  }
  busy.value = true
  result.value = ''
  let localWriter: PlaybackReportWriter | undefined
  let worker: object | undefined
  try {
    if (mode === 'worker') {
      status.value = t('Starting the worker…', 'Iniciando o worker…')
      writer = localWriter = new PlaybackReportWriter()
      worker = await localWriter.ready
      check()
    }
    view.translateX = 0
    animation = animate(
      view,
      { x: [0, 200, 0] },
      { duration: 2000, ease: 'linear', repeat: Infinity },
    )
    probe = new org.rafaelaugusto.jolt.fixture.BudgetProbe(view.android)
    status.value =
      mode === 'main'
        ? t(
            'UI thread · 20 full report exports',
            'Thread da UI · 20 exportações completas',
          )
        : t('Worker · 20 full report exports', 'Worker · 20 exportações completas')
    await wait(500)
    check()
    const start = now(),
      cpuStart = android.os.Debug.threadCpuTimeNanos()
    const before = (view.android as android.view.View).getTranslationX()
    const input =
      mode === 'main'
        ? JSON.parse(folder.getFile('profile-input.json').readTextSync())
        : undefined
    let characters = 0
    for (let i = 0; i < 20; i++) {
      check()
      if (localWriter) characters = (await localWriter.replay()).characters ?? 0
      else {
        const text = JSON.stringify(input, null, 2)
        folder.getFile('profile-output.json').writeTextSync(text)
        characters = text.length
      }
    }
    const end = now(),
      mainCpuMs = (android.os.Debug.threadCpuTimeNanos() - cpuStart) / 1e6
    const after = (view.android as android.view.View).getTranslationX()
    await wait(500)
    check()
    const frames = JSON.parse(probe.finish()).frames as number[][]
    probe = undefined
    let maxGapMs = 0
    for (let i = 1; i < frames.length; i++)
      if (frames[i]![0]! >= start && frames[i - 1]![0]! <= end)
        maxGapMs = Math.max(maxGapMs, frames[i]![0]! - frames[i - 1]![0]!)
    result.value = `${mainCpuMs.toFixed(1)} ms UI CPU · ${maxGapMs.toFixed(1)} ms ${t('max callback gap', 'maior intervalo')}`
    status.value = t(
      'Export complete. Same report, original timing.',
      'Exportação concluída. Mesmo relatório, tempo original.',
    )
    save({
      phase: 'done',
      mode,
      exports: 20,
      characters,
      mainCpuMs,
      maxGapMs,
      worker,
      mainThreadId: android.os.Process.myTid(),
      start,
      end,
      nativeMovementPx: after - before,
    })
  } catch (error) {
    if (generation === token) {
      status.value = String(error)
      save({ phase: 'error', error: String(error) })
    }
  } finally {
    localWriter?.dispose()
    if (generation === token) {
      writer = undefined
      animation?.stop()
      animation = undefined
      probe?.cancel()
      probe = undefined
      busy.value = false
    }
  }
}
Application.on(Application.suspendEvent, cancel)
onUnmounted(() => {
  cancel()
  Application.off(Application.suspendEvent, cancel)
})
</script>

<template>
  <StackLayout padding="24" backgroundColor="#18181b">
    <Label
      :text="t('ANDROID · REPORT EXPORT', 'ANDROID · EXPORTAÇÃO')"
      color="#a3e635"
      fontSize="11"
      marginTop="24"
    />
    <Label
      :text="t('Keep the UI available.', 'Mantenha a UI disponível.')"
      color="white"
      fontSize="28"
      fontWeight="bold"
      textWrap="true"
      marginTop="12"
    />
    <Label
      :text="
        t(
          'The same data. The same native motion.',
          'Os mesmos dados. O mesmo movimento nativo.',
        )
      "
      color="#a1a1aa"
      fontSize="15"
      textWrap="true"
      marginTop="12"
    />
    <GridLayout height="140" backgroundColor="#27272a" borderRadius="16" marginTop="32">
      <Label
        text="J"
        width="46"
        height="46"
        horizontalAlignment="left"
        marginLeft="12"
        backgroundColor="#a3e635"
        color="#18181b"
        borderRadius="12"
        fontSize="24"
        fontWeight="bold"
        textAlignment="center"
        verticalAlignment="middle"
        @loaded="loaded"
      />
    </GridLayout>
    <Label
      :text="status"
      color="white"
      fontSize="16"
      textWrap="true"
      height="72"
      marginTop="24"
    />
    <Label :text="result" color="#a3e635" fontSize="13" textWrap="true" height="48" />
    <Button
      :text="t('Export on UI', 'Exportar na UI')"
      :isEnabled="!busy"
      height="52"
      @tap="run('main')"
    />
    <Button
      :text="t('Export in worker', 'Exportar no worker')"
      :isEnabled="!busy"
      height="52"
      @tap="run('worker')"
    />
    <Button :text="t('Cancel', 'Cancelar')" height="52" @tap="cancel" />
    <Label
      :text="
        t(
          'A batch of 20 exports makes the pause visible. Worker startup is shown before playback.',
          'Um lote de 20 exportações torna a pausa visível. O worker inicia antes da reprodução.',
        )
      "
      color="#71717a"
      fontSize="12"
      textWrap="true"
      marginTop="20"
    />
  </StackLayout>
</template>
