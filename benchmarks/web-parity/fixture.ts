import {
  createWebRuntime,
  resolveListTarget,
  type WebRuntime,
  type WebMotionScope,
  type WebAnimation,
  type WebRotationSensor,
  type WebGravitySensor,
  type WebGlass,
  type WebInteractiveNavigation,
  type WebNavigationEntry,
  type WebZoomable,
} from '../../src/web/public.js'
const el = (id: string) => document.getElementById(id)!
const labels = {
  gravity: [
    'Finite gravity',
    'Drop, toss, pause and interrupt a finite ballistic animation.',
  ],
  haptics: [
    'Opt-in haptic requests',
    'A browser request is not proof of vibration. Unsupported browsers return unavailable.',
  ],
  sensors: [
    'Device sensors',
    'Use a secure physical device. Readings start only after permission and an active binding. Rotation is in radians.',
  ],
  glass: [
    'Controlled browser glass',
    'CSS backdrop filtering with a solid accessibility fallback. This is not native Liquid Glass.',
  ],
  navigation: [
    'Interactive route return',
    'Drag from the left edge. A short release cancels; a committed exit calls the application router once.',
  ],
  gallery: [
    'Keyed photo gallery',
    'Open a photo, double-click to zoom, drag to dismiss. Return resolves the current item after virtualized cells are recycled.',
  ],
}
type Mode = keyof typeof labels
const status = (message: string) => {
  el('status').textContent = message
}
let runtime: WebRuntime,
  scope: WebMotionScope,
  animation: WebAnimation | undefined,
  sensor: WebRotationSensor | undefined,
  gravity: WebGravitySensor | undefined,
  glass: WebGlass | undefined,
  navigation: WebInteractiveNavigation | undefined,
  entry: WebNavigationEntry | undefined,
  zoom: WebZoomable | undefined
let mode: Mode = 'gravity',
  commits = 0,
  reject = false,
  items = Array.from({ length: 160 }, (_, i) => `photo-${i}`),
  selected = 'photo-0',
  deleted = false
