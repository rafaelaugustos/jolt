<script setup lang="ts">
import { File, knownFolders, isIOS, type EventData, type View } from '@nativescript/core'
import { nextTick, onUnmounted, ref } from 'nativescript-vue'
import { configure } from '@rafaelaugusto/jolt'
import {
  sharedLayout,
  type SharedLayout,
  type SharedLayoutResult,
} from '@rafaelaugusto/jolt/shared-layout'
import { usePreviewI18n } from '../showcase/i18n'
import { launchArgument, findView } from '../launch'
const { t } = usePreviewI18n()
defineProps<{ embedded?: boolean }>()
defineEmits(['back'])
const expanded = ref(false),
  tab = ref(0),
  missing = ref(false),
  result = ref(''),
  lastResult = ref(''),
  reduced = ref(false)
const probes = launchArgument('shared-layout-checks') !== undefined
const auditEnabled = probes || launchArgument('shared-layout-audit') !== undefined
let host: View | undefined, control: SharedLayout | undefined
const waiting = new Map<string, { view: View; image: boolean }>()
const results: SharedLayoutResult[] = []
let slowNext = false
let timer: ReturnType<typeof setTimeout> | undefined
function register(event: EventData, key: string, image = false) {
  const view = event.object as View
  if (control)
    control.attach(view, key, {
      content: image ? 'image' : 'container',
      radius: image ? (expanded.value ? 24 : 12) : 2,
    })
  else waiting.set(key, { view, image })
}
function loaded(event: EventData) {
  host = event.object as View
  if (control) return
  control = sharedLayout(host, {
    transition: { type: 'spring', duration: 650, bounce: 0.12 },
    layoutTimeout: 1500,
  })
  for (const [key, entry] of waiting)
    control.attach(entry.view, key, {
      content: entry.image ? 'image' : 'container',
      radius: entry.image ? 12 : 2,
    })
  waiting.clear()
}
function audit() {
  if (!auditEnabled || !host) return
  const views = ['shared-cover', 'shared-underline']
    .map((id) => findView(host!, (view) => view.id === id))
    .filter(Boolean) as View[]
  const data = {
    results,
    active: control?.active,
    expanded: expanded.value,
    nativeActive: isIOS
      ? JoltSharedLayoutFlight.activeCount()
      : org.rafaelaugusto.jolt.SharedLayoutFlight.activeCount(),
    views: views.map((view) => ({
      id: view.id,
      visible: isIOS
        ? !view.nativeViewProtected.hidden
        : view.nativeViewProtected.getVisibility() === 0,
      bounds: view.getLocationInWindow(),
      size: view.getActualSize(),
    })),
  }
  const json = JSON.stringify(data)
  File.fromPath(knownFolders.documents().path + '/jolt-shared-layout.json').writeTextSync(
    json,
  )
  if (!isIOS) {
    const context = host._context
    const folder = context?.getExternalFilesDir(null)
    if (folder)
      File.fromPath(folder.getAbsolutePath() + '/jolt-shared-layout.json').writeTextSync(
        json,
      )
  }
  result.value =
    data.nativeActive === 0 && !data.active && data.views.every((view) => view.visible)
      ? 'Native state clean'
      : 'Native state active'
}
function change(mutate: () => void) {
  if (!control) return
  const animation = control.transition(
    mutate,
    slowNext ? { duration: 3000, ease: 'easeInOut' } : undefined,
  )
  slowNext = false
  void animation.finished.then(async (value) => {
    results.push(value)
    lastResult.value = value.reason || value.status
    await nextTick()
    audit()
  })
}
function toggle() {
  change(() => {
    expanded.value = !expanded.value
    missing.value = false
  })
}
function reverse() {
  toggle()
  timer = setTimeout(() => toggle(), 140)
}
function select(index: number) {
  if (index !== tab.value)
    change(() => {
      tab.value = index
    })
}
function cancelNext() {
  toggle()
  timer = setTimeout(() => control?.cancel(), 120)
}
function remove() {
  change(() => {
    missing.value = true
  })
}
function reset() {
  control?.cancel()
  missing.value = false
  expanded.value = false
  tab.value = 0
  results.length = 0
  void nextTick().then(audit)
}
function reduce() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'never' })
}
onUnmounted(() => {
  if (timer !== undefined) clearTimeout(timer)
  control?.dispose()
  configure({ reducedMotion: 'user' })
})
</script>
<template>
  <GridLayout
    rows="auto,auto,*,auto,auto"
    backgroundColor="#F4F0E7"
    padding="20"
    @loaded="loaded"
  >
    <GridLayout rows="auto,auto" columns="*,auto" marginBottom="18">
      <Label
        :text="t('THE LISTENING ROOM')"
        fontSize="10"
        letterSpacing=".18"
        color="#68786C"
      />
      <Label
        row="1"
        :text="t('A little closer.')"
        fontSize="30"
        fontWeight="bold"
        letterSpacing="-.04"
        color="#213B30"
        marginTop="9"
      />
      <Label
        col="1"
        rowSpan="2"
        text="◉"
        fontSize="40"
        color="#B38C5F"
        verticalAlignment="center"
      />
    </GridLayout>
    <GridLayout row="1" columns="*,*,*" height="48" marginBottom="14">
      <GridLayout rows="*,3" @tap="select(0)" automationText="shared-tab-0"
        ><Label
          :text="t('For you')"
          textWrap="true"
          color="#213B30"
          fontSize="14"
          verticalAlignment="center" /><Label
          v-if="tab === 0"
          id="shared-underline"
          automationText="shared-underline"
          row="1"
          height="3"
          borderRadius="2"
          backgroundColor="#213B30"
          marginRight="22"
          @loaded="register($event, 'tab')"
      /></GridLayout>
      <GridLayout col="1" rows="*,3" @tap="select(1)" automationText="shared-tab-1"
        ><Label
          :text="t('Your collection')"
          textWrap="true"
          color="#213B30"
          fontSize="14"
          verticalAlignment="center" /><Label
          v-if="tab === 1"
          id="shared-underline"
          automationText="shared-underline"
          row="1"
          height="3"
          borderRadius="2"
          backgroundColor="#213B30"
          marginRight="22"
          @loaded="register($event, 'tab')"
      /></GridLayout>
      <GridLayout col="2" rows="*,3" @tap="select(2)" automationText="shared-tab-2"
        ><Label
          :text="t('Slow radio')"
          textWrap="true"
          color="#213B30"
          fontSize="14"
          verticalAlignment="center" /><Label
          v-if="tab === 2"
          id="shared-underline"
          automationText="shared-underline"
          row="1"
          height="3"
          borderRadius="2"
          backgroundColor="#213B30"
          @loaded="register($event, 'tab')"
      /></GridLayout>
    </GridLayout>
    <GridLayout row="2">
      <StackLayout
        v-if="!expanded"
        verticalAlignment="top"
        :marginTop="embedded ? 12 : 24"
      >
        <Label text="01 — 08" color="#9F886B" fontSize="12" letterSpacing=".16" />
        <Label
          :text="t('Room to breathe.')"
          textWrap="true"
          :fontSize="embedded ? 32 : 43"
          fontWeight="bold"
          color="#213B30"
          letterSpacing="-.06"
          marginTop="12"
        />
        <Label
          :text="t('Let the day find its own tempo.')"
          textWrap="true"
          fontSize="15"
          color="#7A8175"
          marginTop="12"
        />
        <Label
          v-if="!embedded"
          text="──────  ◦  ───"
          color="#BEA689"
          fontSize="25"
          marginTop="20"
        />
      </StackLayout>
      <GridLayout
        v-if="!expanded"
        rows="auto"
        columns="70,*,32"
        padding="14"
        borderRadius="23"
        backgroundColor="#E4E7D6"
        verticalAlignment="bottom"
        marginBottom="14"
      >
        <Image
          v-if="!missing"
          id="shared-cover"
          automationText="shared-cover"
          src="~/assets/studio/cove.png"
          width="70"
          height="70"
          stretch="aspectFill"
          borderRadius="12"
          @loaded="register($event, 'cover', true)"
        />
        <StackLayout col="1" verticalAlignment="center" marginLeft="14"
          ><Label
            :text="t('Coastal tapes')"
            color="#213B30"
            fontWeight="bold"
            fontSize="16" /><Label
            :text="t('Side A · Slow mornings')"
            color="#68786C"
            fontSize="11"
            marginTop="5"
        /></StackLayout>
        <Label
          col="2"
          text="↗"
          color="#213B30"
          fontSize="27"
          verticalAlignment="center"
          @tap="toggle"
        />
      </GridLayout>
      <StackLayout
        v-else
        backgroundColor="#E4E7D6"
        borderRadius="28"
        padding="20"
        verticalAlignment="center"
      >
        <Image
          v-if="!missing"
          id="shared-cover"
          automationText="shared-cover"
          src="~/assets/studio/cove.png"
          :width="embedded ? 145 : 195"
          :height="embedded ? 145 : 195"
          stretch="aspectFill"
          borderRadius="24"
          @loaded="register($event, 'cover', true)"
        />
        <Label
          :text="t('Coastal tapes')"
          textAlignment="center"
          :fontSize="embedded ? 21 : 25"
          fontWeight="bold"
          color="#213B30"
          :marginTop="embedded ? 12 : 18"
        />
        <Label
          :text="t('Side A · Slow mornings')"
          textAlignment="center"
          fontSize="12"
          color="#68786C"
          marginTop="5"
        />
        <GridLayout columns="*,auto,*" marginTop="18"
          ><Label
            text="0:42"
            fontSize="10"
            color="#68786C"
            verticalAlignment="center" /><Label
            col="1"
            text="Ⅱ"
            fontSize="28"
            color="#213B30" /><Label
            col="2"
            text="3:18"
            textAlignment="right"
            fontSize="10"
            color="#68786C"
            verticalAlignment="center"
        /></GridLayout>
      </StackLayout>
    </GridLayout>
    <GridLayout row="3" columns="*,*" marginTop="12">
      <Button
        :text="expanded ? t('Small player') : t('Open player')"
        automationText="shared-toggle"
        backgroundColor="#213B30"
        color="#F4F0E7"
        borderRadius="22"
        height="46"
        fontSize="12"
        marginRight="4"
        @tap="toggle"
      />
      <Button
        col="1"
        :text="t('Change your mind')"
        automationText="shared-reverse"
        backgroundColor="#E9DDC9"
        color="#213B30"
        borderRadius="22"
        height="46"
        fontSize="12"
        marginLeft="4"
        @tap="reverse"
      />
    </GridLayout>
    <StackLayout row="4">
      <GridLayout v-if="probes" columns="*,auto" height="30">
        <Label :text="lastResult" fontSize="10" verticalAlignment="center" />
        <Button
          col="1"
          text="Slow next"
          @tap="slowNext = true"
          fontSize="10"
          height="30"
        />
      </GridLayout>
      <Label
        :text="t('One cover. Every version of your day.')"
        textAlignment="center"
        fontSize="10"
        color="#7A8175"
        marginTop="12"
      />
      <GridLayout v-if="probes" rows="auto,auto" columns="*,*,*" marginTop="8">
        <Button text="Cancel" @tap="cancelNext" fontSize="10" height="30" />
        <Button col="1" text="Remove target" @tap="remove" fontSize="10" height="30" />
        <Button col="2" text="Reset" @tap="reset" fontSize="10" height="30" />
        <Button row="1" text="Reduce motion" @tap="reduce" fontSize="10" height="30" />
        <Button
          row="1"
          col="1"
          text="Verify native"
          @tap="audit"
          fontSize="10"
          height="30"
        />
        <Label
          row="1"
          col="2"
          :text="result"
          fontSize="8"
          textWrap="true"
          verticalAlignment="center"
        />
      </GridLayout>
    </StackLayout>
  </GridLayout>
</template>
