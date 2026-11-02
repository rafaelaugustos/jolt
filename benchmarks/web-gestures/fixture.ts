import { createWebRuntime as createInternalRuntime } from '../../src/web/runtime.js'
import type {
  WebDrag,
  WebGestures,
  WebZoomable,
  WebScrollHeader,
  WebReorder,
  WebRefreshContext,
} from '../../src/web/public.js'
const stage = document.querySelector<HTMLElement>('#stage')!,
  status = document.querySelector<HTMLElement>('#status')!
let runtime = createInternalRuntime(document),
  controller: WebDrag | WebGestures | undefined
let zoom: WebZoomable | undefined,
  header: WebScrollHeader | undefined,
  reorder: WebReorder<string> | undefined,
  refreshContext: WebRefreshContext | undefined
let resolveRefresh: (() => void) | undefined,
  rejectRefresh: ((error: unknown) => void) | undefined
let order = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']
let value: ReturnType<typeof runtime.motionValue> | undefined
let lastDismiss: import('../../src/web/public.js').WebPhotoDismissal | undefined
const log: string[] = []
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
function setup(mode = 'drag', config: Record<string, unknown> = {}) {
  runtime.dispose()
  runtime = createInternalRuntime(document, { reducedMotion: 'never' })
  log.length = 0
  value = undefined
  zoom = undefined
  header = undefined
  reorder = undefined
  controller = undefined
  refreshContext = undefined
  stage.innerHTML = '<div id="surface"><div id="card">JOLT</div></div>'
  const surface = document.querySelector<HTMLElement>('#surface')!,
    card = document.querySelector<HTMLElement>('#card')!
  const record = (name: string) => () => {
    log.push(name)
    status.textContent = `${mode} · ${log.slice(-4).join(' → ')}`
  }
  if (mode === 'zoom') {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#315c91"/><circle cx="900" cy="180" r="100" fill="#f6c979"/><path d="M0 800L350 180 700 800M300 800L850 350 1200 800" fill="#8db6b5"/><text x="80" y="140" font-size="75" fill="white">Explore with Jolt</text></svg>'
    surface.innerHTML =
      '<img id="photo" alt="Illustrated mountain landscape" style="width:100%;height:100%;object-fit:contain;display:block">'
    const image = document.querySelector<HTMLImageElement>('#photo')!
    image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`
    zoom = runtime.zoomable(image, {
      viewport: surface,
      onDismiss(intent) {
        log.push('dismiss')
        lastDismiss = intent
      },
      onSettled: record('settled'),
      ...config,
    })
  } else if (mode === 'header') {
    surface.innerHTML =
      '<div id="scroll"><div id="rows"></div></div><header id="header" style="position:absolute;top:0;height:200px;width:100%;background:#6050ae;pointer-events:none"><h2 id="title" style="padding:80px 24px 0">Your collection</h2></header><div id="compact" style="position:absolute;top:16px;left:24px">Your collection</div>'
    const rows = document.querySelector<HTMLElement>('#rows')!
    for (let i = 0; i < 20; i++) {
      const row = document.createElement('div')
      row.dataset.key = String(i)
      row.textContent = `Album ${i + 1}`
      row.style.cssText = `height:${64 + (i % 3) * 12}px;padding:20px;border-bottom:1px solid #455`
      rows.append(row)
    }
    header = runtime.scrollHeader(document.querySelector<HTMLElement>('#scroll')!, {
      header: document.querySelector<HTMLElement>('#header')!,
      title: document.querySelector<HTMLElement>('#title')!,
      toolbarTitle: document.querySelector<HTMLElement>('#compact')!,
      minimum: 60,
      items: () =>
        [...rows.children].map((row) => ({
          key: (row as HTMLElement).dataset.key!,
          target: row as HTMLElement,
        })),
      onRefresh(context) {
        refreshContext = context
        log.push('refresh')
        return new Promise((resolve, reject) => {
          resolveRefresh = resolve
          rejectRefresh = reject
        })
      },
      onRefreshError: record('error'),
      ...config,
    })
  } else if (mode === 'reorder') {
    surface.innerHTML =
      '<div id="list" style="height:450px;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px"></div>'
    const list = document.querySelector<HTMLElement>('#list')!
    order = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']
    for (const [i, key] of order.entries()) {
      const row = document.createElement('div')
      row.dataset.key = key
      row.style.cssText = `flex:none;height:${60 + (i % 3) * 20}px;background:#304764;border-radius:10px;padding:10px;display:flex;align-items:center;justify-content:space-between`
      row.innerHTML = `<span>${key}</span><button data-grip aria-label="Move ${key}">Move</button>`
      list.append(row)
    }
    reorder = runtime.reorder(list, {
      items: () =>
        order.map((key) => ({
          key,
          target: list.querySelector<HTMLElement>(`[data-key="${key}"]`)!,
        })),
      handle: '[data-grip]',
      onCommit(move) {
        log.push('commit')
        order.splice(move.fromIndex, 1)
        order.splice(move.toIndex, 0, move.key)
        for (const key of order) list.append(list.querySelector(`[data-key="${key}"]`)!)
      },
      ...config,
    })
  } else if (mode === 'drag' || mode === 'value') {
    if (mode === 'value') {
      value = runtime.motionValue(0)
      runtime.bind(card, { x: value })
    }
    controller = runtime.drag(mode === 'value' ? surface : card, {
      axis: 'x',
      bounds: { left: -220, right: 220 },
      release: 'decay',
      rubberband: true,
      ...(value ? { value } : {}),
      onStart: record('start'),
      onMove: () => {},
      onCancel: record('cancel'),
      onRelease: record('release'),
      onSettle: record('settled'),
      ...config,
    })
  } else {
    if (mode === 'scroll')
      surface.innerHTML =
        '<div id="panel" style="position:absolute;inset:20px 30px 0;height:430px;border-radius:18px;background:#426588;overflow:hidden"><strong style="display:block;padding:12px 20px">Panel · drag to expand, then scroll</strong><div id="scroll" style="top:45px;height:385px"><div id="content">One contact: expand → scroll → reverse</div></div></div>'
    const g = runtime.gestures(
      surface,
      mode === 'scroll'
        ? {
            pan: { axis: 'y', bounds: { top: 0, bottom: 160 } },
            initial: { y: 160 },
            scroll: { element: document.querySelector<HTMLElement>('#scroll')! },
            onEnd: record('end'),
            ...config,
          }
        : {
            pan: true,
            pinch: { min: 0.5, max: 4 },
            rotate: true,
            onStart: record('start'),
            onEnd: record('end'),
            onTap: record('tap'),
            onDoubleTap: record('double'),
            ...config,
          },
    )
    controller = g
    if (mode !== 'scroll')
      runtime.bind(card, { x: g.x, y: g.y, scale: g.scale, rotate: g.rotate })
    else {
      runtime.bind(document.querySelector<HTMLElement>('#panel')!, { y: g.y })
      g.y.subscribe((y) => {
        status.textContent = `Panel ${y.toFixed(1)} · scroll ${document.querySelector('#scroll')!.scrollTop.toFixed(1)}`
      })
    }
  }
  status.textContent = mode
  const controls = document.querySelector<HTMLElement>('#controls')!
  controls.replaceChildren()
  const action = (label: string, id: string, run: () => void) => {
    const button = document.createElement('button')
    button.id = id
    button.textContent = label
    button.onclick = run
    controls.append(button)
  }
  if (controller) {
    action('Pause / resume', 'pause', () =>
      controller!.paused ? controller!.play() : controller!.pause(),
    )
    action('Cancel', 'cancel', () => controller!.cancel())
  }
  if (mode === 'gesture')
    action('Reset', 'reset', () => {
      if (controller && 'jumpTo' in controller)
        controller.jumpTo({ x: 0, y: 0, scale: 1, rotate: 0 })
    })
  if (zoom) {
    action('Reset zoom', 'reset', () => zoom!.reset())
    action('Request close', 'dismiss', () => zoom!.requestDismiss())
    action('Cancel close', 'cancel-dismiss', () => {
      lastDismiss?.cancel()
      status.textContent = 'Dismissal cancelled'
    })
  }
  if (header) {
    action('Scroll to album 6', 'item', () =>
      header!.scrollToItem('5', { behavior: 'smooth' }),
    )
    action('Back to top', 'top', () => header!.scrollToTop({ behavior: 'smooth' }))
    action('Insert above anchor', 'insert', () => {
      void header!.preserveAnchor(() => {
        const row = document.createElement('div')
        row.dataset.key = String(Date.now())
        row.textContent = 'New album · current row stays in place'
        row.style.cssText = 'height:100px;padding:24px;background:#416b67'
        document.querySelector('#rows')!.prepend(row)
      })
    })
    action('Complete refresh', 'finish', () => {
      resolveRefresh?.()
      status.textContent = 'Refresh complete'
    })
    action('Fail refresh', 'fail', () => {
      rejectRefresh?.(new Error('Offline'))
      status.textContent = 'Refresh failed · pull again to retry'
    })
  }
  if (reorder)
    action('Move first item down', 'move', () => {
      reorder!.moveDown(order[0]!)
      status.textContent = order.join(' → ')
    })
}
setup()
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))
  button.onclick = () => setup(button.dataset.mode)
const demo = {
  setup,
  frame,
  get controller() {
    return controller!
  },
  get runtime() {
    return runtime
  },
  get value() {
    return value
  },
  get zoom() {
    return zoom!
  },
  get header() {
    return header!
  },
  get reorder() {
    return reorder!
  },
  get order() {
    return [...order]
  },
  get dismissal() {
    return lastDismiss!
  },
  get refreshContext() {
    return refreshContext!
  },
  finishRefresh() {
    resolveRefresh?.()
  },
  failRefresh() {
    rejectRefresh?.(new Error('offline'))
  },
  log,
  snapshot() {
    return {
      position: controller ? { scale: 1, rotate: 0, ...controller.position } : undefined,
      zoom: zoom?.state,
      header: header?.state,
      order: [...order],
      log: [...log],
      inspect: runtime.inspect(stage),
      scroll: document.querySelector('#scroll')?.scrollTop ?? 0,
    }
  },
}
;(window as unknown as { demo: typeof demo }).demo = demo
export type Demo = typeof demo
