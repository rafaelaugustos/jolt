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
import { launchArgument } from '../launch'
import { usePreviewI18n } from '../showcase/i18n'
const { t } = usePreviewI18n()
defineProps<{ embedded?: boolean }>()
const board = ref(),
  paused = ref(false),
  reduced = ref(false),
  compact = ref(false),
  width = ref(320),
  height = ref(300)
const owner = motionScope(),
  auditMode = launchArgument('attachment-audit') !== undefined
const dockNames = ['Left dock', 'Center dock', 'Right dock']
let world: PhysicsWorld | undefined,
  ended = false,
  shifted = false,
  cancelTimer: ReturnType<typeof setTimeout> | undefined
const events: object[] = []
function host(): View {
  return board.value?.nativeView
}
function audit(name: string) {
  if (!auditMode) return
  const helper = isIOS
    ? (global as any).JoltCircleWorld
    : (global as any).org.rafaelaugusto.jolt.CircleWorld
  const snapshot = world?.snapshot()
  events.push({
    name,
    time: Date.now(),
    snapshot,
    worlds: helper.worldCount(),
    clocks: helper.activeCount(),
    resources: owner.size,
    reduced: reduced.value,
    size: host()?.getActualSize(),
    presented: ['tether', 'magnet'].map((id) => {
      const v = host()?.getViewById('attachment-' + id)?.nativeViewProtected
      if (!v) return null
      return isIOS
        ? {
            x:
              v.layer.position.x +
              Number(v.layer.valueForKeyPath('transform.translation.x')),
            y:
              v.layer.position.y +
              Number(v.layer.valueForKeyPath('transform.translation.y')),
          }
        : {
            x: (v.getX() + v.getWidth() / 2) / Screen.mainScreen.scale,
            y: (v.getY() + v.getHeight() / 2) / Screen.mainScreen.scale,
          }
    }),
  })
  File.fromPath(
    (isIOS
      ? knownFolders.documents().path
      : Application.android.context.getExternalFilesDir(null).getAbsolutePath()) +
      '/attachment-audit.json',
  ).writeTextSync(
    JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }, null, 2),
  )
}
function layout() {
  if (ended || !host()?.isLoaded) return
  const size = host().getActualSize()
  width.value = size.width
  height.value = size.height
  if (size.width < 220 || size.height < 220) return
  if (world && !world.disposed) return
  const tether = host().getViewById('attachment-tether'),
    magnet = host().getViewById('attachment-magnet')
  if (
    !tether?.isLoaded ||
    !magnet?.isLoaded ||
    tether.getActualSize().width === 0 ||
    magnet.getActualSize().width === 0
  )
    return
  world = physicsWorld(
    host(),
    [
      {
        id: 'tether',
        view: tether,
        radius: 28,
        x: size.width * 0.5,
        y: size.height * 0.14 + 76.17,
        attachment: {
          anchor: { x: size.width * 0.5, y: size.height * 0.14 },
          length: 72,
          stiffness: 180,
          damping: 14,
          line: { color: '#DBB994', width: 1.5 },
        },
      },
      {
        id: 'magnet',
        view: magnet,
        radius: 26,
        x: size.width * 0.5,
        y: size.height * 0.78,
        snap: {
          points: [0.2, 0.5, 0.8].map((x) => ({
            x: size.width * x,
            y: size.height * 0.78,
          })),
          stiffness: 220,
          damping: 25,
          projection: 0.12,
        },
      },
    ],
    { scope: owner, restitution: 0.45, damping: 0.6 },
  )
  world.snapTo('magnet', 1)
  Application.off(Application.suspendEvent, suspend)
  Application.off(Application.resumeEvent, resume)
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  audit('created')
}
function nudge() {
  world?.impulse('tether', { x: 400, y: -160 })
  audit('nudge')
}
function shift() {
  shifted = !shifted
  world?.attach('tether', {
    anchor: { x: width.value * (shifted ? 0.32 : 0.5), y: height.value * 0.14 },
    length: 72,
    stiffness: 180,
    damping: 14,
    line: { color: '#DBB994', width: 1.5 },
  })
  audit('anchor')
}
function dock(index: number) {
  world?.snapTo('magnet', index)
  audit('dock-' + index)
}
function pause() {
  paused.value = !paused.value
  if (paused.value) world?.pause()
  else world?.play()
  audit(paused.value ? 'pause' : 'play')
}
function reset() {
  world?.reset()
  world?.snapTo('magnet', 1)
  audit('reset')
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
function armCancel() {
  if (cancelTimer) clearTimeout(cancelTimer)
  cancelTimer = setTimeout(() => {
    world?.pause()
    paused.value = true
    audit('cancelled-drag')
  }, 2000)
  audit('armed-cancel')
}
const suspend = () => audit('background'),
  resume = () => audit('foreground')
onUnmounted(() => {
  ended = true
  if (cancelTimer) clearTimeout(cancelTimer)
  owner.dispose()
  audit('disposed')
  Application.off(Application.suspendEvent, suspend)
  Application.off(Application.resumeEvent, resume)
  configure({ reducedMotion: 'user' })
})
</script>
<template>
  <GridLayout
    rows="auto,*,auto,auto,auto,auto,auto"
    backgroundColor="#172C38"
    borderRadius="28"
    padding="20"
    automationText="attachment-lab"
  >
    <GridLayout columns="*,auto" marginBottom="15">
      <StackLayout>
        <Label
          text="EQUILIBRIUM"
          color="#EBD6B9"
          fontSize="12"
          fontWeight="bold"
          letterSpacing="0.2"
        />
        <Label
          :text="t('Spring back. Find your place.')"
          color="#90A8B4"
          fontSize="12"
          marginTop="6"
        />
      </StackLayout>
      <Image
        col="1"
        src="~/assets/jolt-mark.png"
        width="26"
        height="32"
        tintColor="#E1B18A"
        stretch="aspectFit"
      />
    </GridLayout>
    <GridLayout
      row="1"
      minHeight="220"
      :height="compact ? 230 : 'auto'"
      backgroundColor="#203B49"
      borderRadius="22"
      borderColor="#3C5865"
      borderWidth="1"
      clipToBounds="true"
    >
      <Label
        text="◎"
        color="#2C4857"
        fontSize="220"
        textAlignment="center"
        verticalAlignment="middle"
        isUserInteractionEnabled="false"
      />
      <Label
        :text="t('A LITTLE GIVE. A LITTLE GRAVITY.')"
        color="#76929F"
        fontSize="8"
        letterSpacing="0.14"
        textAlignment="center"
        verticalAlignment="top"
        marginTop="15"
      />
      <AbsoluteLayout
        ref="board"
        automationText="attachment-board"
        @loaded="layout"
        @layoutChanged="layout"
      >
        <GridLayout
          v-for="(name, i) in dockNames"
          :key="name"
          :left="width * (0.2 + i * 0.3) - 30"
          :top="height * 0.78 - 30"
          width="60"
          height="60"
          borderRadius="30"
          borderWidth="1"
          borderColor="#547285"
          backgroundColor="#243F4E"
          isUserInteractionEnabled="false"
        >
          <Label
            :text="String(i + 1).padStart(2, '0')"
            color="#658295"
            fontSize="10"
            textAlignment="center"
            verticalAlignment="middle"
          />
        </GridLayout>
        <GridLayout
          id="attachment-tether"
          automationText="attachment-tether"
          width="56"
          height="56"
          borderRadius="28"
          backgroundImage="linear-gradient(140deg, #FFDCAB, #DA9A66)"
          left="0"
          top="0"
          @layoutChanged="layout"
        >
          <Label
            width="42"
            height="42"
            borderRadius="21"
            borderWidth="1"
            borderColor="#AD784C"
            opacity="0.45"
            isUserInteractionEnabled="false"
          />
          <Label
            text="01"
            color="#6B4530"
            fontSize="16"
            fontWeight="bold"
            textAlignment="center"
            verticalAlignment="middle"
            isUserInteractionEnabled="false"
          />
          <Label
            width="13"
            height="5"
            borderRadius="3"
            backgroundColor="#FFF1D0"
            rotate="-30"
            margin="9 0 0 12"
            verticalAlignment="top"
            horizontalAlignment="left"
            isUserInteractionEnabled="false"
          />
        </GridLayout>
        <GridLayout
          id="attachment-magnet"
          automationText="attachment-magnet"
          width="52"
          height="52"
          borderRadius="26"
          backgroundImage="linear-gradient(145deg, #E4DDFF, #9CACE0)"
          left="0"
          top="0"
          @layoutChanged="layout"
        >
          <Label
            width="38"
            height="38"
            borderRadius="19"
            borderWidth="1"
            borderColor="#7C81B6"
            opacity="0.5"
            isUserInteractionEnabled="false"
          />
          <Label
            text="02"
            color="#494F80"
            fontSize="15"
            fontWeight="bold"
            textAlignment="center"
            verticalAlignment="middle"
            isUserInteractionEnabled="false"
          />
        </GridLayout>
      </AbsoluteLayout>
    </GridLayout>
    <StackLayout row="2" margin="14 0 12">
      <Label
        :text="
          t(
            reduced
              ? 'A moment of stillness.'
              : paused
                ? 'Balance, on pause.'
                : 'Pull the copper orb. Flick the lilac one.',
          )
        "
        textWrap="true"
        textAlignment="center"
        color="#F0DFCB"
        fontSize="14"
      />
      <Label
        :text="t('One comes home. One finds a new spot.')"
        textWrap="true"
        textAlignment="center"
        color="#93AAB6"
        fontSize="10"
        marginTop="5"
      />
    </StackLayout>
    <GridLayout row="3" columns="*,*,*,*">
      <Button
        :text="t('Nudge')"
        automationText="attachment-nudge"
        @tap="nudge"
        backgroundColor="#E9BE94"
        color="#453A30"
        borderRadius="18"
        height="42"
        fontSize="11"
        margin="2"
        padding="0"
        androidElevation="0"
        androidDynamicElevationOffset="0"
      />
      <Button
        col="1"
        :text="t('Move anchor')"
        automationText="attachment-anchor"
        @tap="shift"
        backgroundColor="#334F5E"
        color="#DFE6E5"
        borderRadius="18"
        height="42"
        fontSize="10"
        margin="2"
        padding="0"
        androidElevation="0"
        androidDynamicElevationOffset="0"
      />
      <Button
        col="2"
        :text="t(paused ? 'Resume' : 'Pause')"
        automationText="attachment-pause"
        @tap="pause"
        backgroundColor="#334F5E"
        color="#DFE6E5"
        borderRadius="18"
        height="42"
        fontSize="11"
        margin="2"
        padding="0"
        androidElevation="0"
        androidDynamicElevationOffset="0"
      />
      <Button
        col="3"
        :text="t('Start fresh')"
        automationText="attachment-reset"
        @tap="reset"
        backgroundColor="#334F5E"
        color="#DFE6E5"
        borderRadius="18"
        height="42"
        fontSize="10"
        margin="2"
        padding="0"
        androidElevation="0"
        androidDynamicElevationOffset="0"
      />
    </GridLayout>
    <GridLayout row="4" columns="*,*,*" marginTop="5">
      <Button
        v-for="(name, i) in dockNames"
        :key="name"
        :col="i"
        :text="t(name)"
        :automationText="'attachment-dock-' + i"
        @tap="dock(i)"
        backgroundColor="#263F50"
        color="#B8C3E8"
        borderRadius="15"
        height="34"
        fontSize="10"
        margin="2"
        padding="0"
        androidElevation="0"
        androidDynamicElevationOffset="0"
      />
    </GridLayout>
    <Button
      row="5"
      :text="t(reduced ? 'Restore motion' : 'Reduce motion')"
      automationText="attachment-reduce"
      @tap="reduce"
      backgroundColor="transparent"
      color="#91AAB9"
      height="33"
      fontSize="11"
      padding="0"
      androidElevation="0"
      androidDynamicElevationOffset="0"
    />
    <GridLayout v-if="auditMode" row="6" columns="*,*,*">
      <Button
        text="Snapshot"
        automationText="attachment-snapshot"
        height="30"
        @tap="audit('snapshot')"
      />
      <Button
        text="Resize"
        col="1"
        automationText="attachment-resize"
        height="30"
        @tap="resize"
      />
      <Button
        text="Cancel drag"
        col="2"
        automationText="attachment-cancel"
        height="30"
        @tap="armCancel"
      />
    </GridLayout>
  </GridLayout>
</template>
