import {
  createWebRuntime,
  type WebBottomSheet,
  type WebInteractiveModal,
  type WebSharedNavigation,
  type WebPhysicsWorld,
  type WebKeyboardSubscription,
  type WebSymbolEffect,
  type WebKeyboardState,
} from '../../src/web/public.js'
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T
const stage = el('stage'),
  status = el('status')
let runtime = createWebRuntime(document)
let sheet: WebBottomSheet | undefined,
  modal: WebInteractiveModal | undefined,
  nav: WebSharedNavigation | undefined,
  physics: WebPhysicsWorld | undefined,
  keyboard: WebKeyboardSubscription | undefined,
  symbol: WebSymbolEffect | undefined
let keyboardStates: WebKeyboardState[] = []
let changes: unknown[] = []
let action = () => {},
  reverse = () => {},
  pause = () => {},
  play = () => {},
  dispose = () => {}
const modes = ['keyboard', 'sheet', 'modal', 'navigation', 'physics', 'symbols'] as const
export type Mode = (typeof modes)[number]
function boot(mode: Mode) {
  runtime.dispose()
  runtime = createWebRuntime(document)
  document.querySelector('dialog')?.remove()
  sheet = undefined
  modal = undefined
  nav = undefined
  physics = undefined
  keyboard = undefined
  symbol = undefined
  changes = []
  keyboardStates = []
  status.textContent = 'Ready'
  el('title').textContent = {
    keyboard: 'Keyboard geometry & following',
    sheet: 'Bottom sheet · drag, scroll & snap',
    modal: 'Interactive dialog · close or return',
    navigation: 'Shared navigation · router-owned routes',
    physics: 'Circle physics · springs & momentum',
    symbols: 'Icon effects · application-owned artwork',
  }[mode]
  el('description').textContent = {
    keyboard:
      'Focus the input. On desktop, no software keyboard is expected. Mobile geometry is reported only when available.',
    sheet: 'Drag the handle, scroll the content or use Arrow keys, Home, End and Escape.',
    modal: 'Open a real modal dialog. Drag down to dismiss; a short drag springs back.',
    navigation: 'An asynchronous route commit joins the outgoing and incoming card.',
    physics:
      'Drag the circles. The tether follows real pointer input and preserves body momentum on release.',
    symbols: 'Bounce, pulse, layered opacity and replacement animate your own icon.',
  }[mode]
  if (mode === 'keyboard') {
    stage.innerHTML =
      '<div id="keyboard-bar"><label>Message <input id="message" placeholder="Focus to type"></label></div>'
    keyboard = runtime.followKeyboard(el('keyboard-bar'), { offset: 12 })
    runtime.onKeyboard((state) => {
      keyboardStates.push(state)
      status.textContent = `${state.backend} / ${state.accuracy}\nVisible: ${state.visible} · Covered height: ${Math.round(state.height)} CSS px · Duration: ${state.duration} ms`
    })
    action = () => el('message').focus()
    reverse = () => el('message').blur()
    pause = () => keyboard!.pause()
    play = () => keyboard!.play()
    dispose = () => keyboard!.dispose()
  } else if (mode === 'sheet') {
    stage.innerHTML =
      '<div id="backdrop"></div><section id="sheet" class="panel"><div id="sheet-handle">Drag · ↑ expand · ↓ collapse</div><div id="content"><input placeholder="Input remains interactive">' +
      Array.from({ length: 12 }, (_, i) => `<p>Scrollable row ${i + 1}</p>`).join('') +
      '</div></section>'
    sheet = runtime.bottomSheet(el('sheet'), {
      host: stage,
      handle: el('sheet-handle'),
      snap: [160, '75%'],
      scrollView: el('content'),
      backdrop: el('backdrop'),
      onChange: (point) => {
        changes.push(point)
        status.textContent = `Target: ${point ?? 'closed'}`
      },
      onDismiss: () => changes.push('dismissed'),
    })
    action = () => sheet!.open()
    reverse = () => (sheet!.isOpen ? sheet!.dismiss() : sheet!.open('75%'))
    pause = () => sheet!.pause()
    play = () => sheet!.play()
    dispose = () => sheet!.dispose()
  } else if (mode === 'modal') {
    stage.innerHTML =
      '<p style="padding:30px">The browser owns the top layer and background inertness.</p>'
    const dialog = document.createElement('dialog')
    dialog.id = 'dialog'
    dialog.innerHTML =
      '<div id="modal-handle">Drag down to dismiss</div><h2>Native browser dialog</h2><input id="modal-input" placeholder="Type here"><p>Short drag: return. Long drag: close.</p><button id="modal-close">Close</button>'
    document.body.append(dialog)
    modal = runtime.interactiveModal(dialog, {
      handle: el('modal-handle'),
      returnFocus: el('action'),
      onState: (state) => {
        changes.push(state)
        status.textContent = state
      },
    })
    el('modal-close').onclick = () => modal!.close('button')
    action = () => modal!.open()
    reverse = () => modal!.close('external')
    pause = () => modal!.pause()
    play = () => modal!.play()
    dispose = () => modal!.dispose()
  } else if (mode === 'navigation') {
    stage.innerHTML =
      '<div id="route"><div id="card" class="card">Library<br>Motion systems</div></div>'
    nav = runtime.sharedNavigation(stage, {
      transition: { duration: 850, ease: 'easeInOut' },
      navigationTimeout: 2000,
      layoutTimeout: 500,
    })
    nav.attach(el('card'), 'cover')
    let destination = false
    action = () => {
      const operation = nav!.navigate({
        tag: 'cover',
        async navigate() {
          await new Promise((resolve) => setTimeout(resolve, 160))
          destination = !destination
          el('route').innerHTML =
            `<div id="card" class="card ${destination ? 'destination' : ''}">${destination ? 'Detail' : 'Library'}<br>Motion systems</div>`
          nav!.attach(el('card'), 'cover')
        },
      })
      void operation.finished.then((result) => {
        changes.push(result)
        status.textContent = JSON.stringify(result)
      })
    }
    reverse = action
    pause = () => nav!.pause()
    play = () => nav!.play()
    dispose = () => nav!.dispose()
  } else if (mode === 'physics') {
    stage.innerHTML =
      '<div id="a" class="ball">A</div><div id="b" class="ball" style="background:#a8a5f8">B</div><div id="c" class="ball" style="background:#f3c382">C</div>'
    physics = runtime.physicsWorld(
      stage,
      [
        {
          id: 'a',
          view: el('a'),
          radius: 28,
          x: 180,
          y: 150,
          attachment: {
            anchor: { x: 220, y: 30 },
            length: 90,
            damping: 14,
            line: { color: '#8de2ce' },
          },
          drag: {
            type: 'spring',
            stiffness: 260,
            damping: 18,
            line: { color: '#ffffff' },
          },
        },
        { id: 'b', view: el('b'), radius: 28, x: 370, y: 160 },
        { id: 'c', view: el('c'), radius: 28, x: 500, y: 200 },
      ],
      {
        springs: [
          {
            id: 'pair',
            from: 'b',
            to: 'c',
            length: 130,
            stiffness: 140,
            damping: 12,
            line: { color: '#b4adf4' },
          },
        ],
      },
    )
    action = () => physics!.impulse('b', { x: 350, y: -600 })
    reverse = () => physics!.reset()
    pause = () => physics!.pause()
    play = () => physics!.play()
    dispose = () => physics!.dispose()
  } else {
    stage.innerHTML =
      '<div id="symbol" aria-label="Activity"><svg width="110" height="110" viewBox="0 0 110 110" aria-hidden="true"><path data-jolt-symbol-layer fill="#83e0c7" d="M10 75h20V55H10z"/><path data-jolt-symbol-layer fill="#a8a5f8" d="M45 75h20V30H45z"/><path data-jolt-symbol-layer fill="#f3c382" d="M80 75h20V10H80z"/></svg></div>'
    let count = 0
    action = () => {
      const name = (['bounce', 'pulse', 'variableColor', 'scale'] as const)[count++ % 4]!
      symbol = runtime.symbolEffect(el('symbol'), name, {
        repeat: name === 'variableColor',
      })
      status.textContent = name
    }
    reverse = () => {
      const icon = document.createElement('span')
      icon.textContent = '✓'
      icon.setAttribute('aria-hidden', 'true')
      symbol = runtime.symbolEffect(el('symbol'), { replace: icon })
      status.textContent = 'Replacement retained after cancellation'
    }
    pause = () => symbol?.pause()
    play = () => symbol?.play()
    dispose = () => symbol?.dispose()
  }
}
for (const mode of modes) {
  const button = document.createElement('button')
  button.textContent = mode
  button.dataset.mode = mode
  button.onclick = () => boot(mode)
  el('modes').append(button)
}
el('action').onclick = () => action()
el('reverse').onclick = () => reverse()
el('pause').onclick = () => pause()
el('play').onclick = () => play()
el('dispose').onclick = () => dispose()
const fixture = {
  boot,
  get runtime() {
    return runtime
  },
  get sheet() {
    return sheet!
  },
  get modal() {
    return modal!
  },
  get nav() {
    return nav!
  },
  get physics() {
    return physics!
  },
  get keyboard() {
    return keyboard!
  },
  get symbol() {
    return symbol!
  },
  get states() {
    return keyboardStates
  },
  get changes() {
    return changes
  },
  el,
}
declare global {
  interface Window {
    fixture: typeof fixture
    ready: Promise<void>
  }
}
window.fixture = fixture
boot('sheet')
window.ready = Promise.resolve()
