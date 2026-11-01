import assert from 'node:assert/strict'

for (const name of [
  'window',
  'document',
  'HTMLElement',
  'UIView',
  'android',
  'isAndroid',
  'isIOS',
  'requestAnimationFrame',
  'setTimeout',
  'setInterval',
])
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get() {
      throw new Error(`Unexpected platform access: ${name}`)
    },
  })

const { createTrack, resolveTransition, createClock, createOwnership } =
  await import('@jolt-internal/core-boundary-probe')
const options = { timeScale: 1, reducedMotion: false }
for (const property of ['opacity', 'x', 'y', 'scaleX', 'scaleY', 'rotate']) {
  const track = createTrack(
    property,
    [0, 1],
    resolveTransition({ type: 'spring' }, property, 2),
    0,
    options,
  )
  assert(track.times.length > 2)
  assert.equal(track.times[0], 0)
  assert.equal(track.times.at(-1), 1)
  assert.equal(track.valueAt(track.end), 1)
}
let now = 0
const clock = createClock(() => now)
now = 50
clock.pause()
now = 100
assert.equal(clock.time(), 50)
clock.seek(20)
clock.play()
now = 130
assert.equal(clock.time(), 50)
const a = createOwnership(),
  b = createOwnership(),
  target = {}
const token = a.claim(target, 'x')
b.claim(target, 'x')
b.invalidate(target)
assert.equal(a.get(target, 'x'), token)
console.log('PASS')
