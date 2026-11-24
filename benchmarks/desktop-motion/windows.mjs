import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { setTimeout as wait } from 'node:timers/promises'
import { windowsMotion } from '../../dist/desktop/windows.js'
const { Windows, XamlWindow, native } = createRequire(import.meta.url)(
  '@nativescript/windows-napi',
)
const Xaml = Windows.UI.Xaml
const window = new XamlWindow({ title: 'Jolt · Desktop motion', theme: 'light' })
const panel = new Xaml.Controls.StackPanel()
const card = new Xaml.Controls.Button()
card.Content = 'Move card'
panel.Children.Append(card)
window.content = panel
window.place({ width: 480, height: 260 })
window.show()
const pump = setInterval(() => native.pumpMessages(), 8)
const motion = windowsMotion(card, Windows)
window.on('closed', () => motion.dispose())
let movement
card.Click = () => {
  movement = motion.animate('x', 160, { duration: 1000 })
}
try {
  await wait(600)
  const peer = new Xaml.Automation.Peers.ButtonAutomationPeer(card)
  peer.GetPattern(Xaml.Automation.Peers.PatternInterface.Invoke).Invoke()
  await wait(300)
  assert(movement)
  const first = movement
  const second = motion.animate('x', 48, { duration: 500 })
  assert.equal(await first.finished, false)
  assert.equal(
    await Promise.race([second.finished, wait(3000).then(() => 'timeout')]),
    true,
  )
  assert.equal(card.RenderTransform.X, 48)
  const fading = motion.animate('opacity', 0.2, { duration: 700 })
  await wait(200)
  fading.cancel()
  assert.equal(await fading.finished, false)
  await motion.animate('opacity', 1, { reducedMotion: true }).finished
  assert.equal(card.Opacity, 1)
  const final = motion.animate('y', 40, { duration: 800 })
  window.close()
  await wait(200)
  assert.equal(await final.finished, false)
} finally {
  motion.dispose()
  clearInterval(pump)
}
