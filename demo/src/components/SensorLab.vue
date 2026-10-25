<script setup lang="ts">
import { Application, File, isIOS, knownFolders, type View } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { bind, configure, motionScope, springValue } from '@rafaelaugusto/jolt'
import { sensor, type Sensor, type SensorStatus } from '@rafaelaugusto/jolt/sensors'
import { replaySensor, type SensorSample } from '@rafaelaugusto/jolt/testing'
import { usePreviewI18n } from '../showcase/i18n'
import { launchArgument } from '../launch'
const { t } = usePreviewI18n()
defineProps<{ embedded?: boolean }>()
const stage = ref(),
  card = ref(),
  glow = ref(),
  orbit = ref(),
  shine = ref(),
  mark = ref()
const status = ref<SensorStatus>('idle'),
  paused = ref(false),
  reduced = ref(false)
const auditMode = launchArgument('sensors-audit') !== undefined
let owner: ReturnType<typeof motionScope> | undefined,
  rotation: ReturnType<typeof sensor> | undefined,
  gravity: ReturnType<typeof sensor> | undefined
let released = false
let sharingChecked = false
const events: object[] = []
const nativeView = (value: any): View => value.value.nativeView
function audit(name: string) {
  if (!auditMode) return
  if (name === 'snapshot' && !sharingChecked) {
    sharingChecked = true
    const extra = sensor('rotation', { interval: 5 })
    const release = bind(nativeView(mark), { rotate: extra.z })
    audit('shared')
    release()
    extra.dispose()
    audit('shared-released')
  }
  const pose = (value: any) => {
    const node = value.value?.nativeView?.nativeViewProtected
    if (!node) return null
    return isIOS
      ? {
          x: node.layer.transform.m41,
          y: node.layer.transform.m42,
          m11: node.layer.transform.m11,
          m22: node.layer.transform.m22,
          m13: node.layer.transform.m13,
          m23: node.layer.transform.m23,
        }
      : {
          x: node.getTranslationX(),
          y: node.getTranslationY(),
          rx: node.getRotationX(),
          ry: node.getRotationY(),
        }
  }
  const native = isIOS ? JoltSensorSource : org.rafaelaugusto.jolt.SensorSource
  const live = isIOS ? JoltLiveSpring : org.rafaelaugusto.jolt.LiveSpring
  events.push({
    name,
    time: Date.now(),
    rotation: rotation?.snapshot(),
    gravity: gravity?.snapshot(),
    card: pose(card),
    glow: pose(glow),
    shine: pose(shine),
    active: native.activeCount(),
    sources: native.sourceCount(),
    nodes: live.nodeCount(),
    clock: live.activeCount(),
  })
  File.fromPath(
    (isIOS
      ? knownFolders.documents().path
      : Application.android.context.getExternalFilesDir(null).getAbsolutePath()) +
      '/sensors-audit.json',
  ).writeTextSync(
    JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }, null, 2),
  )
}
function loaded() {
  if (owner) {
    if (!paused.value) owner.resume()
    audit('reloaded')
    return
  }
  released = false
  // Keep the tilted card in front of coplanar decorative rings on Core Animation.
  if (isIOS) nativeView(card).ios.layer.zPosition = 100
  else {
    nativeView(card).android.setClipToOutline(true)
    nativeView(stage).android.setClipToOutline(true)
  }
  owner = motionScope()
  const options = {
    scope: owner,
    onStatus: (value: SensorStatus) => {
      status.value = value
    },
  }
  rotation = sensor('rotation', options)
  gravity = sensor('gravity', { scope: owner })
  const x = owner.add(springValue(rotation.x, { stiffness: 155, damping: 23 })),
    y = owner.add(springValue(rotation.y, { stiffness: 155, damping: 23 }))
  const gx = owner.add(springValue(gravity.x, { stiffness: 110, damping: 21 })),
    gy = owner.add(springValue(gravity.y, { stiffness: 110, damping: 21 }))
  owner.use(() =>
    bind(nativeView(card), {
      rotateX: x.to([-0.6, 0.6], [-17, 17]),
      rotateY: y.to([-0.6, 0.6], [-20, 20]),
    }),
  )
  owner.use(() =>
    bind(nativeView(shine), {
      x: y.to([-0.6, 0.6], [-95, 95]),
      y: x.to([-0.6, 0.6], [-50, 50]),
    }),
  )
  owner.use(() =>
    bind(nativeView(orbit), {
      x: y.to([-0.6, 0.6], [30, -30]),
      y: x.to([-0.6, 0.6], [22, -22]),
    }),
  )
  owner.use(() =>
    bind(nativeView(mark), {
      x: y.to([-0.6, 0.6], [-10, 10]),
      y: x.to([-0.6, 0.6], [-8, 8]),
    }),
  )
  owner.use(() =>
    bind(nativeView(glow), {
      x: gx.to([-6, 6], [-45, 45]),
      y: gy.to([-6, 6], [-30, 30]),
    }),
  )
  audit('loaded')
}
function preview() {
  if (!rotation || !gravity) return
  if (paused.value) pause()
  const rotations: SensorSample[] = [],
    gravities: SensorSample[] = []
  for (let i = 0; i <= 480; i++) {
    const time = i * 25,
      phase = (time / 12000) * Math.PI * 4,
      envelope = Math.sin((Math.PI * i) / 480)
    const x = Math.sin(phase) * 0.48 * envelope,
      y = Math.sin(phase * 0.7) * 0.58 * envelope
    const sx = Math.sin(x / 2),
      cx = Math.cos(x / 2),
      sy = Math.sin(y / 2),
      cy = Math.cos(y / 2)
    rotations.push({ time, values: [sx * cy, cx * sy, -sx * sy, cx * cy] })
    gravities.push({
      time,
      values: [
        Math.sin(y) * 9.80665,
        -Math.sin(x) * Math.cos(y) * 9.80665,
        -Math.cos(x) * Math.cos(y) * 9.80665,
      ],
    })
  }
  replaySensor(rotation, rotations)
  replaySensor(gravity, gravities)
  audit('preview')
}
function pause() {
  paused.value = !paused.value
  if (paused.value) owner?.suspend()
  else owner?.resume()
  audit(paused.value ? 'pause' : 'resume')
}
function center() {
  if (rotation?.kind === 'rotation') rotation.recenter()
  audit('center')
}
function reduce() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
  audit(reduced.value ? 'reduced' : 'motion')
}
function busy() {
  audit('busy-start')
  const until = Date.now() + 1800
  while (Date.now() < until) {
    Math.sqrt(Date.now())
  }
  audit('busy-end')
}
function unloaded() {
  owner?.suspend()
  audit('unloaded')
}
function clean() {
  if (released) return
  released = true
  owner?.dispose()
  owner = undefined
  audit('disposed')
  configure({ reducedMotion: 'user' })
}
onUnmounted(clean)
</script>
<template>
  <GridLayout
    ref="stage"
    rows="*,auto"
    borderRadius="24"
    clipToBounds="true"
    backgroundColor="#0B2522"
    @loaded="loaded"
    @unloaded="unloaded"
    accessibilityIdentifier="sensor-lab"
  >
    <GridLayout clipToBounds="true" minHeight="380">
      <Label
        ref="glow"
        width="340"
        height="340"
        borderRadius="170"
        backgroundColor="#183D34"
        opacity="0.8"
        translateX="-80"
        translateY="-55"
        :accessible="false"
      />
      <Label
        ref="orbit"
        width="380"
        height="380"
        borderRadius="190"
        borderWidth="1"
        borderColor="#46614C"
        opacity="0.6"
        :accessible="false"
      />
      <Label
        width="310"
        height="310"
        borderRadius="155"
        borderWidth="1"
        borderColor="#46614C"
        opacity="0.4"
        :accessible="false"
      />
      <GridLayout
        ref="card"
        rows="auto,*,auto"
        width="276"
        height="326"
        borderRadius="24"
        borderWidth="1"
        borderColor="#D9CB93"
        backgroundColor="#D9D3AB"
        clipToBounds="true"
        accessibilityIdentifier="sensor-card"
        :accessibilityLabel="t('Meridian card. Tilt your phone to move the light.')"
      >
        <GridLayout
          rowSpan="3"
          :accessible="false"
          borderRadius="24"
          backgroundImage="linear-gradient(145deg, #F3EAD0, #B6BE8E, #E0C791)"
        />
        <GridLayout
          ref="shine"
          rowSpan="3"
          width="110"
          height="480"
          rotate="-28"
          backgroundColor="#FFF8D9"
          opacity="0.38"
          :accessible="false"
        />
        <GridLayout columns="*,auto" margin="23 23 0">
          <Label
            :text="t('MERIDIAN')"
            fontSize="16"
            fontWeight="bold"
            letterSpacing="0.18"
            color="#20392E"
          />
          <Label col="1" text="↗" fontSize="22" color="#20392E" />
        </GridLayout>
        <GridLayout row="1" ref="mark" :accessible="false">
          <Label
            width="139"
            height="139"
            borderWidth="1"
            borderColor="#526548"
            borderRadius="70"
          />
          <Label
            width="107"
            height="139"
            borderWidth="1"
            borderColor="#526548"
            borderRadius="54"
          />
          <Label
            width="57"
            height="139"
            borderWidth="1"
            borderColor="#526548"
            borderRadius="28"
          />
          <Label width="139" height="1" backgroundColor="#526548" />
          <Label width="124" height="1" backgroundColor="#526548" translateY="-35" />
          <Label width="124" height="1" backgroundColor="#526548" translateY="35" />
          <Label text="✦" textAlignment="center" fontSize="51" color="#20392E" />
        </GridLayout>
        <GridLayout row="2" columns="*,auto" margin="0 23 23">
          <StackLayout
            ><Label
              :text="t('A DIFFERENT ANGLE')"
              fontSize="8"
              letterSpacing="0.14"
              color="#43573E" /><Label
              :text="t('Changes everything.')"
              marginTop="5"
              fontSize="15"
              color="#20392E"
              fontWeight="bold"
          /></StackLayout>
          <Label
            col="1"
            text="01 / 67"
            fontSize="9"
            verticalAlignment="bottom"
            color="#43573E"
          />
        </GridLayout>
      </GridLayout>
      <Label
        verticalAlignment="top"
        marginTop="18"
        :text="t('THE MOTION COLLECTION')"
        color="#ADC4AB"
        fontSize="9"
        letterSpacing="0.22"
        textAlignment="center"
      />
    </GridLayout>
    <StackLayout row="1" padding="0 20 18">
      <Label
        :text="
          t(
            status === 'replaying'
              ? 'Motion preview · simulated input'
              : status === 'unavailable'
                ? 'Motion unavailable on this device.'
                : status === 'error'
                  ? 'Motion is unavailable. Try the preview.'
                  : status === 'paused'
                    ? 'A moment of stillness.'
                    : 'Move your phone. Follow the light.',
          )
        "
        color="#EDF0D8"
        fontSize="14"
        textAlignment="center"
        textWrap="true"
        marginBottom="5"
        accessibilityIdentifier="sensor-status"
      />
      <Label
        :text="t('One movement. Layers of depth.')"
        color="#99B2A2"
        fontSize="11"
        textAlignment="center"
        marginBottom="13"
      />
      <GridLayout columns="*,auto" rows="48" marginBottom="6">
        <Button
          androidElevation="0"
          androidDynamicElevationOffset="0"
          :text="t('Preview movement')"
          @tap="preview"
          accessibilityIdentifier="sensor-preview"
          backgroundColor="#DFE8A4"
          color="#20392E"
          borderRadius="24"
          fontSize="13"
          fontWeight="bold"
          margin="0 5 0 0"
        />
        <Button
          androidElevation="0"
          androidDynamicElevationOffset="0"
          col="1"
          :text="t(paused ? 'Resume' : 'Pause')"
          @tap="pause"
          accessibilityIdentifier="sensor-pause"
          backgroundColor="#28473C"
          color="#E3E9D7"
          borderRadius="24"
          fontSize="13"
          margin="0"
          padding="0 18"
        />
      </GridLayout>
      <GridLayout columns="*,*" rows="38">
        <Button
          androidElevation="0"
          androidDynamicElevationOffset="0"
          :text="t('Recenter')"
          @tap="center"
          accessibilityIdentifier="sensor-center"
          backgroundColor="transparent"
          color="#B6C6AC"
          fontSize="11"
          margin="0"
        />
        <Button
          androidElevation="0"
          androidDynamicElevationOffset="0"
          col="1"
          :text="t(reduced ? 'Motion on' : 'Reduce motion')"
          @tap="reduce"
          accessibilityIdentifier="sensor-reduce"
          backgroundColor="transparent"
          color="#B6C6AC"
          fontSize="11"
          margin="0"
        />
      </GridLayout>
      <GridLayout v-if="auditMode" columns="*,*" height="40"
        ><Button
          androidElevation="0"
          androidDynamicElevationOffset="0"
          text="Snapshot"
          accessibilityIdentifier="sensor-snapshot"
          @tap="audit('snapshot')"
          color="#20392E"
          fontSize="10" /><Button
          androidElevation="0"
          androidDynamicElevationOffset="0"
          col="1"
          text="Busy JavaScript"
          accessibilityIdentifier="sensor-busy"
          @tap="busy"
          color="#20392E"
          fontSize="10"
      /></GridLayout>
    </StackLayout>
  </GridLayout>
</template>
