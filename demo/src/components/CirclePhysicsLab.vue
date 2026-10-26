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
import { configure, motionScope } from '@rafaelaugusto/jolt'
import { physicsWorld, type PhysicsWorld } from '@rafaelaugusto/jolt/physics'
import { usePreviewI18n } from '../showcase/i18n'
import { launchArgument } from '../launch'
const { t } = usePreviewI18n()
defineProps<{ embedded?: boolean }>()
const board = ref(),
  paused = ref(false),
  reduced = ref(false),
  compact = ref(false)
const pieces = [
  { id: '01', radius: 29, color: '#EACA90', ink: '#49362D', glow: '#FFF0CB' },
  { id: '02', radius: 25, color: '#D26855', ink: '#FFEBDD', glow: '#EDA689' },
  { id: '03', radius: 27, color: '#B4C7AF', ink: '#30473B', glow: '#E6EDCF' },
  { id: '04', radius: 24, color: '#E5ABC0', ink: '#6A344F', glow: '#FFD9E3' },
  { id: '05', radius: 28, color: '#93B7C5', ink: '#294450', glow: '#DAE6DF' },
  { id: '06', radius: 25, color: '#E3DCD0', ink: '#54453F', glow: '#FFF8E9' },
]
const owner = motionScope(),
  auditMode = launchArgument('circle-audit') !== undefined
let world: PhysicsWorld | undefined,
  ended = false,
  turn = 0
const events: object[] = []
function view(): View {
  return board.value?.nativeView
}
function audit(name: string) {
  if (!auditMode) return
  const nativeWorld = isIOS
    ? (global as any).JoltCircleWorld
    : (global as any).org?.rafaelaugusto?.jolt?.CircleWorld
  events.push({
    name,
    time: Date.now(),
    snapshot: world?.snapshot(),
    presented: pieces.map((p) => {
      const node = view()?.getViewById('circle-' + p.id)?.nativeViewProtected
      if (!node) return null
      return isIOS
        ? {
            x:
              node.layer.position.x +
              Number(node.layer.valueForKeyPath('transform.translation.x')),
            y:
              node.layer.position.y +
              Number(node.layer.valueForKeyPath('transform.translation.y')),
          }
        : {
            x: (node.getX() + node.getWidth() / 2) / Screen.mainScreen.scale,
            y: (node.getY() + node.getHeight() / 2) / Screen.mainScreen.scale,
          }
    }),
    size: view()?.getActualSize(),
    worlds: nativeWorld?.worldCount(),
    clocks: nativeWorld?.activeCount(),
    resources: owner.size,
    reduced: reduced.value,
  })
  File.fromPath(
    (isIOS
      ? knownFolders.documents().path
      : Application.android.context.getExternalFilesDir(null).getAbsolutePath()) +
      '/circle-audit.json',
  ).writeTextSync(
    JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }, null, 2),
  )
}
function layout() {
  if (ended || !view()?.isLoaded) return
  const host = view(),
    { width, height } = host.getActualSize()
  if (width < 210 || height < 190) return
  if (world && !world.disposed) return
  const bodies = pieces.map((p, i) => ({
    id: p.id,
    view: host.getViewById('circle-' + p.id),
    radius: p.radius,
    x: width * (0.2 + 0.3 * (i % 3)),
    y: 50 + 88 * Math.floor(i / 3),
    mass: p.radius / 25,
  }))
  if (bodies.some((b) => !b.view?.isLoaded || b.view.getActualSize().width === 0)) return
  world = physicsWorld(host, bodies, { restitution: 0.72, damping: 0.65, scope: owner })
  Application.off(Application.suspendEvent, suspend)
  Application.off(Application.resumeEvent, resume)
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  audit('created')
}
function scatter() {
  if (!world) return
  turn++
  pieces.forEach((p, i) =>
    world!.impulse(p.id, {
      x: (i % 2 ? 1 : -1) * (160 + (turn % 3) * 35),
      y: -650 - i * 45,
    }),
  )
  audit('scatter')
}
function reset() {
  world?.reset()
  audit('reset')
}
function pause() {
  paused.value = !paused.value
  if (paused.value) world?.pause()
  else world?.play()
  audit(paused.value ? 'pause' : 'play')
}
function reduce() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
  audit('reduced')
}
function resize() {
  compact.value = !compact.value
  audit('resize')
}
const suspend = () => audit('background'),
  resume = () => audit('foreground')