let actions: { run(): void; reverse(): void; pause(): void; play(): void } = {
  run() {},
  reverse() {},
  pause() {
    scope.suspend()
  },
  play() {
    scope.resume()
  },
}
const picture = (key: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="hsl(${(Number(key.split('-')[1]) * 37) % 360},55%,55%)"/><stop offset="1" stop-color="#172c4c"/></linearGradient></defs><path fill="url(#g)" d="M0 0h640v400H0z"/><circle cx="470" cy="100" r="55" fill="#f4d1a2"/><path d="M0 400L190 120 350 330 460 200 640 400" fill="#153d55"/><text x="28" y="365" fill="white" font-family="sans-serif" font-size="28">${key}</text></svg>`)}`
function boot(next: Mode) {
  runtime?.dispose()
  mode = next
  runtime = createWebRuntime(document)
  scope = runtime.scope()
  animation = undefined
  sensor = undefined
  gravity = undefined
  glass = undefined
  navigation = undefined
  entry = undefined
  zoom = undefined
  commits = 0
  reject = false
  deleted = false
  items = Array.from({ length: 160 }, (_, i) => `photo-${i}`)
  el('title').textContent = labels[next][0]!
  el('description').textContent = labels[next][1]!
  el('stage').innerHTML = ''
  status('Ready')
  el('action').textContent = 'Run'
  el('reverse').textContent = 'Return'
  actions = {
    run() {},
    reverse() {},
    pause() {
      scope.suspend()
      status('Paused')
    },
    play() {
      scope.resume()
      status('Resumed')
    },
  }
  if (next === 'gravity') {
    el('stage').innerHTML = '<div class="floor"></div><div id="ball" class="ball">↓</div>'
    const ball = el('ball')
    actions.run = () => {
      runtime.set(ball, { y: 0 })
      animation = scope.animate(
        ball,
        { y: 280 },
        { type: 'gravity', acceleration: 1800, restitution: 0.6 },
      )
      status('Drop · finite ballistic playback')
    }
    actions.reverse = () => {
      animation = scope.animate(
        ball,
        { y: 280 },
        { type: 'gravity', acceleration: 1800, restitution: 0.6, velocity: -1050 },
      )
      status('Toss · signed velocity; interrupt from the current pose')
    }
    el('reverse').textContent = 'Toss / interrupt'
  } else if (next === 'haptics') {
    el('stage').innerHTML =
      '<button id="impact" style="position:absolute;left:35%;top:160px">Press for feedback</button><div id="pulse" class="ball" style="left:50px;top:290px">→</div>'
    scope.press(el('impact'), { scale: 0.94 })
    el('impact').onclick = () => status(JSON.stringify(runtime.haptic('light')))
    actions.run = () => {
      runtime.set(el('pulse'), { x: 0 })
      animation = scope.animate(
        el('pulse'),
        { x: 520 },
        { duration: 800, haptic: { style: 'medium', times: [0.5, 1] } },
      )
      status('Two scheduled requests · pause and seeking do not replay old cues')
    }
    actions.reverse = () => status(JSON.stringify(runtime.haptic('heavy')))
    el('reverse').textContent = 'Request heavy'
  } else if (next === 'sensors') {
    el('stage').innerHTML =
      '<div id="sensor-card" class="card sensor-card">Live device input</div>'
    sensor = scope.sensor('rotation', {
      onStatus: (s) => status(`Rotation: ${s}\nGravity: ${gravity?.status ?? 'idle'}`),
    })
    gravity = scope.sensor('gravity', {
      onStatus: (s) => status(`Rotation: ${sensor?.status ?? 'idle'}\nGravity: ${s}`),
    })
    scope.bind(el('sensor-card'), {
      rotate: scope.map(sensor.z, [-Math.PI, Math.PI], [-180, 180]),
      x: scope.map(gravity.x, [-10, 10], [-70, 70]),
      y: scope.map(gravity.y, [-10, 10], [70, -70]),
    })
    actions.run = () => {
      void Promise.all([sensor!.requestPermission(), gravity!.requestPermission()]).then(
        (r) =>
          status(
            `Permission: ${r.join(' / ')}\nRotation: ${sensor!.status}; gravity: ${gravity!.status}`,
          ),
      )
    }
    actions.reverse = () => {
      sensor!.recenter()
      status('Recenter on the next valid reading')
    }
    el('action').textContent = 'Enable device sensors'
    el('reverse').textContent = 'Recenter'
  } else if (next === 'glass') {
    el('stage').innerHTML =
      '<div class="scene"></div><div id="orb" class="orb"></div><section id="glass" class="glass"><h2>Keep content readable</h2><span>Backdrop filter · controlled intensity</span><button id="inside">Interactive content</button></section>'
    glass = scope.glass(el('glass'), { amount: 1, radius: 28 })
    scope.animate(
      el('orb'),
      { x: [0, 480, 0] },
      { duration: 6000, repeat: 20, ease: 'linear' },
    )
    actions.run = () => {
      animation = scope.add(glass!.animate(1, { duration: 900 }))
      status(JSON.stringify(glass!.snapshot()))
    }
    actions.reverse = () => {
      animation = scope.add(glass!.animate(0, { duration: 900 }))
      status('Clear surface · children remain interactive')
    }
    el('inside').onclick = () => status('Content button activated')
    el('action').textContent = 'Frost'
    el('reverse').textContent = 'Clear'
    status(JSON.stringify(glass.snapshot()))
  } else if (next === 'navigation') {
    el('stage').innerHTML =
      '<h2 style="padding:30px">List route</h2><section id="route" class="route"><h2>Detail route</h2><p>Drag from this left edge →</p><button id="nested">Nested button</button></section>'
    navigation = scope.interactiveNavigation(el('route'), {
      distance: el('stage').clientWidth,
      commit: () => {
        commits++
        status(
          `Router calls: ${commits}${reject ? ' · rejected, rolling back' : ' · accepted'}`,
        )
        if (!reject) el('route').hidden = true
        return !reject
      },
      onState: (s) => {
        el('title').textContent = `Interactive route · ${s}`
      },
    })
    actions.run = () => navigation!.back()
    actions.reverse = () => navigation!.cancel()
    el('action').textContent = 'Back'
    el('reverse').textContent = 'Cancel return'
  } else {
    el('stage').innerHTML =
      '<div id="list" class="list" tabindex="-1" aria-label="Photo collection"><div class="space"></div><div id="rows" class="rows"></div></div><section id="detail" class="detail" hidden><button id="back">Back to collection</button><div id="viewport" class="viewport"><img id="photo" alt="Selected landscape"></div></section>'
    const list = el('list'),
      rows = el('rows'),
      detail = el('detail'),
      photo = el('photo') as HTMLImageElement
    for (let i = 0; i < 12; i++) {
      const button = document.createElement('button')
      button.className = 'thumb'
      button.innerHTML = '<img alt="Landscape"><span></span>'
      rows.append(button)
      button.onclick = () => void open(button.dataset.key!)
    }
    const render = () => {
      const start = Math.min(
        Math.max(0, items.length - 12),
        Math.floor(list.scrollTop / 164) * 4,
      )
      rows.style.top = `${Math.floor(start / 4) * 164}px`
      ;[...rows.children].forEach((node, i) => {
        const button = node as HTMLButtonElement,
          key = items[start + i]
        button.hidden = !key
        if (!key) return
        button.dataset.key = key
        const img = button.querySelector('img')!
        img.dataset.key = key
        if (img.dataset.loaded !== key) {
          img.src = picture(key)
          img.dataset.loaded = key
        }
        button.querySelector('span')!.textContent = key
      })
    }
    list.onscroll = render
    render()
    const thumb = (key: string) =>
      [...rows.querySelectorAll('img')].find((img) => img.dataset.key === key)
    async function open(key: string) {
      selected = key
      entry?.dispose()
      zoom?.dispose()
      const source = thumb(key)
      await source?.decode()
      entry = scope.sharedNavigationEntry(el('stage'), {
        tag: key,
        source: () => thumb(key),
        detail: () => photo,
        transition: { duration: 420 },
        returnTarget: {
          key,
          resolve: (context) =>
            resolveListTarget(context, {
              container: list,
              indexOf: (k) => items.indexOf(k),
              scrollToIndex: async (index) => {
                list.scrollTop = Math.floor(index / 4) * 164
                render()
                await thumb(key)?.decode()
              },
              viewForKey: thumb,
              keyOf: (element) => element.dataset.key,
            }),
          fallbackFocus: () => list,
        },
        back: () => {
          commits++
          if (reject) return false
          detail.hidden = true
          list.hidden = false
          render()
        },
        onState: (s) => status(`Gallery: ${s} · ${key} · route calls ${commits}`),
      })
      const result = await entry.open(async () => {
        photo.src = picture(key)
        await photo.decode()
        list.hidden = true
        detail.hidden = false
      })
      if (result.navigated && entry.state === 'idle')
        zoom = scope.zoomable(photo, {
          viewport: el('viewport'),
          onDismiss: (intent) => {
            void entry!.returnFrom(intent)
          },
        })
      photo.focus({ preventScroll: true })
    }
    el('back').onclick = () => void entry?.back()
    actions.run = () => void open(items[0]!)
    el('action').textContent = 'Open first photo'
    actions.reverse = () => {
      items = items.filter((k) => k !== selected)
      deleted = true
      render()
      status('Selected item deleted · return uses collection focus fallback')
    }
    el('reverse').textContent = 'Delete selected item'
  }
}
for (const mode of Object.keys(labels) as Mode[]) {
  const button = document.createElement('button')
  button.dataset.mode = mode
  button.textContent = mode
  button.onclick = () => boot(mode)
  el('modes').append(button)
}
el('action').onclick = () => actions.run()
el('reverse').onclick = () => actions.reverse()
el('pause').onclick = () => actions.pause()
el('play').onclick = () => actions.play()
el('dispose').onclick = () => {
  scope.dispose()
  runtime.dispose()
  status('Disposed · resources released')
}
const fixture = {
  boot,
  el,
  picture,
  get runtime() {
    return runtime
  },
  get scope() {
    return scope
  },
  get animation() {
    return animation
  },
  get sensor() {
    return sensor
  },
  get gravity() {
    return gravity
  },
  get glass() {
    return glass
  },
  get navigation() {
    return navigation
  },
  get entry() {
    return entry
  },
  get zoom() {
    return zoom
  },
  get commits() {
    return commits
  },
  get deleted() {
    return deleted
  },
  get items() {
    return items
  },
  set reject(value: boolean) {
    reject = value
  },
  resolveListTarget,
}
declare global {
  interface Window {
    fixture: typeof fixture
    ready: Promise<void>
  }
}
window.fixture = fixture
window.ready = Promise.resolve()
boot('gravity')
