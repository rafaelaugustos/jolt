<script setup lang="ts">
import { Application, isIOS, knownFolders, type EventData } from '@nativescript/core'
import { ref, onUnmounted, registerElement } from 'nativescript-vue'
import {
  animate,
  motionValue,
  motionScope,
  set,
  type PlaybackAnimation,
} from '@rafaelaugusto/jolt'
import { sceneKitEnvironmentIntensity, sceneKitUniform } from '@rafaelaugusto/jolt/native'
import { NativeShaderDemo, studioImage } from '../scene-shader'
import { checkSceneShader } from '../../../benchmarks/scene-shader'
import { launchArgument } from '../launch'
registerElement('NativeShaderDemo', () => NativeShaderDemo)
const emit = defineEmits<{ back: [] }>()
const visible = ref(true),
  checking = ref(false),
  status = ref('A bright studio. A quieter cabin.')
const source = motionValue(0)
let target: NativeShaderDemo | undefined,
  scope = motionScope(),
  run: PlaybackAnimation | undefined,
  warm = false
const resources: { dispose(): void }[] = []
const own = <T extends { dispose(): void }>(p: T) => {
  resources.push(p)
  return p
}
function release() {
  scope.dispose()
  resources.splice(0).forEach((p) => p.dispose())
  run = undefined
}
function loaded(event: EventData) {
  if (!isIOS) return
  // NativeScript emits loaded again on foregrounding the same view.
  if (target === event.object) return
  status.value = 'Preparing studio.'
  try {
    target = event.object as NativeShaderDemo
    scope = motionScope()
    const environment = own(sceneKitEnvironmentIntensity(target.scene))
    const cabin = own(
      sceneKitUniform(target.glass, 'cabinView', {
        type: 'float',
        range: [0, 1],
        units: ['blend fraction'],
        motion: 'appearance',
      }),
    )
    const signal = own(
      sceneKitUniform(target.charge, 'signalTint', {
        type: 'float3',
        range: [0, 1],
        units: ['linear red', 'linear green', 'linear blue'],
        motion: 'appearance',
      }),
    )
    scope.use(() => environment.bind(source, (p) => 1.6 - 1.15 * p))
    scope.use(() => cabin.bind(source, (p) => p))
    scope.use(() =>
      signal.bind(source, (p) => [0.12 + 0.88 * p, 0.75 - 0.3 * p, 1 - 0.85 * p]),
    )
    if (launchArgument('shader-checks') !== undefined)
      setTimeout(() => void checks(), 300)
  } catch (error) {
    status.value = String(error)
    console.log('JOLT_SHADER_SETUP_ERROR', String(error))
    release()
  }
}
function transition(value: number) {
  if (!target || checking.value) return
  scope.resume()
  run = scope.add(animate(source, value, { duration: 2600, ease: 'sineInOut' }))
  status.value = value ? 'Settling into the cabin.' : 'Back to the bright studio.'
}
function pause() {
  scope.suspend()
  status.value = 'Paused.'
}
function resume() {
  scope.resume()
  status.value = 'Continuing.'
}
function seek() {
  if (run) {
    run.progress = 0.5
    status.value = 'Halfway between studio and cabin.'
  }
}
function swap() {
  if (target) {
    warm = !warm
    target.scene.lightingEnvironment.contents = studioImage(warm)
    status.value = warm ? 'Warm studio environment.' : 'Cool studio environment.'
  }
}
function toggle() {
  release()
  if (isIOS) {
    const clean =
      JoltSceneShaderProperties.sinkCount() === 0 &&
      JoltPropertyPlayer.activeCount() === 0
    knownFolders
      .documents()
      .getFile('jolt-shader-navigation.json')
      .writeTextSync(
        JSON.stringify({
          passed: clean,
          sinks: JoltSceneShaderProperties.sinkCount(),
          players: JoltPropertyPlayer.activeCount(),
        }),
      )
    if (!clean) throw new Error('Scene teardown leaked native work')
  }
  target = undefined
  set(source, 0)
  visible.value = !visible.value
  status.value = visible.value ? 'Scene recreated.' : 'Scene disposed.'
}
function unloaded() {
  if (!Application.suspended) {
    release()
    target = undefined
  }
}
async function checks() {
  if (!target || checking.value) return
  checking.value = true
  release()
  const scene = target
  await checkSceneShader(
    scene,
    (message) => (status.value = message),
    launchArgument('shader-checks') ?? 'all',
  )
  checking.value = false
}
onUnmounted(release)
</script>
<template>
  <StackLayout backgroundColor="#111e2d" padding="16" minHeight="780">
    <GridLayout columns="auto,*" marginBottom="16"
      ><Button text="Back" @tap="emit('back')" /><Label
        col="1"
        text="Studio / cabin"
        color="white"
        fontSize="23"
        fontWeight="bold"
        verticalAlignment="middle"
        marginLeft="12"
    /></GridLayout>
    <Label
      text="ONE SCENE, A DIFFERENT MOOD"
      color="#9AB6CA"
      fontSize="11"
      letterSpacing=".12"
      marginBottom="12"
    />
    <NativeShaderDemo
      v-if="visible &amp;&amp; isIOS"
      height="340"
      borderRadius="20"
      @loaded="loaded"
      @unloaded="unloaded"
    />
    <Label
      v-else
      :text="isIOS ? 'Scene is resting.' : 'SceneKit adapters are available on iOS.'"
      height="340"
      color="white"
      verticalAlignment="middle"
      textAlignment="center"
    />
    <Label :text="status" color="#D9E7F0" fontSize="15" textWrap="true" margin="18 0" />
    <GridLayout columns="*,*"
      ><Button text="Enter cabin" @tap="transition(1)" /><Button
        col="1"
        text="Studio light"
        @tap="transition(0)"
    /></GridLayout>
    <GridLayout columns="*,*,*"
      ><Button text="Pause scene" @tap="pause" /><Button
        col="1"
        text="Resume scene"
        @tap="resume" /><Button col="2" text="Seek 50%" @tap="seek"
    /></GridLayout>
    <Button text="Swap environment" @tap="swap" />
    <Button :text="visible ? 'Leave scene' : 'Enter scene'" @tap="toggle" />
    <Button text="Check uniforms" :isEnabled="!checking" @tap="checks" />
  </StackLayout>
</template>

<style scoped>
Button {
  color: #d9e7f0;
  background-color: #21354b;
  border-radius: 10;
  margin: 3;
  font-size: 13;
}
</style>
