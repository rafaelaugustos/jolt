<script setup lang="ts">
import { Application, File, isIOS, knownFolders, type View } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import {
  animate,
  configure,
  motionScope,
  type PlaybackAnimation,
} from '@rafaelaugusto/jolt'
import { GlassContainer, GlassView, supportsLiquidGlass } from '@rafaelaugusto/jolt/glass'
import { launchArgument } from '../launch'
import { usePreviewI18n } from '../showcase/i18n'
const { t } = usePreviewI18n()
defineProps<{ embedded?: boolean }>()
const root = ref(),
  joined = ref(false),
  paused = ref(false),
  reduced = ref(false),
  clear = ref(false),
  compact = ref(false),
  touches = ref(0)
const scope = motionScope(),
  auditMode = launchArgument('glass-audit') !== undefined,
  available = supportsLiquidGlass()
let group: GlassContainer | undefined,
  glasses: GlassView[] = [],
  handles: PlaybackAnimation[] = [],
  ended = false
const events: object[] = []
function audit(name: string, error?: string) {
  if (!auditMode) return
  events.push({
    name,
    error,
    time: Date.now(),
    joined: joined.value,
    paused: paused.value,
    reduced: reduced.value,
    touches: touches.value,
    resources: scope.size,
    group: group
      ? {
          backend: group.glassBackend,
          spacing: group.glassSpacing,
          width: group.getActualSize().width,
          effect:
            isIOS && group.nativeViewProtected?.effect
              ? String(group.nativeViewProtected.effect.class())
              : null,
        }
      : null,
    views: glasses.map((view) => {
      const n = view.nativeViewProtected,
        layer = isIOS ? (n?.layer?.presentationLayer() ?? n?.layer) : null
      return {
        id: view.id,
        loaded: view.isLoaded,
        backend: view.glassBackend,
        x: isIOS
          ? (layer?.transform.m41 ?? 0)
          : n?.getTranslationX() / n?.getResources().getDisplayMetrics().density,
        y: isIOS
          ? (layer?.transform.m42 ?? 0)
          : n?.getTranslationY() / n?.getResources().getDisplayMetrics().density,
        animations: isIOS ? (n?.layer?.animationKeys()?.count ?? 0) : null,
        effect: isIOS && n?.effect ? String(n.effect.class()) : null,
        grouped: isIOS
          ? n?.superview === group?.nativeViewProtected?.contentView
          : view.parent === group,
        contentInside: isIOS
          ? view.getChildAt(0)?.nativeViewProtected?.superview === n?.contentView
          : view.getChildAt(0)?.parent === view,
        size: view.getActualSize(),
        cornerRadius: isIOS ? (n?.layer?.cornerRadius ?? null) : null,
      }
    }),
  })
  const folder = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null).getAbsolutePath()
  File.fromPath(folder + '/glass-audit.json').writeTextSync(
    JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }, null, 2),
  )
}
function layout() {
  if (ended || glasses.length) return
  const host: View = root.value?.nativeView
  group = host?.getViewById('glass-container') as GlassContainer
  if (!group?.isLoaded) return
  glasses = ['glass-left', 'glass-center', 'glass-right'].map(
    (id) => host.getViewById(id) as GlassView,
  )
  if (glasses.some((v) => !v?.nativeViewProtected)) {
    glasses = []
    return
  }
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  audit('created')
}
function move(together: boolean) {
  audit('before-move')
  joined.value = together
  paused.value = false
  const targets = together
    ? [
        [-52, 0],
        [0, 0],
        [52, 0],
      ]
    : [
        [-104, 0],
        [0, 0],
        [104, 0],
      ]
  handles = glasses.map((view, i) =>
    scope.add(
      animate(
        view,
        { x: targets[i]![0], y: targets[i]![1] },
        auditMode
          ? { duration: 1800, ease: 'linear' }
          : { type: 'spring', duration: 1250, bounce: 0.15 },
      ),
    ),
  )
  audit('move')
}
function flow() {
  joined.value = false
  paused.value = false
  handles = glasses.map((view, i) =>
    scope.add(
      animate(
        view,
        {
          x: [
            i === 0 ? -104 : i === 2 ? 104 : 0,
            i === 0 ? -45 : i === 2 ? 45 : 0,
            i === 0 ? -104 : i === 2 ? 104 : 0,
          ],
          y: [0, i === 1 ? -52 : 26, 0],
        },
        {
          duration: auditMode ? 900 : 2600,
          delay: auditMode ? 1200 : 0,
          ease: 'easeInOut',
          repeat: 1,
          repeatType: 'reverse',
        },
      ),
    ),
  )
  audit('flow')
}
function pause() {
  paused.value = !paused.value
  handles.forEach((h) => (paused.value ? h.pause() : h.play()))
  audit(paused.value ? 'pause' : 'play')
}
function reduce() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
  if (reduced.value) {
    handles.forEach((handle) => handle.stop())
    move(joined.value)
  }
  audit('reduced')
}
function material() {
  clear.value = !clear.value
  audit('material')
}
function seek() {
  handles.forEach((h) => {
    h.pause()
    h.progress = 0.5
  })
  paused.value = true
  audit('midpoint')
}
function resize() {
  compact.value = !compact.value
  audit('resize')
}
function invalid() {
  try {
    if (group) group.glassSpacing = -1
  } catch (e) {
    audit('rejected', String(e))
  }
}
function touch() {
  touches.value++
  audit('touch')
}
const suspend = () => {
    scope.suspend()
    audit('background')
  },
  resume = () => {
    scope.resume()
    audit('foreground')
  }
