import { createWebRuntime, type WebKeyboardState } from '../../src/web/public.js'

const el = (id: string) => document.getElementById(id)!
const runtime = createWebRuntime(document)
const scope = runtime.scope()
const diagnostics = runtime.diagnostics({ development: true })
const session = `${Date.now()}-${Math.random().toString(36).slice(2)}`
const events: unknown[] = []
let keyboard: WebKeyboardState | undefined
let ready = false
function snapshot(name: string, extra?: unknown) {
  if (!ready) return
  const event = {
    name,
    time: Date.now(),
    extra,
    keyboard,
    focused: document.activeElement?.id,
    viewport: {
      width: innerWidth,
      height: innerHeight,
      visual: visualViewport && {
        width: visualViewport.width,
        height: visualViewport.height,
        top: visualViewport.offsetTop,
      },
    },
    orientation: screen.orientation?.angle ?? (window as any).orientation ?? null,
    rotation: rotation.snapshot(),
    gravity: gravity.snapshot(),
    diagnostics: diagnostics.snapshot(),
  }
  events.push(event)
  el('status').textContent =
    `${name}\nKeyboard: ${keyboard?.visible ?? false} / ${Math.round(keyboard?.height ?? 0)} px\nRotation: ${rotation.status}; gravity: ${gravity.status}`
  void fetch('/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session,
      userAgent: navigator.userAgent,
      secure: isSecureContext,
      scope: 'simulator/emulator browser; no physical-device claim',
      events,
    }),
  })
}
const rotation = scope.sensor('rotation', {
  coordinates: 'interface',
  onStatus: () => snapshot('rotation-status'),
})
const gravity = scope.sensor('gravity', {
  coordinates: 'interface',
  onStatus: () => snapshot('gravity-status'),
})
scope.bind(el('card'), {
  rotate: scope.map(rotation.z, [-Math.PI, Math.PI], [-180, 180]),
  x: scope.map(gravity.x, [-9.80665, 9.80665], [-40, 40]),
})
scope.followKeyboard(el('bar'), { offset: 12 })
scope.onKeyboard((value) => {
  keyboard = value
  snapshot('keyboard')
})
el('blur').onclick = () => {
  ;(document.activeElement as HTMLElement)?.blur()
  snapshot('blur')
}
el('haptic').onclick = () => snapshot('haptic', runtime.haptic('light'))
el('sensors').onclick = async () => {
  const result = await Promise.all([
    rotation.requestPermission(),
    gravity.requestPermission(),
  ])
  snapshot('permission', result)
}
el('pause').onclick = () => {
  scope.suspend()
  snapshot('paused')
}
el('resume').onclick = () => {
  scope.resume()
  snapshot('resumed')
}
el('snapshot').onclick = () => snapshot('snapshot')
el('unmount').onclick = () => {
  scope.dispose()
  runtime.dispose()
  snapshot('disposed')
  el('card').remove()
  el('bar').remove()
}
document.addEventListener('visibilitychange', () =>
  snapshot('visibility', document.visibilityState),
)
ready = true
snapshot('ready')
