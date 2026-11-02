<script setup lang="ts">
import {
  Application,
  File,
  isIOS,
  knownFolders,
  type LayoutBase,
  type ScrollView,
  type View,
} from '@nativescript/core'
import { nextTick, onUnmounted, ref } from 'nativescript-vue'
import { configure, scrollHeader, type ScrollHeader } from '@rafaelaugusto/jolt'
import { reorder, type Reorder, type ReorderMove } from '@rafaelaugusto/jolt/reorder'
import { usePreviewI18n } from '../showcase/i18n'
const { t } = usePreviewI18n()
defineProps<{ embedded?: boolean }>()
defineEmits(['back'])
const scroll = ref(),
  content = ref(),
  header = ref(),
  artwork = ref(),
  title = ref(),
  toolbar = ref(),
  toolbarTitle = ref(),
  section = ref()
const names = [
  'First light',
  'Slow mornings',
  'Golden hour',
  'After the rain',
  'Night drive',
  'Open water',
  'Soft landing',
  'A little further',
]
const items = ref(
  Array.from({ length: 24 }, (_, i) => ({
    key: `song-${i + 1}`,
    title: names[i % names.length]!,
    long: i % 3 === 0,
  })),
)
const status = ref('Hold a handle. Find a new place.'),
  details = ref(false),
  paused = ref(false),
  reduced = ref(false),
  mounted = ref(true)
let controller: ScrollHeader | undefined,
  ordering: Reorder<string> | undefined,
  ended = false,
  loading = false,
  fail = false,
  additions = 0,
  refreshes = 0,
  commits = 0
let timer: ReturnType<typeof setTimeout> | undefined
const events: unknown[] = []
const views = new Map<string, View>(),
  handles = new Map<string, View>()
const rows = () =>
  items.value.map((item) => ({
    key: item.key,
    target: views.get(item.key)!,
    handle: handles.get(item.key)!,
  }))
