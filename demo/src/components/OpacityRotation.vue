<script lang="ts" setup>
import { Device, isIOS, knownFolders, type View } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { animate, configure, set, stop, type Animation } from '@rafaelaugusto/jolt'
import { launchArgument } from '../launch'

const svg = (size: number, strength: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><defs><radialGradient id="glow"><stop offset="0" stop-color="#fff6df" stop-opacity="${strength}"/><stop offset=".28" stop-color="#ffb547" stop-opacity="${strength * 0.95}"/><stop offset="1" stop-color="#ff6200" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="50" fill="url(#glow)"/></svg>`
const headSVG = svg(30, 1)
const haloSVG = svg(228, 0.55)
const flashSVG = svg(48, 1)
const useSVG = ref(launchArgument('ghost-content') !== 'plain')
const childFade = ref(launchArgument('ghost-fade') === 'child')
const slow = ref(false)
const pattern = launchArgument('ghost-pattern') === 'fade' ? 'fade' : 'pulse'
const status = ref('Ready')
const orbits: View[] = []
const heads: View[] = []
const halo = ref()
const flash = ref()
const handles: Animation[] = []
const observations: unknown[] = []
const emberSizes = [30, 7, 5.5, 4]
type NativeElement = { nativeView: View }
function remember(element: NativeElement | null, index: number, target: View[]) {
  if (element) target[index] = element.nativeView
}
function reset() {
  handles.splice(0).forEach((handle) => handle.stop())
  for (const target of [...orbits, ...heads]) {
    stop(target)
    set(target, { rotate: 0, opacity: 1 })
  }
  stop(halo.value)
  stop(flash.value)
  set(halo.value, { opacity: 0 })
  set(flash.value, { opacity: 0, scale: 0.4 })
  status.value = 'Stopped'
}
function play(splash = false) {
  reset()
  configure({ timeScale: slow.value ? 0.2 : 1 })
  for (let i = 0; i < orbits.length; i++) {
    const rotate = splash ? [115, -90] : [0, 360]
    const opacity = splash
      ? [0, 1, 1, i ? 0 : 1]
      : pattern === 'fade'
        ? [0, 1]
        : [0, 1, 0.35, 1]
    const rotation = {
      duration: splash ? 480 : 1600,
      ease: splash ? ('cubicInOut' as const) : ('linear' as const),
      repeat: splash ? 0 : Infinity,
    }
    const fade = {
      duration: splash ? 480 : 960,
      ease: 'linear' as const,
      repeat: splash || pattern === 'fade' ? 0 : Infinity,
      times: splash ? [0, 0.08, 0.85, 1] : undefined,
    }
    const delay = i * 26
    if (childFade.value) {
      handles.push(animate(orbits[i], { rotate }, { ...rotation, delay }))
      handles.push(animate(heads[i], { opacity }, { ...fade, delay }))
    } else {
      // One call covers the original same-layer combination, with independent clocks.
      handles.push(
        animate(orbits[i], { rotate, opacity }, { ...rotation, delay, opacity: fade }),
      )
    }
  }
  handles.push(
    animate(
      halo.value,
      { opacity: [0, 0.7, 0.3] },
      { duration: splash ? 480 : 1600, repeat: splash ? 0 : Infinity },
    ),
  )
  handles.push(
    animate(
      flash.value,
      { opacity: [0, 1, 0], scale: [0.4, 2.6] },
      {
        duration: splash ? 340 : 480,
        delay: splash ? 480 : 0,
        repeat: splash ? 0 : Infinity,
        repeatDelay: splash ? 0 : 1120,
      },
    ),
  )
  status.value = `${splash ? 'Splash' : 'Playing'} at ${slow.value ? '0.2' : '1'}x`
  if (isIOS) {
    observations.push({
      svg: useSVG.value,
      childFade: childFade.value,
      pattern: splash ? 'splash' : pattern,
      timeScale: slow.value ? 0.2 : 1,
      layers: orbits.map((v) => ({
        clips: v.ios.clipsToBounds,
        rasterize: v.ios.layer.shouldRasterize,
        groupOpacity: v.ios.layer.allowsGroupOpacity,
        keys: String(v.ios.layer.animationKeys()),
      })),
    })
    knownFolders
      .documents()
      .getFile(
        `opacity-rotation-${splash ? 'splash' : slow.value ? 'slow' : pattern}.json`,
      )
      .writeTextSync(
        JSON.stringify(
          { os: Device.osVersion, model: Device.model, observations },
          null,
          2,
        ),
      )
  }
}
function toggleFade() {
  reset()
  childFade.value = !childFade.value
}
function toggleContent() {
  reset()
  useSVG.value = !useSVG.value
}
function toggleSpeed() {
  slow.value = !slow.value
  play()
}
onUnmounted(() => {
  reset()
  configure({ timeScale: 1 })
})
const props = defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout class="opacity-rotation" backgroundColor="#0d0404" padding="24">
    <Label
      v-if="!props.embedded"
      text="Opacity + rotation"
      color="#fff6df"
      fontSize="26"
      marginTop="16"
    />
    <Label
      :text="`${useSVG ? 'SVG' : 'Plain'} overflow · fade on ${childFade ? 'child' : 'container'}`"
      color="#ffb547"
      fontSize="15"
      marginTop="12"
    />
    <GridLayout height="320" marginTop="16" clipToBounds="false">
      <AbsoluteLayout width="168" height="160" clipToBounds="false">
        <SVGView
          v-if="useSVG"
          ref="halo"
          :src="haloSVG"
          left="-24.3"
          top="-41.2"
          width="228"
          height="228"
          opacity="0"
          stretch="aspectFit"
        />
        <ContentView
          v-else
          ref="halo"
          left="-24.3"
          top="-41.2"
          width="228"
          height="228"
          opacity="0"
          backgroundColor="#ff6200"
          borderRadius="114"
        />
        <Image
          :src="props.embedded ? '~/assets/jolt-mark.png' : '~/assets/ghost-marker.png'"
          left="44.7"
          top="27.8"
          width="90"
          height="90"
          stretch="fill"
        />
        <AbsoluteLayout
          v-for="(size, i) in emberSizes"
          :key="i"
          :ref="(el: NativeElement | null) => remember(el, i, orbits)"
          left="26.7"
          top="9.8"
          width="126"
          height="126"
          clipToBounds="false"
        >
          <SVGView
            v-if="useSVG"
            :ref="(el: NativeElement | null) => remember(el, i, heads)"
            :src="headSVG"
            :left="126 - size / 2"
            :top="63 - size / 2"
            :width="size"
            :height="size"
            stretch="aspectFit"
          />
          <ContentView
            v-else
            :ref="(el: NativeElement | null) => remember(el, i, heads)"
            :left="126 - size / 2"
            :top="63 - size / 2"
            :width="size"
            :height="size"
            backgroundColor="#ffb547"
            :borderRadius="size / 2"
          />
        </AbsoluteLayout>
        <SVGView
          v-if="useSVG"
          ref="flash"
          :src="flashSVG"
          left="65.7"
          top="-9.2"
          width="48"
          height="48"
          opacity="0"
          stretch="aspectFit"
        />
        <ContentView
          v-else
          ref="flash"
          left="65.7"
          top="-9.2"
          width="48"
          height="48"
          opacity="0"
          backgroundColor="#fff6df"
          borderRadius="24"
        />
      </AbsoluteLayout>
    </GridLayout>
    <Label :text="status" color="#fff6df" textAlignment="center" marginBottom="12" />
    <Button text="Play orbit" @tap="play()" />
    <Button text="Replay splash" @tap="play(true)" />
    <Button text="Stop orbit" @tap="reset" />
    <Button :text="childFade ? 'Fade container' : 'Fade child'" @tap="toggleFade" />
    <Button :text="useSVG ? 'Use plain views' : 'Use SVG views'" @tap="toggleContent" />
    <Button :text="slow ? 'Normal speed' : 'Slow motion'" @tap="toggleSpeed" />
  </StackLayout>
</template>

<style scoped>
.opacity-rotation Button {
  color: #fff6df;
  font-size: 16;
}
</style>
