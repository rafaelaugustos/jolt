import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { setTimeout as wait } from 'node:timers/promises'
import { windowsMotion } from '../../dist/desktop/windows.js'
const { Windows, XamlWindow, native } = createRequire(import.meta.url)(
  '@nativescript/windows-napi',
)
const Xaml = Windows.UI.Xaml
console.log(
  'System animations enabled:',
  new Windows.UI.ViewManagement.UISettings().AnimationsEnabled,
)
const window = new XamlWindow({ title: 'Jolt Desktop Motion', theme: 'light' })
const panel = new Xaml.Controls.StackPanel()
const heading = new Xaml.Controls.TextBlock()
heading.Text = 'Native motion'
heading.FontSize = 26
const status = new Xaml.Controls.TextBlock()
status.Text = 'Ready'
const card = new Xaml.Controls.Button()
card.Content = 'Move card'
panel.Children.Append(heading)
panel.Children.Append(card)
panel.Children.Append(status)
window.content = panel
window.place({ width: 480, height: 260 })
window.show()
const pump = setInterval(() => native.pumpMessages(), 8)
card.RenderTransform = new Xaml.Media.TranslateTransform()
const motion = windowsMotion(card, Windows)
window.on('closed', () => motion.dispose())
let movement, error, recorder, recorded
card.Click = () => {
  status.Text = 'Moving right'
  try {
    movement = motion.animate('x', 160, { duration: 1000 })
  } catch (cause) {
    error = cause
  }
}
try {
  await wait(850)
  if (process.argv[2]) {
    const r = JSON.parse(
      execFileSync(
        'pwsh',
        [
          '-NoProfile',
          '-File',
          'benchmarks/desktop-motion/window-bounds.ps1',
          '-WindowHandle',
          String(window.hwnd),
        ],
        { encoding: 'utf8' },
      ),
    )
    recorder = spawn(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-f',
        'gdigrab',
        '-framerate',
        '24',
        '-offset_x',
        String(r.x),
        '-offset_y',
        String(r.y),
        '-video_size',
        r.width + 'x' + r.height,
        '-i',
        'desktop',
        '-vf',
        'pad=ceil(iw/2)*2:ceil(ih/2)*2',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        process.argv[2],
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    )
    recorded = once(recorder, 'exit')
    await wait(800)
  }
  const peer = new Xaml.Automation.Peers.ButtonAutomationPeer(card)
  peer.GetPattern(Xaml.Automation.Peers.PatternInterface.Invoke).Invoke()
  await wait(300)
  if (error) throw error
  assert(movement)
  console.log('XAML presentation at replacement', card.RenderTransform.X)
  const first = movement
  status.Text = 'Return to center'
  const second = motion.animate('x', 48, { duration: 500 })
  assert.equal(await first.finished, false)
  assert.equal(
    await Promise.race([second.finished, wait(3000).then(() => 'timeout')]),
    true,
  )
  assert.equal(card.RenderTransform.X, 48)
  status.Text = 'Fade and hold'
  const fading = motion.animate('opacity', 0.2, { duration: 700 })
  await wait(200)
  motion.suspend()
  assert.equal(await fading.finished, false)
  const held = card.Opacity
  assert(held > 0.2 && held < 1)
  await wait(650)
  assert(Math.abs(card.Opacity - held) < 0.01)
  status.Text = 'Reduce motion · restored'
  await motion.animate('opacity', 1, { reducedMotion: true }).finished
  assert.equal(card.Opacity, 1)
  await wait(600)
  if (recorder) {
    recorder.stdin.end('q')
    assert.equal((await recorded)[0], 0)
    recorder = undefined
  }
  const final = motion.animate('y', 40, { duration: 800 })
  window.close()
  await wait(200)
  assert.equal(await final.finished, false)
} finally {
  if (recorder && recorder.exitCode === null) recorder.stdin.end('q')
  motion.dispose()
  clearInterval(pump)
}
