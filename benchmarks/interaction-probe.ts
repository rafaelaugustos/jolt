import {
  Application,
  Button,
  Label,
  Page,
  StackLayout,
  GridLayout,
  Color,
  knownFolders,
  isIOS,
} from '@nativescript/core'
import {
  animate,
  configure,
  press,
  interactionSurface,
  type PlaybackAnimation,
} from '@rafaelaugusto/jolt'

let animation: PlaybackAnimation | undefined
let ancestor: PlaybackAnimation | undefined
let taps = 0
let mode = 'translation'
const log: object[] = []
Application.run({
  create: () => {
    configure({ reducedMotion: 'never' })
    const page = new Page()
    page.actionBarHidden = true
    const stack = new StackLayout()
    stack.padding = 20
    const status = new Label()
    status.text = 'Ready'
    status.accessibilityIdentifier = 'status'
    const stage = new GridLayout()
    stage.height = 280
    stage.backgroundColor = new Color('#edf1e8')
    const surface = interactionSurface(stage)
    const parent = new GridLayout()
    parent.width = 340
    parent.height = 240
    parent.horizontalAlignment = 'left'
    parent.verticalAlignment = 'top'
    const button = new Button()
    button.text = 'Moving'
    button.accessibilityIdentifier = 'moving'
    button.width = 64
    button.height = 50
    button.horizontalAlignment = 'left'
    button.verticalAlignment = 'top'
    button.translateY = 60
    button.backgroundColor = new Color('#315f95')
    button.color = new Color('white')
    const back = new Button()
    back.text = 'Behind'
    back.width = 64
    back.height = 50
    back.horizontalAlignment = 'left'
    back.verticalAlignment = 'top'
    back.translateX = 100
    back.translateY = 60
    parent.addChild(back)
    parent.addChild(button)
    stage.addChild(parent)
    const record = (name: string) => {
      taps++
      status.text = `${name} ${taps}`
      log.push({ name, mode, taps })
      knownFolders
        .documents()
        .getFile('jolt-interaction-taps.json')
        .writeTextSync(JSON.stringify(log))
    }
    button.on('tap', () => record('moving'))
    back.on('tap', () => record('behind'))
    const releasePress = press(button)
    const action = (name: string, callback: () => void) => {
      const control = new Button()
      control.text = name
      control.on('tap', callback)
      stack.addChild(control)
    }
    stack.addChild(status)
    stack.addChild(stage)
    const start = (next: string) => {
      animation?.stop()
      ancestor?.stop()
      mode = next
      taps = 0
      log.length = 0
      button.isEnabled = true
      button.opacity = 1
      button.translateX = 0
      button.translateY = 60
      parent.scaleX = parent.scaleY = 1
      parent.rotate = 0
      parent.width = 340
      parent.style.clipPath = ''
      if (isIOS) parent.ios.clipsToBounds = false
      else parent.android.setClipChildren(false)
      back.visibility = next === 'overlap' ? 'visible' : 'collapse'
      if (next === 'ancestor') {
        ancestor = animate(
          parent,
          { scale: [1, 0.8], rotate: [0, 20] },
          { duration: 6000, ease: 'linear' },
        )
        ancestor.pause()
        ancestor.progress = 0.5
      }
      if (next === 'clip') {
        parent.width = 120
        if (isIOS) parent.ios.clipsToBounds = true
        else parent.android.setClipChildren(true)
      }
      if (next === 'disabled') button.isEnabled = false
      animation = animate(button, { x: [0, 200] }, { duration: 6000, ease: 'linear' })
      if (next !== 'live') {
        animation.pause()
        animation.progress = 0.5
      }
      status.text = `${next === 'live' ? 'Live' : 'Held'} ${next}`
    }
    for (const next of ['translation', 'ancestor', 'clip', 'overlap', 'disabled', 'live'])
      action(next, () => start(next))
    action('Stop', () => {
      animation?.stop()
      status.text = 'Stopped'
    })
    action('Reset', () => {
      animation?.stop()
      button.translateX = 0
      taps = 0
      status.text = 'Reset'
    })
    page.on('unloaded', () => {
      animation?.stop()
      ancestor?.stop()
      releasePress()
      surface.dispose()
    })
    page.content = stack
    return page
  },
})