function audit(event: string, detail?: unknown) {
  events.push({
    event,
    detail,
    time: Date.now(),
    keys: items.value.map((item) => item.key),
    state: controller?.state,
    ready: controller?.ready,
    rows: rows().map((row) => ({
      key: row.key,
      top: row.target?.getLocationRelativeTo(content.value?.nativeView)?.y,
      height: row.target?.getActualSize().height,
      opacity: row.target?.opacity,
      nativeOpacity: isIOS ? row.target?.ios?.alpha : row.target?.android?.getAlpha(),
      rotation: row.target?.rotate,
    })),
    resources: {
      headers: isIOS
        ? JoltScrollHeader.activeCount()
        : org.rafaelaugusto.jolt.ScrollHeader.activeCount(),
      reorders: isIOS
        ? JoltRealizedReorder.activeCount()
        : org.rafaelaugusto.jolt.RealizedReorder.activeCount(),
    },
    refreshes,
    commits,
  })
  const folder = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
  File.fromPath(folder + '/jolt-retained-scroll.json').writeTextSync(
    JSON.stringify({ events }),
  )
}
function rowLoaded(key: string, event: { object: View }) {
  views.set(key, event.object)
  schedule()
}
function handleLoaded(key: string, event: { object: View }) {
  handles.set(key, event.object)
  schedule()
}
function schedule() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    timer = undefined
    void setup()
  }, 120)
}
async function setup() {
  if (
    ended ||
    controller ||
    loading ||
    !mounted.value ||
    !content.value?.nativeView?.isLoaded ||
    rows().some((row) => !row.target?.getActualSize().height || !row.handle?.isLoaded)
  )
    return
  loading = true
  try {
    controller = scrollHeader(scroll.value.nativeView as ScrollView, {
      header: header.value.nativeView,
      artwork: artwork.value.nativeView,
      title: title.value.nativeView,
      toolbar: toolbar.value.nativeView,
      toolbarTitle: toolbarTitle.value.nativeView,
      section: section.value.nativeView,
      items: rows,
      async onRefresh(context) {
        const request = ++refreshes,
          reject = fail
        fail = false
        status.value = 'Refreshing…'
        audit('refresh-start')
        await new Promise((resolve) => setTimeout(resolve, 1400))
        if (context.cancelled) {
          audit('refresh-stale')
          return
        }
        if (reject) throw new Error('Sample refresh failed')
        if (
          await context.commit(async () => {
            items.value = [
              { key: `fresh-${request}`, title: 'A new beginning', long: true },
              ...items.value,
            ]
            await nextTick()
          })
        ) {
          commits++
          status.value = 'Fresh tracks. Your place stays.'
          audit('refresh-commit')
        }
      },
      onRefreshError(error) {
        status.value = 'Could not refresh. Pull to try again.'
        audit('refresh-error', String(error))
      },
      onState(state) {
        audit('phase', state.phase)
      },
    })
    await controller.remeasure()
    ordering = reorder(content.value.nativeView as LayoutBase, {
      items: rows,
      scroll: scroll.value.nativeView,
      onCommit: commit,
      onStart(key) {
        status.value = 'Find a new place. Let go when it feels right.'
        audit('drag-start', key)
      },
      onCancel(event) {
        status.value = 'Order kept. Try another place.'
        audit('drag-cancel', event)
      },
      accessibility: { moveUp: t('Move up'), moveDown: t('Move down') },
    })
    audit('ready')
  } catch (error) {
    status.value = String(error)
    audit('error', String(error))
    ordering?.dispose()
    controller?.dispose()
    controller = undefined
  } finally {
    loading = false
  }
}
function commit(move: ReorderMove<string>) {
  const row = items.value.find((item) => item.key === move.key)!
  const next = items.value.filter((item) => item.key !== move.key)
  next.splice(
    move.beforeKey === null
      ? next.length
      : next.findIndex((item) => item.key === move.beforeKey),
    0,
    row,
  )
  items.value = next
  status.value = 'A good mix. Your own order.'
  void nextTick(async () => {
    await controller?.remeasure()
    audit('move', move)
  })
}
async function add() {
  audit('before-insert')
  await controller?.preserveAnchor(async () => {
    items.value = [
      { key: `new-${++additions}`, title: 'A new beginning', long: false },
      ...items.value,
    ]
    await nextTick()
  })
  status.value = 'A new track. Your place stays.'
  audit('insert')
}
function togglePause() {
  paused.value = !paused.value
  if (paused.value) {
    controller?.pause()
    ordering?.pause()
  } else {
    controller?.play()
    ordering?.play()
  }
  audit('pause', paused.value)
}
function reduce() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
  audit('reduced', reduced.value)
}
function cancel() {
  controller?.cancelRefresh()
  ordering?.cancel()
  audit('cancel')
}
function dispose() {
  ordering?.dispose()
  ordering = undefined
  controller?.dispose()
  controller = undefined
  audit('disposed')
}
function remount() {
  if (mounted.value) {
    dispose()
    mounted.value = false
  } else {
    mounted.value = true
    paused.value = false
    schedule()
  }
}
onUnmounted(() => {
  ended = true
  clearTimeout(timer)
  dispose()
  configure({ reducedMotion: 'user' })
})
</script>
<template>
  <GridLayout rows="*,auto,auto,auto" backgroundColor="#F4F0E7">
    <GridLayout clipToBounds="true">
      <ScrollView
        ref="scroll"
        automationText="retained-scroll"
        scrollBarIndicatorVisible="false"
        @loaded="schedule"
      >
        <StackLayout ref="content" paddingTop="0" paddingBottom="36">
          <GridLayout
            v-for="(item, index) in items"
            :key="item.key"
            columns="44,*,48"
            :minHeight="item.long ? 118 : 88"
            margin="0 18"
            padding="14 8"
            backgroundColor="#F4F0E7"
            borderBottomWidth="1"
            borderColor="#D9DCCC"
            :automationText="item.key"
            @loaded="rowLoaded(item.key, $event)"
          >
            <Label
              :text="String(index + 1).padStart(2, '0')"
              color="#71836C"
              fontSize="15"
              verticalAlignment="middle"
            />
            <StackLayout col="1" verticalAlignment="middle" paddingRight="10">
              <Label
                :text="t(item.title)"
                color="#193D34"
                fontSize="19"
                fontWeight="600"
                textWrap="true"
              />
              <Label
                :text="
                  t(
                    item.long
                      ? 'A little space to slow down.\nStay for one more song.'
                      : 'The weekend sessions.',
                  )
                "
                color="#65745F"
                fontSize="12"
                textWrap="true"
                marginTop="6"
              />
            </StackLayout>
            <ReorderHandle
              col="2"
              text="≡"
              color="#193D34"
              backgroundColor="#E2E8D4"
              borderRadius="14"
              height="48"
              verticalAlignment="middle"
              :automationText="'handle-' + item.key"
              :accessibilityLabel="t('Move {0}').replace('{0}', t(item.title))"
              @loaded="handleLoaded(item.key, $event)"
            />
          </GridLayout>
        </StackLayout>
      </ScrollView>
      <StackLayout
        ref="header"
        accessibilityHidden="false"
        verticalAlignment="top"
        backgroundColor="#193D34"
        isUserInteractionEnabled="false"
      >
        <Image
          ref="artwork"
          src="~/assets/studio/cove.png"
          height="136"
          stretch="aspectFill"
        />
        <StackLayout padding="16 26 24">
          <Label
            text="NOVA / WEEKEND SESSIONS"
            color="#D7EDA8"
            fontSize="10"
            letterSpacing="0.15"
          />
          <Label
            ref="title"
            accessibilityHidden="false"
            accessible="true"
            accessibilityRole="header"
            :text="t('Slow tides.')"
            color="#FFFBEF"
            fontSize="42"
            fontWeight="700"
            marginTop="10"
            textWrap="true"
          />
          <Label
            :text="t('Keep your place. Bring a favorite closer.')"
            color="#E9EFDF"
            fontSize="13"
            marginTop="8"
            textWrap="true"
          />
        </StackLayout>
      </StackLayout>
      <GridLayout
        ref="section"
        columns="*,44"
        height="52"
        verticalAlignment="top"
        backgroundColor="#E2E8D4"
        padding="0 24"
        isPassThroughParentEnabled="true"
      >
        <Label
          :text="t('THE TRACKLIST')"
          color="#193D34"
          fontSize="11"
          letterSpacing="0.12"
          verticalAlignment="middle"
          isUserInteractionEnabled="false"
        />
        <Label
          col="1"
          text="↓"
          fontSize="22"
          color="#193D34"
          verticalAlignment="middle"
          textAlignment="right"
          accessible="true"
          accessibilityRole="button"
          automationText="retained-jump"
          @tap="controller?.scrollToItem(7, true)"
        />
      </GridLayout>
      <GridLayout
        ref="toolbar"
        accessibilityHidden="false"
        columns="*,44"
        height="58"
        verticalAlignment="top"
        padding="0 24"
        backgroundColor="#193D34"
        isPassThroughParentEnabled="true"
      >
        <Label
          ref="toolbarTitle"
          accessibilityHidden="false"
          accessible="true"
          accessibilityRole="header"
          :text="t('Slow tides.')"
          color="#FFFBEF"
          fontSize="21"
          fontWeight="700"
          verticalAlignment="middle"
          isUserInteractionEnabled="false"
        />
        <Label
          col="1"
          text="↑"
          fontSize="22"
          color="#D7EDA8"
          verticalAlignment="middle"
          textAlignment="right"
          accessible="true"
          accessibilityRole="button"
          automationText="retained-top"
          @tap="controller?.scrollToTop(true)"
        />
      </GridLayout>
    </GridLayout>
    <Label
      row="1"
      :text="t(status)"
      color="#536952"
      fontSize="11"
      textWrap="true"
      padding="8 18"
      automationText="retained-status"
    />
    <GridLayout row="2" columns="*,*,44" padding="4 14" backgroundColor="#E7E8D9">
      <Button
        :text="t('Add a track')"
        fontSize="12"
        automationText="retained-add"
        @tap="add"
      />
      <Button
        col="1"
        :text="t('Refresh')"
        fontSize="12"
        automationText="retained-refresh"
        @tap="controller?.refresh()"
      />
      <Button
        col="2"
        text="ⓘ"
        automationText="retained-details"
        @tap="details = !details"
      />
    </GridLayout>
    <StackLayout row="3" v-if="details" padding="4 12" backgroundColor="#E7E8D9">
      <GridLayout columns="*,*,*">
        <Button
          :text="t(paused ? 'Resume' : 'Pause')"
          fontSize="11"
          automationText="retained-pause"
          @tap="togglePause"
        />
        <Button
          col="1"
          :text="t('Reduced Motion')"
          fontSize="11"
          automationText="retained-reduce"
          @tap="reduce"
        />
        <Button
          col="2"
          :text="t(mounted ? 'Dispose' : 'Remount')"
          fontSize="11"
          automationText="retained-remount"
          @tap="remount"
        />
      </GridLayout>
      <GridLayout columns="*,*">
        <Button
          :text="t('Fail next refresh')"
          fontSize="11"
          automationText="retained-fail"
          @tap="fail = true"
        />
        <Button
          col="1"
          :text="t('Cancel')"
          fontSize="11"
          automationText="retained-cancel"
          @tap="cancel"
        />
      </GridLayout>
    </StackLayout>
  </GridLayout>
</template>
