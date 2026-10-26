<script setup lang="ts">
import {
  Application,
  File,
  isIOS,
  knownFolders,
  type View,
  type EventData,
} from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { configure, motionScope, type PlaybackAnimation } from '@rafaelaugusto/jolt'
import { blur, type Blur } from '@rafaelaugusto/jolt/blur'
import { launchArgument } from '../launch'
import { usePreviewI18n } from '../showcase/i18n'
const { t } = usePreviewI18n()
defineProps<{ embedded?: boolean }>()
const root = ref(),
  paused = ref(false),
  reduced = ref(false),
  level = ref(0),
  compact = ref(false)
const scope = motionScope(),
  auditMode = launchArgument('blur-audit') !== undefined
let effect: Blur | undefined,
  handle: PlaybackAnimation | undefined,
  content: View | undefined,
  ended = false
const events: object[] = []
function audit(name: string, error?: string) {
  if (!auditMode) return
  const Native = isIOS
    ? (global as any).JoltBlur
    : (global as any).org.rafaelaugusto.jolt.BlurEffect
  events.push({
    name,
    error,
    time: Date.now(),
    level: level.value,
    paused: paused.value,
    reduced: reduced.value,
    resources: scope.size,
    live: Native.liveCount(),
    active: Native.activeCount(),
    bounds: content
      ? { ...content.getLocationOnScreen(), ...content.getActualSize() }
      : null,
    ...effect?.snapshot(),
  })
  const folder = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null).getAbsolutePath()
  File.fromPath(folder + '/blur-audit.json').writeTextSync(
    JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }, null, 2),
  )
}
function layout() {
  if (ended || effect) return
  const host: View = root.value?.nativeView
  content = host?.getViewById('blur-content')
  if (
    !content?.isLoaded ||
    !content.nativeViewProtected ||
    content.getActualSize().width <= 0
  )
    return
  effect = scope.add(blur(content, { radius: 24, style: 'light' }))
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  audit('created')
}
function clipPhoto(event: EventData) {
  if (isIOS) return
  const native = (event.object as View).nativeViewProtected as android.view.View
  const background = new android.graphics.drawable.GradientDrawable()
  background.setColor(android.graphics.Color.parseColor('#527A79'))
  background.setCornerRadius(22 * native.getResources().getDisplayMetrics().density)
  native.setBackground(background)
  native.setOutlineProvider(android.view.ViewOutlineProvider.BACKGROUND)
  native.setClipToOutline(true)
}
function change(value: number) {
  audit('before-change')
  level.value = value
  paused.value = false
  handle = effect?.animate(value, {
    duration: auditMode ? 1800 : 1300,
    ease: auditMode ? 'linear' : 'easeInOut',
  })
  audit('change')
}
function drift() {
  effect?.set(0)
  level.value = 1
  paused.value = false
  handle = effect?.animate(1, {
    duration: auditMode ? 650 : 2000,
    delay: auditMode ? 1500 : 0,
    repeat: 1,
    repeatType: 'reverse',
    ease: 'easeInOut',
  })
  audit('drift')
}
function pause() {
  paused.value = !paused.value
  paused.value ? handle?.pause() : handle?.play()
  audit(paused.value ? 'pause' : 'play')
}
function reduce() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
  audit('reduced')
}
function seek() {
  handle?.pause()
  if (handle) handle.progress = 0.5
  paused.value = true
  audit('midpoint')
}
function invalid() {
  try {
    effect?.animate(2)
  } catch (e) {
    audit('rejected', String(e))
  }
}
function resize() {
  compact.value = !compact.value
  audit('resize')
}
function reset() {
  effect?.set(0)
  level.value = 0
  paused.value = false
  audit('reset')
}
const suspend = () => audit('background'),
  resume = () => audit('foreground')
