<script setup lang="ts">
import {
  Application,
  isIOS,
  knownFolders,
  type EventData,
  type ListView,
} from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { configure } from '@rafaelaugusto/jolt'
import { reorder, type Reorder, type ReorderMove } from '@rafaelaugusto/jolt/reorder'
import { launchArgument } from '../launch'

defineProps<{ embedded?: boolean }>()
defineEmits(['back'])
type Track = {
  id: string
  title: string
  note: string
  color: string
  glyph: string
  height: number
}
const titles = [
  'First light',
  'Slow mornings',
  'Golden hour',
  'After the rain',
  'Night drive',
  'Open water',
  'Soft landing',
  'A little further',
]
const colors = ['#D9E6B1', '#C4B5E5', '#E5B797', '#B0CFC4']
const tracks = () =>
  Array.from({ length: 200 }, (_, i): Track => ({
    id: `track-${i + 1}`,
    title: `${titles[i % titles.length]}`,
    note:
      i % 3 === 0
        ? 'A little space to slow down.\nStay for one more song.'
        : i % 3 === 1
          ? 'Something good is on its way.'
          : 'The weekend sessions.',
    color: colors[i % colors.length]!,
    glyph: ['✦', '◉', '↗', '◒'][i % 4]!,
    height: i % 3 === 0 ? 112 : 92,
  }))
const items = ref(tracks()),
  status = ref('A good mix. Your own order.'),
  selected = ref('track-1'),
  active = ref('')
const probes = launchArgument('reorder-checks') !== undefined
const armed = ref(''),
  reduced = ref(false),
  nativeResult = ref('')
let list: ListView | undefined, control: Reorder<string> | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let moves: ReorderMove<string>[] = [],
  cancellations: unknown[] = []

function audit() {
  if (!probes || !list) return
  const native = list.nativeViewProtected
  const cells: { index: number; alpha: number; offset: number }[] = []
  if (isIOS && native) {
    const table = native as UITableView
    for (let i = 0; i < table.visibleCells.count; i++) {
      const cell = table.visibleCells.objectAtIndex(i)
      cells.push({
        index: table.indexPathForCell(cell)?.row ?? -1,
        alpha: cell.alpha,
        offset: cell.transform.ty,
      })
    }
  } else if (native) {
    const table = native as android.widget.ListView
    for (let i = 0; i < table.getChildCount(); i++) {
      const cell = table.getChildAt(i)
      cells.push({
        index: table.getFirstVisiblePosition() + i,
        alpha: cell.getAlpha(),
        offset: cell.getTranslationY(),
      })
    }
  }
  knownFolders
    .documents()
    .getFile('jolt-reorder.json')
    .writeTextSync(
      JSON.stringify({
        platform: isIOS ? 'ios' : 'android',
        keys: items.value.map((item) => item.id),
        active: control?.activeKey ?? null,
        moves,
        cancellations,
        cells,
        result: nativeResult.value,
      }),
    )
}
function commit(move: ReorderMove<string>) {
  const row = items.value.find((item) => item.id === move.key)!
  const next = items.value.filter((item) => item.id !== move.key)
  next.splice(
    move.beforeKey === null
      ? next.length
      : next.findIndex((item) => item.id === move.beforeKey),
    0,
    row,
  )
  items.value = next
  selected.value = move.key
  active.value = ''
  moves.push(move)
  status.value = `${row.title} · position ${move.toIndex + 1}`
  list?.accessibilityAnnouncement(status.value)
  setTimeout(audit, 150)
}
function loaded(event: EventData) {
  control?.dispose()
  list = event.object as ListView
  control = reorder<Track, string>(list, {
    key: (item) => item.id,
    handle: 'dragHandle',
    onCommit: commit,
    onStart(key) {
      active.value = key
      selected.value = key
      status.value = 'Find a new place. Let go when it feels right.'
      if (armed.value) {
        const action = armed.value
        timer = setTimeout(() => {
          if (action === 'remove')
            items.value = items.value.filter((item) => item.id !== key)
          else if (action === 'cancel') control?.cancel()
          else if (action === 'resize' && list) list.height = 320
          armed.value = ''
          timer = undefined
          setTimeout(audit, 150)
        }, 900)
      }
      audit()
    },
    onCancel(event) {
      active.value = ''
      cancellations.push(event)
      status.value =
        event.reason === 'unchanged'
          ? 'Right where it belongs.'
          : 'Order kept. Try another place.'
      setTimeout(audit, 150)
    },
  })
  setTimeout(audit, 250)
}
function reset() {
  control?.cancel()
  items.value = tracks()
  selected.value = 'track-1'
  moves = []
  cancellations = []
  armed.value = ''
  if (list) {
    list.height = 'auto'
    list.scrollToIndex(0)
  }
  status.value = 'A good mix. Your own order.'
  setTimeout(audit, 200)
}
function select(id: string) {
  selected.value = id
  status.value = `${items.value.find((item) => item.id === id)?.title} · selected`
}
function reduce() {
  reduced.value = !reduced.value
  configure({ reducedMotion: reduced.value ? 'always' : 'user' })
}
function verify() {
  audit()
  const report = JSON.parse(
    knownFolders.documents().getFile('jolt-reorder.json').readTextSync(),
  )
  nativeResult.value =
    report.cells.every(
      (cell: { alpha: number; offset: number }) =>
        Math.abs(cell.alpha - 1) < 0.001 && Math.abs(cell.offset) < 0.001,
    ) &&
    report.active === null &&
    new Set(report.keys).size === report.keys.length
      ? 'Native state clean'
      : 'Native state failed'
  audit()
}
function background() {
  setTimeout(audit, 100)
}
Application.on(Application.resumeEvent, background)
onUnmounted(() => {
  if (timer !== undefined) clearTimeout(timer)
  control?.dispose()
  Application.off(Application.resumeEvent, background)
  configure({ reducedMotion: 'user' })
})
</script>

