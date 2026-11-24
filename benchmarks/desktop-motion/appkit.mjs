import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as wait } from 'node:timers/promises'
import '@nativescript/macos-node-api'
import { appKitMotion } from '../../dist/desktop/appkit.js'
objc.import('AppKit')
objc.import('QuartzCore')
const rect = (x, y, width, height) => ({ origin: { x, y }, size: { width, height } })
const app = NSApplication.sharedApplication
app.setActivationPolicy(NSApplicationActivationPolicy.Regular)
const win = NSWindow.alloc().initWithContentRectStyleMaskBackingDefer(
  rect(0, 0, 520, 240),
  NSWindowStyleMask.Titled | NSWindowStyleMask.Closable,
  NSBackingStoreType.Buffered,
  false,
)
win.title = 'Jolt · Desktop motion'
win.releasedWhenClosed = false
const card = NSButton.alloc().initWithFrame(rect(28, 112, 188, 52))
card.title = 'Move card'
win.contentView.addSubview(card)
const label = NSTextField.labelWithString('Ready')
label.frame = rect(32, 48, 460, 32)
win.contentView.addSubview(label)
const motion = appKitMotion(card)
let movement
class JoltDemoAction extends NSObject {
  static ObjCExposedMethods = {
    activate: { returns: interop.types.void, params: [interop.types.id] },
  }
  static {
    NativeClass(this)
  }
  activate() {
    label.stringValue = 'Moving right'
    movement = motion.animate('x', 240, { duration: 1600 })
  }
}
const action = JoltDemoAction.new()
card.target = action
card.action = 'activate'
app.finishLaunching()
win.center()
win.makeKeyAndOrderFront(null)
app.activateIgnoringOtherApps(true)
const pump = setInterval(() => {
  for (let i = 0; i < 64; i++) {
    const ev = app.nextEventMatchingMaskUntilDateInModeDequeue(
      NSEventMask.Any,
      null,
      'kCFRunLoopDefaultMode',
      true,
    )
    if (!ev) break
    app.sendEvent(ev)
  }
  app.updateWindows()
}, 4)
let recording, recorded
try {
  await wait(350)
  if (process.argv[2]) {
    recording = spawn(
      'screencapture',
      ['-v', '-l', String(win.windowNumber), process.argv[2]],
      { stdio: 'inherit' },
    )
    recorded = once(recording, 'exit')
    await wait(900)
  }
  card.performClick(null)
  await wait(550)
  const current = Number(
    card.layer.presentationLayer().valueForKeyPath('transform.translation.x'),
  )
  assert(
    current > 0 && current < 240,
    'Native presentation must advance before replacement: ' + current,
  )
  label.stringValue = 'Return to center'
  const replacement = motion.animate('x', 80, { duration: 800 })
  assert.equal(await movement.finished, false)
  assert.equal(
    await Promise.race([replacement.finished, wait(3500).then(() => null)]),
    true,
  )
  assert.equal(Number(card.layer.valueForKeyPath('transform.translation.x')), 80)
  label.stringValue = 'Fade and hold'
  const fade = motion.animate('opacity', 0.15, { duration: 900 })
  await wait(420)
  motion.suspend()
  assert.equal(await fade.finished, false)
  const held = Number(card.layer.opacity)
  assert(held > 0.15 && held < 1)
  await wait(650)
  assert(Math.abs(card.layer.opacity - held) < 0.01)
  label.stringValue = 'Reduce motion · restored'
  await motion.animate('opacity', 1, { reducedMotion: true }).finished
  await wait(900)
  const end = motion.animate('y', 32)
  motion.dispose()
  assert.equal(await end.finished, false)
} finally {
  if (recording && recording.exitCode === null) recording.kill('SIGINT')
  if (recorded) await recorded
  clearInterval(pump)
  win.close()
}
