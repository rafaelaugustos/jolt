import {
  Application,
  Button,
  Color,
  File,
  GridLayout,
  Label,
  Page,
  ScrollView,
  StackLayout,
  TextField,
  isIOS,
  knownFolders,
} from '@nativescript/core'
import { followKeyboard, scrollHeader } from '@rafaelaugusto/jolt'

const ink = new Color('#193938'),
  paper = new Color('#f8f6ed'),
  green = new Color('#b1dbc1')
function label(text: string, size = 18) {
  const v = new Label()
  v.text = text
  v.fontSize = size
  v.color = ink
  v.padding = 12
  return v
}
function button(text: string, onTap: () => void) {
  const v = new Button()
  v.text = v.automationText = text
  v.on('tap', onTap)
  return v
}
function audit(name: string) {
  const history: object[] = []
  return (event: string, fields: object) => {
    history.push({ event, ...fields })
    File.fromPath(knownFolders.documents().path + '/' + name + '.json').writeTextSync(
      JSON.stringify(history),
    )
  }
}

function keyboardPage(page: Page) {
  const record = audit('keyboard-regression')
  const root = new GridLayout(),
    tools = new StackLayout(),
    composer = new GridLayout()
  page.content = root
  root.rows = 'auto,*,auto'
  tools.padding = 24
  root.addChild(tools)
  tools.addChild(label('Field notes', 38))
  const field = new TextField()
  field.hint = 'Edit note'
  field.automationText = 'Edit note'
  field.fontSize = 22
  tools.addChild(field)
  const status = label('Keyboard hidden · editor at rest')
  status.automationText = 'Geometry'
  tools.addChild(status)
  composer.row = 2
  composer.height = 80
  composer.backgroundColor = green
  composer.automationText = 'Editor'
  composer.addChild(label('Draft saved     ·     Bottom editor', 23))
  root.addChild(composer)
  const release = followKeyboard(composer)
  const report = (event: string, frame?: CGRect) => {
    const win = composer.ios?.window as UIWindow | undefined
    if (!win) return
    const rect = composer.ios.convertRectToView(composer.ios.bounds, win) as CGRect
    const lift = -composer.translateY
    status.text =
      (lift > 0 ? 'Editor follows keyboard' : 'Editor at rest') +
      '   ·   ' +
      Math.round(lift) +
      ' pt'
    record(event, {
      lift,
      bottom: rect.origin.y + rect.size.height,
      width: win.bounds.size.width,
      height: win.bounds.size.height,
      ...(frame
        ? {
            keyboard: [
              frame.origin.x,
              frame.origin.y,
              frame.size.width,
              frame.size.height,
            ],
          }
        : {}),
    })
  }
  const watch = Application.ios.addNotificationObserver(
    UIKeyboardWillChangeFrameNotification,
    (n: NSNotification) => {
      const end = n.userInfo?.objectForKey(UIKeyboardFrameEndUserInfoKey)?.CGRectValue as
        CGRect | undefined
      setTimeout(() => report('system frame', end), 450)
    },
  )
  tools.addChild(button('Finish editing', () => field.dismissSoftInput()))
  page.once('unloaded', () => {
    release()
    Application.ios.removeNotificationObserver(
      watch,
      UIKeyboardWillChangeFrameNotification,
    )
  })
}

function anchorPage(page: Page) {
  const record = audit('anchor-regression')
  const root = new GridLayout(),
    panel = new GridLayout(),
    list = new ScrollView(),
    content = new StackLayout()
  const status = label('Select an update', 15),
    actions = new StackLayout()
  root.rows = 'auto,*,auto,auto'
  page.content = root
  root.addChild(label('Reading list', 28))
  panel.row = 1
  root.addChild(panel)
  panel.addChild(list)
  content.paddingTop = 0
  list.content = content
  const rows: { key: string; target: Label }[] = []
  function insert(key: string, index: number, height: number) {
    const row = label(key === 'Chapter 06' ? 'Chapter 06   ·   retained card' : key)
    row.height = height
    row.verticalAlignment = 'middle'
    row.backgroundColor =
      key === 'Chapter 06' ? green : index % 2 ? paper : new Color('#e5ece6')
    content.insertChild(row, index)
    rows.splice(index, 0, { key, target: row })
  }
  for (let i = 0; i < 26; i++) insert('Chapter ' + String(i + 1).padStart(2, '0'), i, 68)
  const retained = rows[5]!.target
  const header = new StackLayout(),
    artwork = label('FIELD GUIDE', 15),
    title = label('Chapters', 26)
  header.verticalAlignment = 'top'
  header.backgroundColor = green
  header.addChild(artwork)
  header.addChild(title)
  panel.addChild(header)
  const toolbar = new GridLayout(),
    toolbarTitle = label('Chapters'),
    section = label('Contents', 14)
  toolbar.verticalAlignment = 'top'
  toolbar.height = 54
  toolbar.backgroundColor = green
  toolbar.addChild(toolbarTitle)
  panel.addChild(toolbar)
  section.verticalAlignment = 'top'
  section.height = 42
  section.backgroundColor = paper
  panel.addChild(section)
  status.row = 2
  status.automationText = 'Anchor result'
  root.addChild(status)
  actions.row = 3
  actions.orientation = 'horizontal'
  root.addChild(actions)
  let controller: ReturnType<typeof scrollHeader>,
    sequence = 0,
    running = false
  const top = () => retained.getLocationInWindow().y - list.getLocationInWindow().y
  async function measure(
    event: string,
    commit: (change: () => void) => Promise<unknown>,
  ) {
    list.scrollToVerticalOffset(270, false)
    const live = list.verticalOffset,
      snapshot = controller.state.offset,
      before = top()
    let commits = 0
    const accepted = await commit(() => {
      commits++
      insert('New chapter ' + ++sequence, 0, 162)
    })
    const after = top()
    status.text =
      'Retained card   ' + before.toFixed(1) + ' → ' + after.toFixed(1) + ' DIP'
    record(event, {
      before,
      after,
      live,
      snapshot,
      final: list.verticalOffset,
      commits,
      accepted,
    })
  }
  async function run(guarded: boolean) {
    if (!controller?.ready || running) return
    running = true
    try {
      if (guarded) await controller.refresh()
      else await measure('prepend', (fn) => controller.preserveAnchor(fn))
    } catch (e) {
      record('error', { message: String(e) })
      status.text = String(e)
    } finally {
      running = false
    }
  }
  actions.addChild(button('Prepend', () => void run(false)))
  actions.addChild(button('Refresh', () => void run(true)))
  actions.addChild(
    button('Top', () => {
      list.scrollToVerticalOffset(0, false)
      status.text = 'Ready for update'
    }),
  )
  page.once('loaded', () =>
    setTimeout(async () => {
      controller = scrollHeader(list, {
        header,
        artwork,
        title,
        toolbar,
        toolbarTitle,
        section,
        items: () => rows,
        expandedHeight: 140,
        minimumHeight: 54,
        onRefresh: (context) => measure('refresh', (fn) => context.commit(fn)),
      })
      await controller.remeasure()
      record('ready', { ready: controller.ready })
    }, 350),
  )
  page.once('unloaded', () => controller?.dispose())
}
export function runPlatformRegressions() {
  Application.run({
    create() {
      const page = new Page()
      page.actionBarHidden = true
      page.backgroundColor = paper
      if (isIOS) keyboardPage(page)
      else anchorPage(page)
      return page
    },
  })
}