onUnmounted(() => {
  ended = true
  scope.dispose()
  audit('disposed')
  Application.off(Application.suspendEvent, suspend)
  Application.off(Application.resumeEvent, resume)
  configure({ reducedMotion: 'user' })
})
</script>
<template>
  <GridLayout
    ref="root"
    rows="auto,*,auto,auto,auto,auto"
    backgroundColor="#203A39"
    borderRadius="28"
    padding="16"
    automationText="blur-lab"
    @layoutChanged="layout"
  >
    <GridLayout columns="*,auto" margin="3,4,14,4">
      <StackLayout>
        <Label text="L E N T O" color="#E8D6AD" fontSize="14" fontWeight="bold" />
        <Label
          :text="t('A little less world. A little more you.')"
          color="#AFC4BC"
          fontSize="11"
          marginTop="4"
        />
      </StackLayout>
      <Label col="1" text="◌" color="#E8D6AD" fontSize="30" verticalAlignment="center" />
    </GridLayout>
    <GridLayout
      row="1"
      :width="compact ? 240 : 'auto'"
      borderRadius="22"
      backgroundColor="#527A79"
      clipToBounds="true"
      minHeight="220"
      @loaded="clipPhoto"
    >
      <GridLayout
        id="blur-content"
        automationText="blur-content"
        borderRadius="22"
        clipToBounds="true"
      >
        <Image src="~/assets/studio/cove.png" stretch="aspectFill" />
        <GridLayout backgroundColor="#152D3428" />
        <StackLayout verticalAlignment="top" margin="24,20,0,20">
          <Label
            text="40° 37′ N / 14° 29′ E"
            color="#F8F3E5"
            fontSize="9"
            letterSpacing=".08"
          />
          <Label
            :text="t('Somewhere\nslower.')"
            color="#FFF8E9"
            fontSize="42"
            fontWeight="bold"
            lineHeight="-4"
            marginTop="12"
            textWrap="true"
          />
        </StackLayout>
        <StackLayout verticalAlignment="bottom" margin="0,20,22,20">
          <GridLayout height="1" backgroundColor="#FFFFFF88" marginBottom="12" />
          <Label
            :text="t('A POSTCARD FROM THE QUIET')"
            color="#FFF8E9"
            fontSize="9"
            letterSpacing=".10"
          />
          <Label text="AMALFI / 07:24" color="#FFF8E9" fontSize="13" marginTop="5" />
        </StackLayout>
      </GridLayout>
      <GridLayout
        verticalAlignment="bottom"
        horizontalAlignment="right"
        margin="0,0,12,12"
        width="34"
        height="34"
        borderRadius="17"
        backgroundColor="#F6EAD4"
      >
        <Label
          text="↗"
          color="#203A39"
          fontSize="20"
          textAlignment="center"
          verticalAlignment="center"
        />
      </GridLayout>
    </GridLayout>
    <StackLayout row="2" margin="16,5,12,5">
      <Label
        :text="
          t(level === 0 ? 'Every detail. Nothing to hurry.' : 'Less noise. More here.')
        "
        color="#F4ECD9"
        fontSize="19"
        fontWeight="bold"
      />
      <Label
        :text="t('Choose how much of the world to let in.')"
        color="#AFC4BC"
        fontSize="11"
        marginTop="5"
      />
    </StackLayout>
    <GridLayout row="3" columns="*,*,*" height="44">
      <Button
        androidElevation="0"
        :text="t('Clear')"
        automationText="blur-clear"
        :backgroundColor="level === 0 ? '#E8D6AD' : '#355150'"
        :color="level === 0 ? '#203A39' : '#E8E4D9'"
        borderRadius="15"
        margin="2"
        fontSize="12"
        @tap="change(0)"
      />
      <Button
        androidElevation="0"
        col="1"
        :text="t('Soft')"
        automationText="blur-soft"
        :backgroundColor="level === 0.45 ? '#E8D6AD' : '#355150'"
        :color="level === 0.45 ? '#203A39' : '#E8E4D9'"
        borderRadius="15"
        margin="2"
        fontSize="12"
        @tap="change(0.45)"
      />
      <Button
        androidElevation="0"
        col="2"
        :text="t('Dreamy')"
        automationText="blur-full"
        :backgroundColor="level === 1 ? '#E8D6AD' : '#355150'"
        :color="level === 1 ? '#203A39' : '#E8E4D9'"
        borderRadius="15"
        margin="2"
        fontSize="12"
        @tap="change(1)"
      />
    </GridLayout>
    <GridLayout row="4" columns="*,*,*" height="40" marginTop="6">
      <Button
        androidElevation="0"
        :text="t('Drift')"
        automationText="blur-drift"
        backgroundColor="transparent"
        color="#AFC4BC"
        fontSize="11"
        @tap="drift"
      />
      <Button
        androidElevation="0"
        col="1"
        :text="t(paused ? 'Resume' : 'Pause')"
        automationText="blur-pause"
        backgroundColor="transparent"
        color="#AFC4BC"
        fontSize="11"
        @tap="pause"
      />
      <Button
        androidElevation="0"
        col="2"
        :text="t(reduced ? 'Restore motion' : 'Reduce motion')"
        automationText="blur-reduce"
        backgroundColor="transparent"
        color="#AFC4BC"
        fontSize="10"
        @tap="reduce"
      />
    </GridLayout>
    <GridLayout v-if="auditMode" row="5" columns="*,*,*,*,*" height="32">
      <Button
        androidElevation="0"
        text="Snapshot"
        automationText="blur-snapshot"
        fontSize="8"
        @tap="audit('snapshot')"
      />
      <Button
        androidElevation="0"
        col="1"
        text="Midpoint"
        automationText="blur-seek"
        fontSize="8"
        @tap="seek"
      />
      <Button
        androidElevation="0"
        col="2"
        text="Resize"
        automationText="blur-resize"
        fontSize="8"
        @tap="resize"
      />
      <Button
        androidElevation="0"
        col="3"
        text="Reject"
        automationText="blur-invalid"
        fontSize="8"
        @tap="invalid"
      />
      <Button
        androidElevation="0"
        col="4"
        text="Reset"
        automationText="blur-reset"
        fontSize="8"
        @tap="reset"
      />
    </GridLayout>
  </GridLayout>
</template>
