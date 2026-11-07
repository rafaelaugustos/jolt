import assert from 'node:assert/strict'

for (const name of [
  'window',
  'document',
  'HTMLElement',
  'requestAnimationFrame',
  'MutationObserver',
  'matchMedia',
])
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get() {
      throw new Error(`Import accessed ${name}`)
    },
  })
for (const name of [
  'setTimeout',
  'setInterval',
  'setImmediate',
  'queueMicrotask',
  'addEventListener',
])
  globalThis[name] = () => {
    throw new Error(`Import scheduled ${name}`)
  }

const entry = process.argv[2] ?? '@rafaelaugusto/jolt/web'
const module = await import(entry)
if (module.render) assert.equal(module.render(), '<main data-motion="function"></main>')
else if (entry.endsWith('/web/audio')) assert.deepEqual(Object.keys(module), ['audioCue'])
else if (entry.endsWith('/web/inspector'))
  assert.deepEqual(Object.keys(module), [
    'createMotionInspector',
    'inspectorSpring',
    'springCode',
  ])
else if (entry.endsWith('/web/testing')) {
  for (const name of ['recordInteraction', 'replayInteraction', 'parseTrace'])
    assert.equal(typeof module[name], 'function')
} else
  assert.deepEqual(Object.keys(module), [
    'createWebRuntime',
    'drawingLimits',
    'resolveListTarget',
  ])
console.log('PASS: SSR import without platform globals, timers or listeners')
