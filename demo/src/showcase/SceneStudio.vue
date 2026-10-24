<script setup lang="ts">
import { palette } from './theme'
import { usePreviewI18n } from './i18n'
import { Application, Color, isIOS, type EventData } from '@nativescript/core'
import { computed, onUnmounted, ref } from 'nativescript-vue'
import {
  animate,
  motionValue,
  motionScope,
  set,
  type PlaybackAnimation,
} from '@rafaelaugusto/jolt'
import {
  sceneKitFieldOfView,
  sceneKitEnvironmentIntensity,
  sceneKitMaterialDiffuse,
  sceneKitLightIntensity,
  sceneKitUniform,
  type NativeProperty,
} from '@rafaelaugusto/jolt/native'
import { StudioScene, studioEnvironment } from './studio-scene'
const { t } = usePreviewI18n()
const props = defineProps<{ mode: string }>()
const lensMode = computed(() => props.mode === 'scene-camera')
const lightMode = computed(() => props.mode === 'scene-lighting')
const selected = ref('Portrait'),
  finish = ref('Silver'),
  paused = ref(false),
  active = ref(false),
  ready = ref(false)
const caption = ref('A change of perspective.')
const angle = ref(48)
const source = motionValue(0)
let scope = motionScope(),
  target: StudioScene | undefined
let lens: NativeProperty<number>,
  paint: ReturnType<typeof sceneKitMaterialDiffuse>,
  light: NativeProperty<number>
