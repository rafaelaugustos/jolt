<script setup lang="ts">
import {
  Application,
  Button,
  Color,
  File,
  GridLayout,
  Label,
  ScrollView,
  StackLayout,
  TextField,
  knownFolders,
  type EventData,
} from '@nativescript/core'
import { onUnmounted } from 'nativescript-vue'
import {
  bottomSheet,
  GestureSurface,
  type BottomSheet,
} from '@rafaelaugusto/jolt/bottom-sheet'
import { launchArgument } from '../launch'
import {
  runBottomSheetChecks,
  bottomSheetNodeCount,
} from '../../../benchmarks/bottom-sheet-checks'

const emit = defineEmits<{ back: [] }>()
let sheet: BottomSheet | undefined
let content: StackLayout | undefined
let count = 0
let status: Label | undefined
let ready = false
// `sheet-safe-area` covers the page edge to edge like an app overlay; `inset` keeps Core's
// default, where the full-window host lays its children out inside the safe area. Read on
// load: Android has no activity, and no intent extras, while the component is set up.
let fullWindow = false
let edgeToEdge = false
const names = [
  'Harbor hideaway',
  'The garden loft',
  'Coastal cabin',
  'Old town studio',
  'Pine house',
  'Riverside retreat',
]
const colors = ['#C6DACA', '#D8CFE6', '#D0DCEA', '#E8D6C4', '#D9DDBF', '#C4DDDF']

