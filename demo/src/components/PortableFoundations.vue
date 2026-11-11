<script setup lang="ts">
import { Application, File, isIOS, knownFolders, type View } from '@nativescript/core'
import { ref, nextTick, onUnmounted, registerElement } from 'nativescript-vue'
import { bind, motionScope, set, type PlaybackAnimation } from '@rafaelaugusto/jolt'
import { drawBatch } from '@rafaelaugusto/jolt/shapes'
import { propertyGroup } from '@rafaelaugusto/jolt/native'
import { PortableReveal, portableReveal } from '../portable-reveal'
import { PortableScene } from '../portable-scene'
import { portableDots, portableStyles } from '../portable-recipe'
import { measurePortable } from '../portable-audit'
import { launchArgument } from '../launch'
registerElement('PortableReveal', () => PortableReveal)
registerElement('PortableScene', () => PortableScene)
const mode = launchArgument('portable-lab') || 'groups'
const root = ref(),
  mounted = ref(true),
  size = ref(290)
const status = ref('Ready'),
  taps = ref(0)
let scope = motionScope(),
  run = () => {},
  indicator = () => {},
  transform = () => {},
  measuring = false,
  disposed = false,
  playback: PlaybackAnimation | undefined
const events: object[] = []
const target = (id: string): View => root.value?.nativeView.getViewById(id)
function audit(name: string, detail: object = {}) {
  if (launchArgument('portable-audit') === undefined) return
  events.push({
    name,
    mode,
    time: Date.now(),
    suspended: Application.suspended,
    scope: scope.size,
    ...detail,
  })
  const directory = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null).getAbsolutePath()
  File.fromPath(directory + '/portable-foundations.json').writeTextSync(
    JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }, null, 2),
  )
}
function setup() {
  if (measuring || !target('portable-stage')?.isLoaded) return
  scope.dispose()
  scope = motionScope()
  const stage = target('portable-stage')
  if (
    launchArgument('portable-measure') !== undefined &&
    (mode === 'groups' || mode === 'drawing')
  ) {
    measuring = true
    const properties =
      mode === 'groups'
        ? [0, 1, 2].map((index) =>
            scope.resource(() =>
              portableReveal(target(`portable-bar-${index}`).nativeViewProtected),
            ),
          )
        : []
    void measurePortable(
      stage as import('@nativescript/core').GridLayout,
      launchArgument('portable-measure') === 'activity' ? 'activity' : mode,
      properties,
      (value) => {
        status.value = value
      },
      () => !disposed,
      mode === 'groups' ? [0, 1, 2].map((index) => target(`portable-bar-${index}`)) : [],
    ).catch((error) => {
      status.value = String(error)
    })
    return
  }
  const scene = target('portable-scene') as PortableScene | undefined
  const shader =
    scene?.properties().map((property) => scope.resource(() => property)) ?? []
  const activity = scope.renderActivity({
    change(active) {
      scene?.render(active)
      status.value = `Renderer demand: ${active ? 'active' : 'idle'}`
      audit('demand', { active })
    },
    redraw() {
      scene?.redraw()
    },
  })
  if (mode === 'drawing') {
    const items = portableDots()
    const drawing = scope.resource(() =>
      drawBatch(stage, { viewBox: [0, 0, 760, 300], styles: portableStyles, items }),
    )
    let phase = 0,
      showingIndicator = false
    indicator = () => {
      showingIndicator = !showingIndicator
      drawing.set({
        items: showingIndicator
          ? Array.from({ length: 10 }, (_, i) => ({
              id: `segment-${i}`,
              style: i < 7 ? 'signal' : 'dots',
              kind: 'rect' as const,
              x: 45 + i * 68,
              y: 100,
              width: 50,
              height: 100,
            }))
          : items,
      })
      status.value = showingIndicator
        ? 'Segmented progress indicator · same drawing owner'
        : 'Dense chart restored · same drawing owner'
    }
    run = () => {
      if (showingIndicator) indicator()
      phase++
      drawing.update(
        items
          .filter((_, i) => i % 7 === phase % 7)
          .map((item) => ({
            ...item,
            style: phase % 2 ? 'signal' : 'dots',
            ...(item.kind === 'circle' ? { radius: phase % 2 ? 8 : 4 } : {}),
          })),
      )
      playback = scope.animate(stage, { scale: [1, 0.94, 1] }, { duration: 1000 })
      status.value = `${drawing.snapshot().items} items · one native surface`
      audit('draw-update', drawing.snapshot())
    }
    status.value = '259 dots · ordered paths · shared styles'
    audit('drawing-ready', drawing.snapshot())
  } else if (mode === 'pointer') {
    const pointer = scope.pointerFollow(stage, { spring: false })
    scope.use(() =>
      bind(target('portable-dot'), {
        x: pointer.x.to([-1, 1], [-120, 120]),
        y: pointer.y.to([-1, 1], [-100, 100]),
      }),
    )
    for (const property of shader)
      scope.use(() => property.bind(pointer.x, (x) => (x + 1) / 2))
    let release: (() => void) | undefined
    scope.use(() =>
      pointer.presence.subscribe((value) => {
        if (value && !release) release = activity.hold()
        else if (!value) {
          release?.()
          release = undefined
        }
        audit('pointer', {
          available: pointer.available,
          active: pointer.active,
          x: pointer.x.get(),
          y: pointer.y.get(),
          presence: value,
        })
      }),
    )
    let lastSample = 0
    scope.use(() =>
      pointer.x.subscribe((x) => {
        if (Date.now() - lastSample < 250 || !pointer.active) return
        lastSample = Date.now()
        audit('pointer-move', { x, y: pointer.y.get(), presence: pointer.presence.get() })
      }),
    )
    scope.add(() => release?.())
    run = () => {
      size.value = size.value === 290 ? 250 : 290
      pointer.refresh()
      status.value = 'Input region resized · move and re-enter'
    }
    let transformed = false
    transform = () => {
      transformed = !transformed
      set(stage, transformed ? { rotate: 12, scale: 0.85 } : { rotate: 0, scale: 1 })
      pointer.refresh()
      status.value = transformed
        ? 'Region rotated 12° and scaled 0.85 · local coordinates'
        : 'Region untransformed'
      audit('pointer-transform', { transformed })
    }
    status.value = pointer.available
      ? 'Hover API ready · requires mouse or hovering pen'
      : 'Hover API unavailable'
    audit('pointer-ready', { available: pointer.available })
  } else {
    const properties = [0, 1, 2].map((index) =>
      scope.resource(() =>
        portableReveal(target(`portable-bar-${index}`).nativeViewProtected),
      ),
    )
    const group = scope.resource(() =>
      propertyGroup({ a: properties[0]!, b: properties[1]!, c: properties[2]! }),
    )
    const uniforms = shader.length
      ? scope.resource(() =>
          propertyGroup({ a: shader[0]!, b: shader[1]!, c: shader[2]! }),
        )
      : undefined
    let phase = false
    run = () => {
      phase = !phase
      const values = phase ? { a: 0.8, b: 0.4, c: 1 } : { a: 0.25, b: 1, c: 0.5 }
      const start = performance.now()
      playback = group.animate(values, { duration: 1800, ease: 'linear' })
      activity.track(playback)
      if (uniforms)
        activity.track(uniforms.animate(values, { duration: 1800, ease: 'linear' }))
      audit('group-start', { setupMs: performance.now() - start })
      void playback.finished.then((completed) =>
        audit('group-end', {
          completed,
          values: group.disposed ? undefined : group.get(),
        }),
      )
    }
    group.set({ a: 0.1, b: 0.1, c: 0.1 })
    status.value = 'Three compiled properties · one playback clock'
  }
  audit('setup')
}
async function remount() {
  scope.dispose()
  mounted.value = false
  await nextTick()
  mounted.value = true
}
function pause() {
  scope.suspend()
  status.value = 'Scope paused'
  audit('pause')
}
function resume() {
  scope.resume()
  status.value = 'Scope resumed'
  audit('resume')
}
function injectMouse() {
  if (isIOS) return
  status.value = 'Injected mouse events · physical Android'
  try {
    org.rafaelaugusto.jolt.fixture.PointerReplay.play(
      Application.android.foregroundActivity,
      target('portable-stage').nativeViewProtected,
    )
    audit('injected-mouse-start')
  } catch (error) {
    status.value = String(error)
    audit('input-error', { error: String(error) })
  }
}
function tap() {
  taps.value++
  audit('tap', { taps: taps.value })
}
onUnmounted(() => {
  disposed = true
  scope.dispose()
})
</script>
<template>
  <ScrollView backgroundColor="#0C1424">
    <StackLayout ref="root" padding="24" color="#E8F0FF">
      <Label
        :text="
          mode === 'groups'
            ? 'Properties together'
            : mode === 'drawing'
              ? 'A single drawing surface'
              : 'Native pointer input'
        "
        fontSize="27"
        fontWeight="bold"
        marginTop="35"
        textWrap="true"
      />
      <Label
        :text="
          mode === 'groups'
            ? 'Shared start, pause and cancellation.'
            : mode === 'drawing'
              ? 'Stable items, shared styles, bounded geometry.'
              : 'Position and presence without stealing taps.'
        "
        marginTop="10"
        textWrap="true"
      />
      <StackLayout v-if="mounted" @loaded="setup">
        <GridLayout
          id="portable-stage"
          automationText="foundation-region"
          :height="size"
          :width="mode === 'pointer' ? size : 'auto'"
          marginTop="22"
          backgroundColor="#16273C"
          borderRadius="12"
        >
          <StackLayout v-if="mode === 'groups'" padding="18">
            <PortableReveal
              id="portable-bar-0"
              height="58"
              marginBottom="18"
              backgroundColor="#24374E"
            />
            <PortableReveal
              id="portable-bar-1"
              height="58"
              marginBottom="18"
              backgroundColor="#24374E"
            />
            <PortableReveal id="portable-bar-2" height="58" backgroundColor="#24374E" />
          </StackLayout>
          <GridLayout
            v-if="mode === 'pointer'"
            id="portable-dot"
            :isUserInteractionEnabled="false"
            width="30"
            height="30"
            borderRadius="15"
            backgroundColor="#63E3C2"
          />
        </GridLayout>
        <PortableScene
          v-if="isIOS && mode !== 'drawing'"
          id="portable-scene"
          height="150"
          marginTop="12"
        />
      </StackLayout>
      <Button
        v-if="mode === 'drawing'"
        text="Chart / indicator"
        automationText="foundation-indicator"
        @tap="indicator"
      />
      <Button
        v-if="mode === 'pointer' && !isIOS"
        text="Injected mouse test"
        automationText="foundation-inject"
        @tap="injectMouse"
      />
      <Button
        v-if="mode === 'pointer'"
        text="Rotate and scale region"
        automationText="foundation-transform"
        @tap="transform"
      />
      <Button
        v-if="mode === 'pointer'"
        :text="'Tap actions: ' + taps"
        automationText="foundation-tap"
        @tap="tap"
      />
      <Label
        v-if="isIOS && mode !== 'drawing'"
        text="Three SceneKit shader uniforms"
        fontSize="13"
        color="#9FB3CD"
      />
      <Label
        :text="status"
        automationText="foundation-status"
        marginTop="16"
        textWrap="true"
      />
      <GridLayout columns="*,*,*" marginTop="14">
        <Button
          :text="mode === 'pointer' ? 'Resize' : 'Run'"
          automationText="foundation-run"
          @tap="run"
        />
        <Button col="1" text="Pause" automationText="foundation-pause" @tap="pause" />
        <Button col="2" text="Resume" automationText="foundation-resume" @tap="resume" />
      </GridLayout>
      <Button text="Remount" automationText="foundation-remount" @tap="remount" />
    </StackLayout>
  </ScrollView>
</template>

<style scoped>
Button {
  background-color: #263a57;
  color: #ecf4ff;
  border-radius: 8;
  font-size: 15;
  margin: 4;
}
</style>
