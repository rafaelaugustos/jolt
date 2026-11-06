<script setup lang="ts">
import { Application, File, isIOS, knownFolders, type View } from '@nativescript/core'
import { ref, onUnmounted, nextTick } from 'nativescript-vue'
import { animate, motionScope, press, set } from '@rafaelaugusto/jolt'
import { shape, type Shape } from '@rafaelaugusto/jolt/shapes'
import { launchArgument } from '../launch'

const mode = launchArgument('portable-lab') || 'shape'
const root = ref()
const status = ref('Ready'),
  taps = ref(0),
  variant = ref('plain'),
  size = ref(220)
const mounted = ref(true)
let drawings: Shape[] = [],
  owner = motionScope(),
  releases: (() => void)[] = []
let generation = 0,
  probing = false
const events: object[] = []
const target = (id: string): View => root.value?.nativeView.getViewById(id)
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
function geometry() {
  const host = target('portable-shape')
  if (!host?.nativeViewProtected) return undefined
  if (!isIOS)
    return {
      actual: host.getActualSize(),
      width: host.android.getWidth(),
      height: host.android.getHeight(),
    }
  const view = host.ios as UIView
  let drawing: CALayer | undefined
  for (let i = 0; i < (view.layer.sublayers?.count ?? 0); i++) {
    const layer = view.layer.sublayers.objectAtIndex(i)
    if (layer.name === 'jolt:shape') drawing = layer
  }
  const rect = (r: CGRect) => [r.origin.x, r.origin.y, r.size.width, r.size.height]
  return {
    actual: host.getActualSize(),
    frame: rect(view.frame),
    bounds: rect(view.bounds),
    drawing: drawing && rect(drawing.frame),
  }
}
function audit(name: string, extra: object = {}) {
  if (launchArgument('portable-audit') === undefined) return
  events.push({
    name,
    time: Date.now(),
    mode,
    variant: variant.value,
    taps: taps.value,
    suspended: Application.suspended,
    generation,
    scope: owner.size,
    geometry: mode === 'shape' ? geometry() : undefined,
    ...extra,
  })
  const directory = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null).getAbsolutePath()
  File.fromPath(directory + '/portable-lab.json').writeTextSync(
    JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }, null, 2),
  )
}
function clear() {
  releases.splice(0).forEach((off) => off())
  owner.dispose()
  owner = motionScope()
  drawings.splice(0).forEach((drawing) => drawing.dispose())
}
function setup() {
  if (!target(mode === 'shape' ? 'portable-shape' : 'portable-button')?.isLoaded) return
  clear()
  generation++
  if (mode === 'shape') {
    const d = 'M110 12 L195 61 L195 159 L110 208 L25 159 L25 61 Z'
    for (const id of ['portable-shape', 'portable-reference']) {
      drawings.push(
        shape(target(id), {
          d,
          viewBox: [0, 0, 220, 220],
          fill: '#153E75',
          stroke: '#64D8CB',
          strokeWidth: 7,
        }),
      )
    }
  } else {
    const button = target('portable-button')
    if (variant.value === 'direct') releases.push(press(button))
    if (variant.value === 'scoped') owner.press(button)
    if (variant.value === 'repeated') {
      owner.press(button)
      owner.press(button)
    }
  }
  audit('setup')
  if (!probing && launchArgument('portable-probe') !== undefined && mode === 'shape') {
    probing = true
    void shapeProbe().catch((error) => {
      status.value = String(error)
      audit('error')
    })
  }
}
async function choose(value: string) {
  clear()
  variant.value = value
  taps.value = 0
  await nextTick()
  setup()
}
function action() {
  taps.value++
  status.value = `Action ${taps.value}`
  audit('tap')
}
async function transform(kind: string) {
  const frames =
    kind === 'scale'
      ? { scale: [1, 1.25, 1] }
      : kind === 'rotate'
        ? { rotate: [0, 35, 0] }
        : { scale: [1, 1.25, 1.1], rotate: [0, 35, 18] }
  status.value =
    kind === 'both' ? 'Scale + rotation' : kind === 'scale' ? 'Scale' : 'Rotation'
  for (const id of ['portable-shape', 'portable-reference-parent'])
    owner.animate(target(id), frames, { duration: 2400, ease: 'easeInOut' })
  audit('transform-start', { kind })
  await wait(1200)
  size.value = size.value === 220 ? 240 : 220
  await wait(1400)
  audit('transform-end', { kind })
}
async function shapeProbe() {
  await wait(400)
  audit('baseline')
  for (const values of [
    { scale: 1.25, rotate: 0 },
    { scale: 1, rotate: 35 },
    { scale: 1.25, rotate: 35 },
  ]) {
    const host = target('portable-shape')
    host.scaleX = host.scaleY = values.scale
    host.rotate = values.rotate
    size.value = size.value === 220 ? 240 : 220
    await nextTick()
    await wait(350)
    audit('transformed-layout', values)
  }
  const host = target('portable-shape')
  host.scaleX = host.scaleY = 1
  host.rotate = 0
  size.value = 220
  await wait(300)
  audit('probe-complete')
  status.value = 'Probe complete'
}
async function remount() {
  clear()
  mounted.value = false
  await nextTick()
  mounted.value = true
}
const suspend = () => audit('suspend')
const resume = () => {
  audit('resume')
  status.value = 'Returned to foreground'
}
Application.on(Application.suspendEvent, suspend)
Application.on(Application.resumeEvent, resume)
onUnmounted(() => {
  clear()
  Application.off(Application.suspendEvent, suspend)
  Application.off(Application.resumeEvent, resume)
})
</script>