let play: PlaybackAnimation | undefined
const properties: { dispose(): void }[] = []
const own = <T extends { dispose(): void }>(p: T) => {
  properties.push(p)
  return p
}
const stops = computed(() =>
  lensMode.value
    ? ['Wide', 'Portrait', 'Detail']
    : lightMode.value
      ? ['Daylight', 'Golden hour', 'Midnight']
      : ['Studio', 'Cabin', 'After dark'],
)
function release() {
  scope.dispose()
  properties.splice(0).forEach((p) => p.dispose())
  ready.value = false
  active.value = false
  target = undefined
  play = undefined
}
function loaded(event: EventData) {
  if (!isIOS || target === event.object) return
  target = event.object as StudioScene
  scope = motionScope()
  lens = own(sceneKitFieldOfView(target.camera.camera!))
  paint = own(sceneKitMaterialDiffuse(target.paint))
  light = own(sceneKitLightIntensity(target.keyLight))
  if (!lensMode.value) {
    const env = own(sceneKitEnvironmentIntensity(target.scene))
    const cabin = own(
      sceneKitUniform(target.glass, 'cabinView', {
        type: 'float',
        range: [0, 1],
        units: ['blend'],
        motion: 'appearance',
      }),
    )
    const tint = own(
      sceneKitUniform(target.signal, 'signalTint', {
        type: 'float3',
        range: [0, 1],
        units: ['linear red', 'linear green', 'linear blue'],
        motion: 'appearance',
      }),
    )
    scope.use(() => env.bind(source, (p) => 1.1 - p * 0.87))
    scope.use(() => light.bind(source, (p) => 850 - p * 680))
    scope.use(() => cabin.bind(source, (p) => p * 0.7))
    scope.use(() =>
      tint.bind(source, (p) => [0.65 + p * 0.35, 0.85 - p * 0.4, 1 - p * 0.85]),
    )
    selected.value = stops.value[0]!
  }
  ready.value = true
  caption.value = lensMode.value
    ? 'Same position. A different point of view.'
    : 'Pick a mood. Watch the whole scene respond.'
}
function choose(index: number) {
  if (!ready.value) return
  scope.resume()
  paused.value = false
  selected.value = stops.value[index]!
  if (lensMode.value) {
    angle.value = [70, 48, 32][index]!
    play = scope.add(lens.animate(angle.value, { duration: 2400, ease: 'sineInOut' }))
    caption.value = [
      'Give the scene room to breathe.',
      'A balanced view, made for the whole story.',
      'Get closer. Notice the details.',
    ][index]!
  } else {
    target!.scene.lightingEnvironment.contents = studioEnvironment(index === 1)
    play = scope.add(
      animate(source, [0, 0.45, 1][index]!, { duration: 2200, ease: 'sineInOut' }),
    )
    caption.value = [
      'Clean reflections. Crisp details.',
      'A warmer light. A softer feeling.',
      'Less light. More atmosphere.',
    ][index]!
  }
  active.value = true
  const started = play!
  void started.finished.then(() => {
    if (play === started) active.value = false
  })
}
function color(name: string, hex: string) {
  if (ready.value) {
    finish.value = name
    scope.add(paint.animate(new Color(hex), { duration: 1000 }))
  }
}
function pause() {
  paused.value = !paused.value
  if (paused.value) scope.suspend()
  else {
    scope.resume()
    // Seeking pauses this handle directly, outside the scope's suspension state.
    if (play?.paused) play.play()
  }
}
function halfway() {
  if (play && active.value) {
    scope.resume()
    play.pause()
    play.progress = 0.5
    paused.value = true
    caption.value = 'Hold that thought. Halfway through the transition.'
  }
}
function suspend() {
  if (ready.value) {
    scope.suspend()
    paused.value = true
  }
}
function unloaded() {
  if (!Application.suspended) release()
}
Application.on(Application.suspendEvent, suspend)
onUnmounted(() => {
  Application.off(Application.suspendEvent, suspend)
  release()
  set(source, 0)
})
</script>
<template>
  <GridLayout rows="*,auto" :backgroundColor="palette.background">
    <GridLayout row="0" minHeight="260">
      <StudioScene @loaded="loaded" @unloaded="unloaded" />
      <GridLayout
        columns="*,auto"
        verticalAlignment="top"
        margin="12 24"
        isUserInteractionEnabled="false"
      >
        <Label
          :text="t('JOLT / ATELIER')"
          color="#748493"
          fontSize="9"
          letterSpacing=".16"
        />
        <Label
          col="1"
          :text="
            t(lensMode ? `${angle}° / ${selected.toUpperCase()}` : selected.toUpperCase())
          "
          color="#DCECAD"
          fontSize="10"
          letterSpacing=".08"
        />
      </GridLayout>
      <Label
        :text="t(caption)"
        color="#95A3AE"
        fontSize="12"
        textWrap="true"
        textAlignment="center"
        margin="24"
        verticalAlignment="bottom"
        isUserInteractionEnabled="false"
      />
    </GridLayout>
    <StackLayout row="1" class="atelier-panel">
      <GridLayout columns="*,auto" marginBottom="16"
        ><Label
          :text="t(lensMode ? 'Choose your lens' : 'Set the atmosphere')"
          :color="palette.text"
          fontSize="20"
          fontWeight="bold" /><Label
          col="1"
          text="01 — 03"
          :color="palette.subtle"
          fontSize="9"
          verticalAlignment="middle"
      /></GridLayout>
      <GridLayout columns="*,8,*,8,*">
        <StackLayout
          v-for="(stop, index) in stops"
          :key="stop"
          :col="index * 2"
          :class="selected === stop ? 'atelier-stop selected' : 'atelier-stop'"
          @tap="choose(index)"
          accessibilityRole="button"
          :accessibilityLabel="t(`Select ${stop}`)"
        >
          <Label
            :text="t(lensMode ? ['70°', '48°', '32°'][index] : ['◐', '◒', '●'][index])"
            fontSize="24"
            marginBottom="5"
          />
          <Label :text="t(stop)" fontSize="11" />
        </StackLayout>
      </GridLayout>
      <GridLayout columns="*,auto,auto,auto" margin="20 0 16">
        <StackLayout
          ><Label
            :text="t('BODY FINISH')"
            fontSize="9"
            :color="palette.subtle"
            letterSpacing=".1" /><Label
            :text="t(finish)"
            fontSize="13"
            :color="palette.text"
            marginTop="5"
        /></StackLayout>
        <Label
          col="1"
          class="atelier-swatch"
          backgroundColor="#CBD5DD"
          :borderColor="finish === 'Silver' ? '#E3FC62' : '#283440'"
          @tap="color('Silver', '#CBD5DD')"
          accessibilityRole="button"
          :accessibilityLabel="t('Silver finish')"
        />
        <Label
          col="2"
          class="atelier-swatch"
          backgroundColor="#516D60"
          :borderColor="finish === 'Sage' ? '#E3FC62' : '#283440'"
          @tap="color('Sage', '#516D60')"
          accessibilityRole="button"
          :accessibilityLabel="t('Sage finish')"
        />
        <Label
          col="3"
          class="atelier-swatch"
          backgroundColor="#9C5744"
          :borderColor="finish === 'Copper' ? '#E3FC62' : '#283440'"
          @tap="color('Copper', '#9C5744')"
          accessibilityRole="button"
          :accessibilityLabel="t('Copper finish')"
        />
      </GridLayout>
      <GridLayout columns="*,12,*">
        <Button
          :text="t(paused ? 'Resume motion' : 'Pause motion')"
          class="atelier-control"
          @tap="pause"
          :isEnabled="ready"
        />
        <Button
          col="2"
          :text="t('Hold halfway')"
          :isEnabled="active"
          :opacity="active ? 1 : 0.45"
          class="atelier-control"
          @tap="halfway"
        />
      </GridLayout>
    </StackLayout>
  </GridLayout>
</template>
<style scoped>
.atelier-panel {
  margin: 0 12 12;
  padding: 21 18 14;
  background-color: var(--studio-raised, #151e26);
  border-radius: 26;
  border-width: 1;
  border-color: var(--studio-border, #243039);
}
.atelier-stop {
  background-color: var(--studio-control, #1f2a32);
  color: var(--studio-control-text, #a6b3b9);
  padding: 12 8;
  border-radius: 16;
  text-align: center;
}
.atelier-stop.selected {
  background-color: #e3fc62;
  color: #202724;
}
.atelier-swatch {
  width: 32;
  height: 32;
  border-radius: 16;
  border-width: 3;
  margin-left: 10;
  vertical-align: middle;
}
.atelier-control {
  background-color: var(--studio-control, #25313a);
  color: var(--studio-control-text, #b8c9cb);
  border-radius: 12;
  font-size: 12;
  margin: 0;
  padding: 9 0;
  text-transform: none;
}
</style>
