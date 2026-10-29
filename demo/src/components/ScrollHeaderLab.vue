<script setup lang="ts">
import {
  Application,
  File,
  ImageSource,
  isIOS,
  knownFolders,
  type EventData,
  type ItemEventData,
  type LayoutBase,
  type ListView,
} from '@nativescript/core'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onUnmounted,
  ref,
  shallowRef,
} from 'nativescript-vue'
import { configure, scrollHeader, type ScrollHeader } from '@rafaelaugusto/jolt'
import { usePreviewI18n } from '../showcase/i18n'
import { loadAlbumCell, type AlbumTrack } from '../showcase/scroll-header-cells'
import { launchArgument } from '../launch'
const { t } = usePreviewI18n()
defineProps<{ embedded?: boolean }>()
defineEmits(['back'])
const header = ref(),
  artwork = ref(),
  title = ref(),
  toolbar = ref(),
  toolbarTitle = ref(),
  section = ref(),
  diagnostic = ref()
const names = [
  'First light',
  'Slow tides',
  'Salt in the air',
  'A softer place',
  'Blue hour',
  'Where we belong',
  'Far from the noise',
  'Stay a little longer',
]
const original = (): AlbumTrack[] =>
  Array.from({ length: 80 }, (_, i) => ({
    key: 'song-' + (i + 1),
    title: names[i % names.length]!,
    duration: `${3 + (i % 3)}:${String(10 + (i % 49)).padStart(2, '0')}`,
  }))
const tracks = shallowRef(original()),
  space = ref(376),
  rows = computed(() => [
    { key: 'header', title: '', duration: '', spacer: true },
    ...tracks.value,
  ])
const cover = shallowRef<string | ImageSource>('~/assets/studio/cove.png'),
  bigger = ref(false),
  coverHeight = ref(136),
  album = ref('Slow tides.'),
  status = ref('A little room to drift.'),
  debug = ref(false),
  reduced = ref(false)
const auditEnabled = launchArgument('scroll-header-audit') !== undefined
let list: ListView | undefined,
  owner: ScrollHeader | undefined,
  disposed = false,
  additions = 0,
  rowTaps = 0