<template>
  <ScrollView backgroundColor="#0C1424">
    <StackLayout ref="root" padding="24" color="#E8F0FF">
      <Label
        :text="mode === 'shape' ? 'Shapes in motion' : 'Press lifecycle'"
        fontSize="28"
        fontWeight="bold"
        marginTop="38"
      />
      <Label
        :text="
          mode === 'shape'
            ? 'The drawing stays in local bounds.'
            : 'One tap, one application action.'
        "
        fontSize="15"
        marginTop="8"
        textWrap="true"
      />
      <StackLayout v-if="mode === 'shape' && mounted" @loaded="setup">
        <Label text="Direct drawing host" marginTop="22" />
        <GridLayout
          id="portable-shape"
          :width="size"
          :height="size"
          backgroundColor="#18283E"
          borderColor="#8497B4"
          borderWidth="1"
          marginTop="10"
        />
        <Label text="Drawing inside an animated parent" marginTop="20" />
        <GridLayout
          id="portable-reference-parent"
          :width="size"
          :height="size"
          backgroundColor="#18283E"
          borderColor="#8497B4"
          borderWidth="1"
          marginTop="10"
        >
          <GridLayout id="portable-reference" />
        </GridLayout>
        <GridLayout columns="*,*,*" marginTop="16">
          <Button
            text="Scale"
            automationText="portable-scale"
            @tap="transform('scale')"
          />
          <Button
            col="1"
            text="Rotate"
            automationText="portable-rotate"
            @tap="transform('rotate')"
          />
          <Button
            col="2"
            text="Both"
            automationText="portable-both"
            @tap="transform('both')"
          />
        </GridLayout>
      </StackLayout>
      <StackLayout v-if="mode === 'press'">
        <GridLayout columns="*,*" marginTop="25">
          <Button
            text="No effect"
            automationText="portable-plain"
            @tap="choose('plain')"
          />
          <Button
            col="1"
            text="Direct press"
            automationText="portable-direct"
            @tap="choose('direct')"
          />
        </GridLayout>
        <GridLayout columns="*,*">
          <Button
            text="Scoped press"
            automationText="portable-scoped"
            @tap="choose('scoped')"
          />
          <Button
            col="1"
            text="Register twice"
            automationText="portable-repeated"
            @tap="choose('repeated')"
          />
        </GridLayout>
        <Label :text="'Mode: ' + variant" fontSize="18" marginTop="24" />
        <Button
          v-if="mounted"
          id="portable-button"
          text="Count action"
          automationText="portable-button"
          height="100"
          marginTop="30"
          backgroundColor="#64D8CB"
          color="#0C1424"
          fontSize="23"
          @loaded="setup"
          @tap="action"
        />
        <Label
          :text="'Actions: ' + taps"
          automationText="portable-count"
          fontSize="32"
          marginTop="25"
        />
      </StackLayout>
      <Label
        :text="status"
        automationText="portable-status"
        marginTop="16"
        textWrap="true"
      />
      <GridLayout columns="*,*" marginTop="12">
        <Button text="Remount" automationText="portable-remount" @tap="remount" />
        <Button
          col="1"
          text="Snapshot"
          automationText="portable-snapshot"
          @tap="audit('snapshot')"
        />
      </GridLayout>
    </StackLayout>
  </ScrollView>
</template>