function label(text: string, size = 16) {
  const view = new Label()
  view.text = text
  view.fontSize = size
  view.color = new Color('#24352E')
  return view
}
function button(text: string, run: () => void) {
  const view = new Button()
  view.text = text
  view.automationText = text
  view.fontSize = 13
  view.on('tap', run)
  return view
}
function grow(amount = 6) {
  if (!content) return
  for (let index = 0; index < amount; index++) {
    const number = count++,
      row = new GridLayout()
    row.columns = '56,*'
    row.height = 76
    row.padding = '8 16'
    row.automationText = `Stay ${number + 1}`
    const tile = label(String(number + 1), 22)
    tile.backgroundColor = new Color(colors[number % colors.length]!)
    tile.borderRadius = 12
    tile.textAlignment = 'center'
    tile.verticalAlignment = 'middle'
    tile.height = 52
    row.addChild(tile)
    const copy = new StackLayout()
    copy.marginLeft = 14
    copy.verticalAlignment = 'middle'
    GridLayout.setColumn(copy, 1)
    const title = label(names[number % names.length]!, 16)
    title.fontWeight = '600'
    copy.addChild(title)
    copy.addChild(label('2 guests · a little room to unwind', 12))
    row.addChild(copy)
    content.addChild(row)
  }
}
function mount(event: EventData) {
  if (ready) return
  ready = true
  const variant = launchArgument('sheet-safe-area')
  fullWindow = variant !== undefined
  edgeToEdge = fullWindow && variant !== 'inset'
  const outer = event.object as GridLayout
  const controls = new GridLayout()
  controls.columns = '*,*,*,*'
  controls.height = 48
  controls.margin = '0 12'
  const open = button('Open stays', () => sheet?.open('50%'))
  controls.addChild(open)
  for (const [i, view] of [
    button('Content', () => sheet?.open('content')),
    fullWindow
      ? button('Full', () => sheet?.open('100%'))
      : button('More stays', () => grow()),
    button('Close', () => sheet?.dismiss()),
  ].entries()) {
    GridLayout.setColumn(view, i + 1)
    controls.addChild(view)
  }
  const host = new GridLayout()
  host.backgroundColor = new Color('#EDF3EE')
  host.automationText = 'Sheet stage'
  const welcome = new StackLayout()
  welcome.padding = '36 28'
  welcome.verticalAlignment = 'top'
  // The full-window variant covers the page like an app overlay: Core insets the
  // host's children below the status bar, and the sheet must reach the home indicator.
  let insets = { top: 0, bottom: 0 }
  if (fullWindow) {
    GridLayout.setRowSpan(host, 2)
    const window = edgeToEdge
      ? (Application.ios?.window as UIWindow | undefined)
      : undefined
    if (window) {
      const safe = window.safeAreaInsets
      insets = { top: safe.top, bottom: safe.bottom }
      host.iosIgnoreSafeArea = true
      host.marginTop = -safe.top
      host.marginBottom = -safe.bottom
    }
    const root = outer.parent as GridLayout
    root.addChild(host)
    // Keep the controls above the backdrop so real taps still reach them while the sheet is open.
    GridLayout.setRow(controls, 0)
    root.addChild(controls)
    welcome.marginTop = insets.top + 52
  } else {
    outer.addChild(controls)
    GridLayout.setRow(host, 1)
    outer.addChild(host)
  }
  const eyebrow = label('WEEKEND, AT YOUR PACE', 12)
  eyebrow.letterSpacing = 0.12
  welcome.addChild(eyebrow)
  const title = label('A change\nof scenery.', 36)
  title.textWrap = true
  title.fontWeight = 'bold'
  title.marginTop = 16
  welcome.addChild(title)
  const description = label(
    'Pull up a place to stay. Keep dragging to explore the list.',
    16,
  )
  description.textWrap = true
  description.marginTop = 18
  welcome.addChild(description)
  status = label('Panel closed', 13)
  status.marginTop = 24
  status.color = new Color('#60766A')
  welcome.addChild(status)
  host.addChild(welcome)
  const backdrop = new GridLayout()
  backdrop.backgroundColor = new Color('#10251B')
  backdrop.automationText = 'Sheet backdrop'
  backdrop.visibility = 'hidden'
  host.addChild(backdrop)
  const panel = new GestureSurface()
  panel.rows = '52,52,*,48'
  panel.backgroundColor = new Color('#FFFFFF')
  panel.borderTopLeftRadius = 24
  panel.borderTopRightRadius = 24
  panel.automationText = 'Stay panel'
  const handle = label('Your next weekend   ↕', 19)
  handle.fontWeight = 'bold'
  handle.padding = '16 20'
  handle.automationText = 'Stays sheet'
  panel.addChild(handle)
  const field = new TextField()
  field.hint = 'Add a trip note'
  field.automationText = 'Trip note'
  field.margin = '0 16 8'
  field.fontSize = 16
  field.returnKeyType = 'done'
  GridLayout.setRow(field, 1)
  panel.addChild(field)
  const scroll = new ScrollView()
  scroll.automationText = 'Stay results'
  content = new StackLayout()
  scroll.content = content
  GridLayout.setRow(scroll, 2)
  panel.addChild(scroll)
  grow(3)
  const footer = new GridLayout()
  footer.columns = '*,*'
  GridLayout.setRow(footer, 3)
  footer.addChild(button('Expand sheet', () => sheet?.expand()))
  const collapse = button('Collapse sheet', () => sheet?.collapse())
  GridLayout.setColumn(collapse, 1)
  footer.addChild(collapse)
  panel.addChild(footer)
  panel.visibility = 'hidden'
  host.addChild(panel)
  const baselineNodes = bottomSheetNodeCount()
  sheet = bottomSheet(panel, {
    handle,
    scrollView: scroll,
    backdrop,
    snap: fullWindow ? ['content', '50%', '100%'] : ['content', '50%', '90%'],
    returnFocus: open,
    keyboard: 'follow',
    safeArea: edgeToEdge ? insets : fullWindow ? undefined : { top: 0, bottom: 0 },
    accessibility: { label: 'Stays sheet' },
    onChange(point) {
      if (status)
        status.text = point === null ? 'Panel closed' : `Snap ${point} · ${count} stays`
    },
  })
  if (launchArgument('bottom-sheet-checks') !== undefined) {
    const control = sheet
    setTimeout(() => {
      void runBottomSheetChecks({
        sheet: control,
        host,
        panel,
        handle,
        scroll,
        field,
        grow,
        baselineNodes,
        fullWindow: fullWindow ? { edgeToEdge, insets } : undefined,
        argument: launchArgument('sheet-safe-area'),
        runId: launchArgument('sheet-run-id') ?? String(Date.now()),
      }).then((report) => {
        File.fromPath(
          `${knownFolders.documents().path}/bottom-sheet-checks.json`,
        ).writeTextSync(JSON.stringify(report))
        if (status)
          status.text =
            report.status === 'passed' ? 'Checks passed' : `Check failed: ${report.error}`
        console.log('JOLT_BOTTOM_SHEET', JSON.stringify(report))
      })
    }, 300)
  }
}
onUnmounted(() => {
  sheet?.dispose()
  sheet = undefined
})
</script>

<template>
  <GridLayout rows="52,*" backgroundColor="#EDF3EE">
    <GridLayout columns="auto,*" padding="4 16">
      <Button text="Back" @tap="emit('back')" />
      <Label
        col="1"
        text="Bottom sheet"
        fontSize="19"
        fontWeight="bold"
        verticalAlignment="middle"
        marginLeft="12"
        color="#24352E"
      />
    </GridLayout>
    <GridLayout row="1" rows="48,*" @loaded="mount" />
  </GridLayout>
</template>