<template>
  <GridLayout rows="auto,auto,*,auto,auto" backgroundColor="#F6F5F0" padding="0 12 12">
    <GridLayout v-if="!embedded" columns="44,*,44" margin="12 8 14">
      <Label
        text="←"
        fontSize="26"
        color="#26382D"
        @tap="$emit('back')"
        accessibilityRole="button"
        accessibilityLabel="Back"
      />
      <Label
        col="1"
        text="THE WEEKEND EDIT"
        fontSize="10"
        letterSpacing=".16"
        color="#78816F"
        textAlignment="center"
        verticalAlignment="middle"
      />
      <Image col="2" src="~/assets/jolt-mark.png" width="26" height="30" />
    </GridLayout>
    <StackLayout row="1" margin="6 10 20">
      <Label
        text="Your rhythm. Your order."
        fontSize="27"
        fontWeight="bold"
        letterSpacing="-.04"
        color="#202A22"
        textWrap="true"
      />
      <GridLayout columns="*,auto" marginTop="10">
        <Label
          text="Hold a handle. Make room for a favourite."
          fontSize="12"
          color="#79806E"
          textWrap="true"
        />
        <Label
          col="1"
          :text="`${items.length} TRACKS`"
          fontSize="9"
          color="#66774E"
          marginLeft="12"
          verticalAlignment="middle"
        />
      </GridLayout>
    </StackLayout>
    <ListView
      row="2"
      :items="items"
      backgroundColor="#E8EBDD"
      borderRadius="24"
      separatorColor="transparent"
      iosEstimatedRowHeight="100"
      @loaded="loaded"
      automationText="reorder-list"
    >
      <template #default="{ item }">
        <GridLayout
          columns="50,*,48"
          :height="item.height"
          padding="14 12"
          margin="4 8"
          backgroundColor="#22372B"
          borderRadius="20"
        >
          <Label
            :text="item.glyph"
            :backgroundColor="item.color"
            color="#27382C"
            width="44"
            height="48"
            borderRadius="14"
            fontSize="25"
            textAlignment="center"
            verticalAlignment="middle"
          />
          <StackLayout col="1" margin="0 10" verticalAlignment="middle">
            <Label :text="item.title" color="#F2F1E5" fontSize="16" fontWeight="bold" />
            <Label
              :text="item.note"
              color="#A2B29A"
              fontSize="10"
              marginTop="7"
              textWrap="true"
            />
          </StackLayout>
          <ReorderHandle
            id="dragHandle"
            col="2"
            text="☷"
            fontSize="27"
            width="44"
            height="52"
            borderRadius="14"
            backgroundColor="#324B38"
            color="#DAEAAD"
            padding="0"
            verticalAlignment="middle"
            :automationText="`handle-${item.id}`"
            :accessibilityLabel="`Reorder ${item.title}, track ${item.id.slice(6)}`"
            accessibilityHint="Hold and drag, or use move up and move down. Option or Alt plus arrow keys also moves this track."
            @tap="select(item.id)"
          />
        </GridLayout>
      </template>
    </ListView>
    <StackLayout row="3" margin="14 6 0">
      <Label
        :text="status"
        color="#66725C"
        fontSize="12"
        textWrap="true"
        margin="0 4 10"
        automationText="reorder-status"
      />
      <GridLayout columns="*,*,*">
        <Button
          text="↑ Move up"
          class="button"
          backgroundColor="#DCE7C8"
          color="#294331"
          @tap="control?.moveUp(selected)"
          automationText="reorder-up"
        />
        <Button
          col="1"
          text="↓ Move down"
          class="button"
          backgroundColor="#DCE7C8"
          color="#294331"
          @tap="control?.moveDown(selected)"
          automationText="reorder-down"
        />
        <Button
          col="2"
          text="Start over"
          class="button"
          backgroundColor="#EAE6DC"
          color="#736A57"
          @tap="reset"
          automationText="reorder-reset"
        />
      </GridLayout>
    </StackLayout>
    <StackLayout v-if="probes" row="4">
      <GridLayout columns="*,*,*">
        <Button text="Cancel next" class="button" @tap="armed = 'cancel'" />
        <Button col="1" text="Remove next" class="button" @tap="armed = 'remove'" />
        <Button col="2" text="Resize next" class="button" @tap="armed = 'resize'" />
      </GridLayout>
      <GridLayout columns="*,*">
        <Button
          :text="reduced ? 'Reduced on' : 'Reduce motion'"
          class="button"
          @tap="reduce"
        />
        <Button col="1" text="Verify native" class="button" @tap="verify" />
      </GridLayout>
      <Label :text="nativeResult" fontSize="10" color="#344F31" textAlignment="center" />
    </StackLayout>
  </GridLayout>
</template>