onUnmounted(() => {
  ended = true
  scope.dispose()
  if (auditMode) setTimeout(() => audit('disposed'), 100)
  Application.off(Application.suspendEvent, suspend)
  Application.off(Application.resumeEvent, resume)
  configure({ reducedMotion: 'user' })
})
</script>
<template>
  <GridLayout
    ref="root"
    rows="auto,*,auto,auto,auto,auto"
    padding="16"
    borderRadius="28"
    backgroundColor="#302B29"
    automationText="glass-lab"
    @layoutChanged="layout"
  >
    <GridLayout columns="*,auto" margin="5,5,16,5">
      <StackLayout>
        <Label text="S T I L L" fontSize="14" color="#F6DEC0" fontWeight="bold" />
        <Label
          :text="t('A little closer. A little more connected.')"
          color="#C5B8AE"
          fontSize="11"
          marginTop="5"
        />
      </StackLayout>
      <Label col="1" text="03" color="#D8A576" fontSize="26" fontWeight="bold" />
    </GridLayout>
    <GridLayout row="1" borderRadius="23" backgroundColor="#B98B61" minHeight="280">
      <Image src="~/assets/studio/dunes.png" stretch="aspectFill" borderRadius="23" />
      <GridLayout rows="auto,*,auto" margin="24,20">
        <StackLayout>
          <Label
            :text="t('TOGETHER, BY NATURE')"
            color="#FFF3E3"
            fontSize="9"
            letterSpacing=".1"
          />
          <Label
            :text="t('Stay\nclose.')"
            color="#FFF3E3"
            fontSize="48"
            fontWeight="bold"
            textWrap="true"
            marginTop="7"
          />
        </StackLayout>
        <Label
          row="2"
          :text="
            t(
              available
                ? 'Three little worlds. One shared feeling.'
                : 'The same connection. A classic finish.',
            )
          "
          color="#FFF3E3"
          fontSize="12"
          textWrap="true"
        />
      </GridLayout>
      <GlassContainer
        id="glass-container"
        :width="compact ? 300 : 'auto'"
        height="200"
        verticalAlignment="center"
        marginTop="100"
        :glassSpacing="26"
      >
        <GlassView
          id="glass-left"
          automationText="glass-left"
          width="72"
          height="72"
          translateX="-104"
          :glassStyle="clear ? 'clear' : 'regular'"
          :glassInteractive="true"
          :backgroundColor="isIOS ? 'transparent' : '#F7E3C6CC'"
          :borderRadius="isIOS ? 0 : 36"
          @tap="touch"
        >
          <Label
            text="✦"
            color="#352A24"
            fontSize="30"
            textAlignment="center"
            verticalAlignment="center"
          />
        </GlassView>
        <GlassView
          id="glass-center"
          automationText="glass-center"
          width="82"
          height="82"
          :glassStyle="clear ? 'clear' : 'regular'"
          :glassInteractive="true"
          :backgroundColor="isIOS ? 'transparent' : '#F7E3C6CC'"
          :borderRadius="isIOS ? 0 : 41"
          @tap="touch"
        >
          <Label
            text="◎"
            color="#352A24"
            fontSize="36"
            textAlignment="center"
            verticalAlignment="center"
          />
        </GlassView>
        <GlassView
          id="glass-right"
          automationText="glass-right"
          width="72"
          height="72"
          translateX="104"
          :glassStyle="clear ? 'clear' : 'regular'"
          :glassInteractive="true"
          :backgroundColor="isIOS ? 'transparent' : '#F7E3C6CC'"
          :borderRadius="isIOS ? 0 : 36"
          @tap="touch"
        >
          <Label
            text="＋"
            color="#352A24"
            fontSize="30"
            textAlignment="center"
            verticalAlignment="center"
          />
        </GlassView>
      </GlassContainer>
    </GridLayout>
    <StackLayout row="2" margin="16,5,12,5">
      <Label
        :text="t(joined ? 'Closer feels different.' : 'Good things find each other.')"
        color="#F6E7D7"
        fontSize="19"
        fontWeight="bold"
      />
      <Label
        :text="
          t(
            touches
              ? 'A little touch goes a long way.'
              : 'Bring them together. Let them wander.',
          )
        "
        color="#C5B8AE"
        fontSize="11"
        marginTop="5"
      />
    </StackLayout>
    <GridLayout row="3" columns="*,*,*" height="44">
      <Button
        :text="t('Gather')"
        automationText="glass-gather"
        backgroundColor="#EBC49C"
        color="#382C24"
        borderRadius="15"
        androidElevation="0"
        fontSize="12"
        margin="2"
        @tap="move(true)"
      />
      <Button
        col="1"
        :text="t('Separate')"
        automationText="glass-separate"
        backgroundColor="#4B413C"
        color="#F6E7D7"
        borderRadius="15"
        androidElevation="0"
        fontSize="12"
        margin="2"
        @tap="move(false)"
      />
      <Button
        col="2"
        :text="t('Flow')"
        automationText="glass-flow"
        backgroundColor="#4B413C"
        color="#F6E7D7"
        borderRadius="15"
        androidElevation="0"
        fontSize="12"
        margin="2"
        @tap="flow"
      />
    </GridLayout>
    <GridLayout row="4" columns="*,*,*" height="40" marginTop="5">
      <Button
        :text="t(paused ? 'Resume' : 'Pause')"
        automationText="glass-pause"
        backgroundColor="transparent"
        color="#C5B8AE"
        androidElevation="0"
        fontSize="11"
        @tap="pause"
      />
      <Label
        v-if="!available"
        col="1"
        :text="t('Classic material')"
        color="#C5B8AE"
        fontSize="10"
        textAlignment="center"
        verticalAlignment="center"
      />
      <Button
        v-else
        col="1"
        :text="t(clear ? 'Regular glass' : 'Clear glass')"
        automationText="glass-material"
        backgroundColor="transparent"
        color="#C5B8AE"
        androidElevation="0"
        fontSize="10"
        @tap="material"
      />
      <Button
        col="2"
        :text="t(reduced ? 'Restore motion' : 'Reduce motion')"
        automationText="glass-reduce"
        backgroundColor="transparent"
        color="#C5B8AE"
        androidElevation="0"
        fontSize="10"
        @tap="reduce"
      />
    </GridLayout>
    <GridLayout v-if="auditMode" row="5" columns="*,*,*,*" height="32">
      <Button
        text="Snapshot"
        automationText="glass-snapshot"
        fontSize="8"
        androidElevation="0"
        @tap="audit('snapshot')"
      />
      <Button
        col="1"
        text="Midpoint"
        automationText="glass-seek"
        fontSize="8"
        androidElevation="0"
        @tap="seek"
      />
      <Button
        col="2"
        text="Resize"
        automationText="glass-resize"
        fontSize="8"
        androidElevation="0"
        @tap="resize"
      />
      <Button
        col="3"
        text="Reject"
        automationText="glass-invalid"
        fontSize="8"
        androidElevation="0"
        @tap="invalid"
      />
    </GridLayout>
  </GridLayout>
</template>