Application.on(Application.suspendEvent, suspend)
Application.on(Application.resumeEvent, resume)
onUnmounted(() => {
  ended = true
  owner.dispose()
  audit('disposed')
  Application.off(Application.suspendEvent, suspend)
  Application.off(Application.resumeEvent, resume)
  configure({ reducedMotion: 'user' })
})
</script>
<template>
  <GridLayout
    rows="auto,*,auto,auto"
    backgroundColor="#392631"
    borderRadius="28"
    padding="20"
    automationText="circle-lab"
  >
    <GridLayout columns="*,auto" marginBottom="16">
      <StackLayout>
        <Label
          text="BUMP CLUB"
          color="#F7DFC0"
          fontSize="12"
          fontWeight="bold"
          letterSpacing="0.22"
        />
        <Label
          :text="t('A little chaos. A lot of joy.')"
          color="#BC98A5"
          fontSize="12"
          marginTop="6"
        />
      </StackLayout>
      <Image
        col="1"
        src="~/assets/jolt-mark.png"
        width="27"
        height="33"
        tintColor="#E4B27E"
        stretch="aspectFit"
        verticalAlignment="middle"
      />
    </GridLayout>
    <GridLayout
      row="1"
      minHeight="200"
      :height="compact ? 220 : undefined"
      backgroundColor="#4B3442"
      borderColor="#6E4C5C"
      borderWidth="1"
      borderRadius="20"
      clipToBounds="true"
    >
      <Label
        text="B / C"
        color="#684554"
        fontSize="82"
        fontWeight="bold"
        textAlignment="center"
        verticalAlignment="middle"
      />
      <Label
        :text="t('MAKE SOME ROOM.')"
        color="#8D6576"
        fontSize="9"
        letterSpacing="0.2"
        textAlignment="center"
        verticalAlignment="top"
        marginTop="18"
      />
      <Label
        height="1"
        backgroundColor="#725064"
        verticalAlignment="bottom"
        margin="0 16 14"
      />
      <AbsoluteLayout
        ref="board"
        automationText="circle-board"
        @loaded="layout"
        @layoutChanged="layout"
      >
        <GridLayout
          v-for="p in pieces"
          :key="p.id"
          :id="'circle-' + p.id"
          :automationText="'circle-' + p.id"
          :width="p.radius * 2"
          :height="p.radius * 2"
          :borderRadius="p.radius"
          :backgroundImage="'linear-gradient(135deg, ' + p.glow + ', ' + p.color + ')'"
          :left="0"
          :top="0"
          @layoutChanged="layout"
        >
          <Label
            :width="p.radius * 1.5"
            :height="p.radius * 1.5"
            :borderRadius="p.radius"
            borderWidth="1"
            :borderColor="p.ink"
            opacity="0.18"
            isUserInteractionEnabled="false"
          />
          <Label
            :text="p.id"
            :color="p.ink"
            fontSize="16"
            fontWeight="bold"
            textAlignment="center"
            verticalAlignment="middle"
            isUserInteractionEnabled="false"
          />
          <Label
            width="12"
            height="5"
            borderRadius="3"
            :backgroundColor="p.glow"
            opacity="0.7"
            rotate="-30"
            margin="9 0 0 12"
            verticalAlignment="top"
            horizontalAlignment="left"
            isUserInteractionEnabled="false"
          />
        </GridLayout>
      </AbsoluteLayout>
    </GridLayout>
    <StackLayout row="2" marginTop="18">
      <Label
        :text="
          t(
            reduced
              ? 'A moment of stillness.'
              : paused
                ? 'The club is on a break.'
                : 'Pick one up. Send it flying.',
          )
        "
        color="#F5E0CF"
        fontSize="17"
        textAlignment="center"
        textWrap="true"
      />
      <Label
        :text="t('A gentle nudge changes everything.')"
        color="#B28C9D"
        fontSize="11"
        textAlignment="center"
        marginTop="5"
        marginBottom="14"
        textWrap="true"
      />
      <GridLayout columns="*,*,*">
        <Button
          :text="t('Mix it up')"
          automationText="circle-scatter"
          @tap="scatter"
          backgroundColor="#EAC496"
          color="#442C36"
          borderRadius="22"
          fontSize="13"
          height="46"
          margin="2"
          padding="0"
          androidElevation="0"
          androidDynamicElevationOffset="0"
        />
        <Button
          col="1"
          :text="t(paused ? 'Resume' : 'Pause')"
          automationText="circle-pause"
          @tap="pause"
          backgroundColor="#624452"
          color="#F5DECB"
          borderRadius="22"
          fontSize="13"
          height="46"
          margin="2"
          padding="0"
          androidElevation="0"
          androidDynamicElevationOffset="0"
        />
        <Button
          col="2"
          :text="t('Start fresh')"
          automationText="circle-reset"
          @tap="reset"
          backgroundColor="#624452"
          color="#F5DECB"
          borderRadius="22"
          fontSize="13"
          height="46"
          margin="2"
          padding="0"
          androidElevation="0"
          androidDynamicElevationOffset="0"
        />
      </GridLayout>
      <Button
        :text="t(reduced ? 'Restore motion' : 'Reduce motion')"
        automationText="circle-reduce"
        @tap="reduce"
        backgroundColor="transparent"
        color="#CBA4AF"
        fontSize="11"
        height="36"
        padding="0"
        androidElevation="0"
        androidDynamicElevationOffset="0"
      />
    </StackLayout>
    <GridLayout v-if="auditMode" row="3" columns="*,*">
      <Button
        text="Snapshot"
        automationText="circle-snapshot"
        height="32"
        @tap="audit('snapshot')"
      />
      <Button
        text="Resize"
        col="1"
        automationText="circle-resize"
        height="32"
        @tap="resize"
      />
    </GridLayout>
  </GridLayout>
</template>