const events: object[] = []
function audit(name: string, extra?: unknown) {
  if (!auditEnabled) return
  const state = owner?.state,
    g = owner?.geometry
  const pose = (ref: any) => {
    const view = ref.value?.nativeView?.nativeViewProtected
    if (!view) return undefined
    return isIOS
      ? {
          y: view.layer.transform.m42,
          scale: view.layer.transform.m22,
          opacity: view.layer.opacity,
        }
      : {
          y:
            view.getTranslationY() /
            Application.android.context.getResources().getDisplayMetrics().density,
          scale: view.getScaleY(),
          opacity: view.getAlpha(),
        }
  }
  const nativeRows: { key: string; top: number; height: number }[] = []
  if (list?.nativeViewProtected && state && g) {
    if (isIOS) {
      const table = list.ios as UITableView
      const paths = table.indexPathsForVisibleRows
      for (let i = 0; paths && i < paths.count; i++) {
        const path = paths.objectAtIndex(i),
          rect = table.rectForRowAtIndexPath(path)
        nativeRows.push({
          key: path.row === 0 ? 'header' : (tracks.value[path.row - 1]?.key ?? '?'),
          top: rect.origin.y - table.contentOffset.y,
          height: rect.size.height,
        })
      }
    } else {
      const table = list.android as android.widget.ListView,
        density = Application.android.context.getResources().getDisplayMetrics().density
      for (let i = 0; i < table.getChildCount(); i++) {
        const index = table.getFirstVisiblePosition() + i,
          view = table.getChildAt(i)
        nativeRows.push({
          key: index === 0 ? 'header' : (tracks.value[index - 1]?.key ?? '?'),
          top: view.getTop() / density,
          height: view.getHeight() / density,
        })
      }
    }
  }
  events.push({
    name,
    time: Date.now(),
    state,
    geometry: g,
    ready: owner?.ready ?? false,
    viewport: list?.getActualSize(),
    headerHeight: header.value?.nativeView?.getActualSize().height,
    decelerating: isIOS
      ? (list?.ios as UITableView | undefined)?.decelerating
      : undefined,
    rowTaps,
    extra,
    rows: nativeRows,
    poses: {
      header: pose(header),
      artwork: pose(artwork),
      section: pose(section),
      toolbar: pose(toolbar),
    },
  })
  const directory = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
  const native = isIOS ? undefined : (org.rafaelaugusto.jolt as any)
  const report = JSON.stringify({
    events,
    resources: {
      sources: isIOS ? JoltScrollHeader.activeCount() : native.ScrollHeader.activeCount(),
      nodes: isIOS ? JoltLiveSpring.nodeCount() : native.LiveSpring.nodeCount(),
    },
  })
  File.fromPath(directory + '/jolt-scroll-header.json').writeTextSync(report)
  if (name === 'disposed')
    File.fromPath(directory + '/jolt-scroll-header-disposed.json').writeTextSync(report)
}
function loaded(event: EventData) {
  list = event.object as ListView
  list.itemTemplateSelector = (item: AlbumTrack) => (item.spacer ? 'spacer' : 'track')
  list.itemTemplates = [
    { key: 'spacer', createView: () => undefined },
    { key: 'track', createView: () => undefined },
  ]
  void nextTick(setup)
}
function setup() {
  if (disposed || !list?.isLoaded || owner) return
  owner = scrollHeader(list, {
    header: header.value.nativeView,
    artwork: artwork.value.nativeView,
    title: title.value.nativeView,
    toolbar: toolbar.value.nativeView,
    toolbarTitle: toolbarTitle.value.nativeView,
    section: section.value.nativeView,
    rowHeight: 76,
    originalSpacerHeight: space.value,
    diagnostic: diagnostic.value.nativeView,
    setSpacerHeight(height) {
      space.value = height
      list?.refresh()
    },
    keys: () => tracks.value.map((item) => item.key),
    onState: (state) => audit('phase', state.phase),
  })
  void owner
    .remeasure()
    .then(() => audit('ready'))
    .catch((error) => {
      if (!disposed) audit('error', String(error))
    })
}
function cell(event: ItemEventData) {
  loadAlbumCell(event, space.value, t, (key) => {
    rowTaps++
    const track = tracks.value.find((item) => item.key === key)
    status.value = t('Playing {0}').replace('{0}', t(track?.title ?? 'Slow tides'))
    audit('tap', key)
  })
}
async function changeCover() {
  const next = !bigger.value
  status.value = 'Finding another horizon…'
  const image = await ImageSource.fromFile(
    knownFolders.currentApp().path +
      '/assets/studio/' +
      (next ? 'dunes.png' : 'cove.png'),
  )
  if (disposed) return
  cover.value = image
  bigger.value = next
  coverHeight.value = next ? 204 : 136
  album.value = next ? 'Wide open\nhorizons.' : 'Slow tides.'
  await nextTick()
  await owner?.remeasure()
  status.value = 'Same place. A new perspective.'
  audit('cover')
}
async function addTrack() {
  await owner?.preserveAnchor(async () => {
    tracks.value = [
      { key: 'new-' + ++additions, title: 'A new beginning', duration: '4:08' },
      ...tracks.value,
    ]
    await nextTick()
  })
  status.value = 'A new track. Your place stays.'
  audit('insert')
}
function top() {
  owner?.scrollToTop(true)
  audit('top-request')
}
function jump() {
  owner?.scrollToItem(35, true)
  audit('jump-request')
}
function toggleMotion() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
  audit('reduced')
}
async function resetRows(empty = false) {
  await owner?.preserveAnchor(async () => {
    tracks.value = empty ? [] : original().slice(0, 2)
    await nextTick()
  })
  audit(empty ? 'empty' : 'short')
}
function snapshot() {
  audit('snapshot')
}
async function reloadList() {
  if (!auditEnabled || !list || !owner?.ready) return
  audit('reload-before')
  const view = list,
    parent = view.parent as LayoutBase,
    index = parent.getChildIndex(view)
  // Real native unload/load while a public layout request is outstanding.
  const pending = owner.remeasure().catch((error) => String(error))
  parent.removeChild(view)
  parent.insertChild(view, index)
  await pending
  const deadline = Date.now() + 2000
  while (!disposed && !owner?.ready && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 20))
  if (!disposed) audit('reload-after')
}
onBeforeUnmount(() => audit('leaving'))
onUnmounted(() => {
  disposed = true
  owner?.dispose()
  audit('disposed')
  owner = undefined
  configure({ reducedMotion: 'user' })
})
</script>
<template>
  <GridLayout rows="*,54,auto,auto" backgroundColor="#F4F0E7">
    <GridLayout row="0" clipToBounds="true">
      <ScrollHeaderList
        :items="rows"
        @loaded="loaded"
        @itemLoading="cell"
        separatorColor="transparent"
        backgroundColor="#F4F0E7"
        iosEstimatedRowHeight="76"
        automationText="scroll-header-list"
      />
      <StackLayout
        ref="header"
        verticalAlignment="top"
        isUserInteractionEnabled="false"
        isPassThroughParentEnabled="true"
        automationText="scroll-header-hero"
        backgroundColor="#193D34"
      >
        <GridLayout
          :height="coverHeight"
          :clipToBounds="!isIOS"
          isPassThroughParentEnabled="true"
        >
          <Image
            ref="artwork"
            isUserInteractionEnabled="false"
            :src="cover"
            stretch="aspectFill"
          />
        </GridLayout>
        <StackLayout
          padding="18 26 24"
          backgroundColor="#193D34"
          isPassThroughParentEnabled="true"
        >
          <Label
            isUserInteractionEnabled="false"
            :text="t('NOVA / A STUDIO ORIGINAL')"
            color="#D7EDA8"
            fontSize="10"
            letterSpacing="0.16"
          />
          <Label
            isUserInteractionEnabled="false"
            ref="title"
            :text="t(album)"
            color="#FFFBEF"
            fontSize="45"
            fontWeight="700"
            textWrap="true"
            marginTop="10"
            accessibilityRole="header"
          />
          <Label
            isUserInteractionEnabled="false"
            :text="t('A soundtrack for taking your time.')"
            color="#E9EFDF"
            fontSize="13"
            marginTop="10"
          />
        </StackLayout>
      </StackLayout>
      <GridLayout
        ref="section"
        isPassThroughParentEnabled="true"
        height="56"
        columns="*,auto"
        padding="0 24"
        backgroundColor="#F4F0E7"
        verticalAlignment="top"
        translateY="320"
        automationText="scroll-header-section"
      >
        <Label
          isUserInteractionEnabled="false"
          :text="t('THE TRACKLIST')"
          color="#193D34"
          fontSize="11"
          letterSpacing="0.12"
          verticalAlignment="middle"
          accessibilityRole="header"
        />
        <Label
          col="1"
          text="↓"
          color="#193D34"
          width="40"
          fontSize="24"
          verticalAlignment="middle"
          textAlignment="right"
          accessibilityRole="button"
          :accessibilityLabel="t('Jump to a later track')"
          automationText="scroll-header-jump"
          @tap="jump"
        />
      </GridLayout>
      <GridLayout
        ref="toolbar"
        isPassThroughParentEnabled="true"
        height="58"
        columns="*,auto"
        padding="0 24"
        verticalAlignment="top"
        backgroundColor="#193D34"
        automationText="scroll-header-toolbar"
      >
        <Label
          ref="toolbarTitle"
          isUserInteractionEnabled="false"
          :text="t(album).replace('\n', ' ')"
          color="#FFFBEF"
          fontSize="20"
          fontWeight="700"
          verticalAlignment="middle"
        />
        <Label
          col="1"
          text="↑"
          color="#D7EDA8"
          width="40"
          fontSize="28"
          textAlignment="right"
          verticalAlignment="middle"
          accessibilityRole="button"
          :accessibilityLabel="t('Back to the cover')"
          automationText="scroll-header-top"
          @tap="top"
        />
      </GridLayout>
    </GridLayout>
    <GridLayout row="1" columns="*,*,auto" padding="8 16" backgroundColor="#E7E8D9">
      <Label
        :text="t('New cover')"
        automationText="scroll-header-cover"
        color="#193D34"
        fontSize="12"
        fontWeight="600"
        padding="10"
        accessibilityRole="button"
        textAlignment="center"
        @tap="changeCover"
      />
      <Label
        col="1"
        :text="t('Add a track')"
        automationText="scroll-header-add"
        color="#193D34"
        fontSize="12"
        fontWeight="600"
        padding="10"
        accessibilityRole="button"
        textAlignment="center"
        @tap="addTrack"
      />
      <Label
        col="2"
        text="ⓘ"
        fontSize="22"
        color="#193D34"
        width="42"
        textAlignment="center"
        accessibilityRole="button"
        :accessibilityLabel="t('Show motion details')"
        automationText="scroll-header-details"
        @tap="debug = !debug"
      />
    </GridLayout>
    <StackLayout
      row="2"
      :visibility="debug ? 'visible' : 'collapse'"
      backgroundColor="#E7E8D9"
      padding="0 18 10"
    >
      <Label
        ref="diagnostic"
        text=""
        color="#536952"
        fontSize="10"
        automationText="scroll-header-diagnostic"
      />
      <Label
        :text="t(status)"
        color="#193D34"
        fontSize="11"
        marginTop="4"
        automationText="scroll-header-status"
      />
    </StackLayout>
    <GridLayout v-if="auditEnabled" row="3" columns="*,*,*,*,*" height="40">
      <Label text="Snapshot" automationText="scroll-header-snapshot" @tap="snapshot" />
      <Label
        col="1"
        text="Reduce"
        automationText="scroll-header-reduce"
        @tap="toggleMotion"
      />
      <Label
        col="2"
        text="Short"
        automationText="scroll-header-short"
        @tap="resetRows(false)"
      />
      <Label
        col="3"
        text="Empty"
        automationText="scroll-header-empty"
        @tap="resetRows(true)"
      />
      <Label
        col="4"
        text="Reload"
        automationText="scroll-header-reload"
        @tap="reloadList"
      />
    </GridLayout>
  </GridLayout>
</template>
