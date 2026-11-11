import { measureInspection } from './measurement.js'
import { mountDemo } from './demo.js'
import { mountBoard } from './board.js'
import { createMotionInspector, springCode } from '../../src/web/inspector.js'
import { recordInteraction, replayInteraction } from '../../src/web/testing.js'
import { audioCue } from '../../src/web/audio.js'
import { createWebRuntime, type DropZones } from '../../src/web/public.js'
const el = (id: string) => document.getElementById(id)!
let runtime = createWebRuntime(document),
  scope = runtime.scope()
let drop: DropZones,
  count = 0
const mode = new URL(location.href).searchParams.get('mode') ?? 'drop'
let demo: ReturnType<typeof mountDemo> | undefined
let board: ReturnType<typeof mountBoard> | undefined
function boot() {
  runtime.dispose()
  runtime = createWebRuntime(document)
  scope = runtime.scope()
  count = 0
  if (mode === 'board') {
    board = mountBoard(runtime, scope)
    drop = board.drop
    el('pause').textContent = 'Pause'
    return
  }
  if (mode !== 'drop') {
    demo = mountDemo(mode, runtime, scope)
    return
  }
  el('stage').innerHTML =
    '<div id="source">CARD</div><div id="accept" class="zone">Accept</div><div id="reject" class="zone">Reject</div>'
  el('status').textContent = 'Ready · drag or use the button'
  drop = scope.dropZones(el('source'), {
    targets: [
      { id: 'accept', target: el('accept') },
      { id: 'reject', target: el('reject'), accept: () => false },
    ],
    drag: { snap: [0] },
    onEnter: ({ target }) => {
      target.dataset.hover = ''
      el('status').textContent = 'Target entered'
    },
    onLeave: ({ target }) => {
      delete target.dataset.hover
    },
    onReject: () => {
      el('status').textContent = 'Rejected · return animation preserved'
    },
    onDrop: ({ method }) => {
      count++
      el('status').textContent = `Accepted once · ${method} · ${count}`
      return runtime.animate(
        el('source'),
        { scale: [1, 0.7, 1], opacity: [1, 0.5, 1] },
        { duration: 700 },
      )
    },
  })
  el('pause').textContent = 'Pause'
}
el('reset').onclick = boot
el('request').onclick = () =>
  board ? board.play() : demo ? demo.play() : drop.request('accept')
el('replace').onclick = () => demo?.replace()
el('seek').onclick = () => demo?.seek()
el('inspect').onclick = () => demo?.inspect()
el('pause').onclick = () => {
  if (board) {
    board.pause()
    return
  }
  if (demo) {
    demo.pause()
    return
  }
  if (drop.paused) drop.play()
  else drop.pause()
  el('pause').textContent = drop.paused ? 'Resume' : 'Pause'
  el('status').textContent = drop.paused
    ? 'Paused · input and accepted effect cancelled'
    : 'Ready'
}
boot()
Object.defineProperty(window, 'depth', {
  value: {
    measureInspection,
    get runtime() {
      return runtime
    },
    get scope() {
      return scope
    },
    get drop() {
      return drop
    },
    get count() {
      return count
    },
    get board() {
      return board
    },
    audioCue,
    createMotionInspector,
    springCode,
    recordInteraction,
    replayInteraction,
    boot,
  },
})
declare global {
  interface Window {
    depth: {
      measureInspection: typeof measureInspection
      runtime: typeof runtime
      scope: typeof scope
      drop: DropZones
      count: number
      board: ReturnType<typeof mountBoard> | undefined
      audioCue: typeof audioCue
      createMotionInspector: typeof createMotionInspector
      springCode: typeof springCode
      recordInteraction: typeof recordInteraction
      replayInteraction: typeof replayInteraction
      boot(): void
    }
  }
}
