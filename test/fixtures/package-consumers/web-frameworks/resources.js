import { createPreset } from '@rafaelaugusto/jolt/web'
import { createMotionInspector } from '@rafaelaugusto/jolt/web/inspector'

/** The actual framework owns this host; its scoped setup owns this adapter-generated scene. */
export function resourceSetup(scope, host, runtime) {
  host.innerHTML = `<h2>Portable interaction lab</h2><p>One framework owner, existing Web runtime resources.</p>
  <div class="controls"><button data-value-right>Spring right</button><button data-value-left>Interrupt left</button><button data-preset>Parameterized preset</button></div>
  <div class="resource-stage"><div class="resource-card" data-value>VALUE</div></div>
  <div class="resource-stage" data-pointer-region><div class="resource-card pointer" data-pointer>POINTER</div></div><output data-pointer-status>centered</output>
  <div class="resource-stage"><button class="resource-card drag" data-drag aria-label="Drag card">DRAG</button></div><output data-drag-status>0</output>
  <div class="controls"><button data-stagger>Stagger + cues</button><button data-sequence>Sequence</button><button data-cancel>Cancel timeline</button></div>
  <div class="resource-stage bars"><div data-bar></div><div data-bar></div><div data-bar></div></div><output data-cues>Events: 0</output>
  <div class="resource-stage" data-layout-host><div class="resource-card" data-layout>LAYOUT</div></div><button data-layout-toggle>Toggle shared layout</button>
  <div class="resource-scroll" data-scroll><div data-scroll-header>Scroll-linked header</div><div class="resource-scroll-content">Scroll to reveal progress</div></div><output data-scroll-status>0</output>
  <p data-inspector>Inspector: pull sampling · computed style</p><button data-inspect>Inspect sample</button>`
  scope.add(() => host.replaceChildren())
  const query = (selector) => host.querySelector(selector)
  const abort = new AbortController()
  scope.add(() => abort.abort())
  const on = (selector, action) =>
    query(selector).addEventListener('click', action, { signal: abort.signal })
  const value = scope.motionValue(0),
    spring = scope.springValue(value, { stiffness: 170, damping: 18 })
  scope.bind(query('[data-value]'), { x: spring })
  on('[data-value-right]', () => value.set(100))
  on('[data-value-left]', () => value.set(-80))
  const pointer = scope.pointerFollow(query('[data-pointer-region]'), {
    coordinates: 'normalized',
    spring: false,
  })
  scope.bind(query('[data-pointer]'), {
    x: scope.map(pointer.x, [-1, 1], [-80, 80]),
    y: scope.map(pointer.y, [-1, 1], [-25, 25]),
  })
  scope.subscribe(pointer.presence, (active) => {
    query('[data-pointer-status]').textContent = active ? 'active' : 'centered'
  })
  const drag = scope.drag(query('[data-drag]'), {
    axis: 'x',
    bounds: { left: -100, right: 100 },
    snap: [-100, 0, 100],
    onMove: (event) => {
      query('[data-drag-status]').textContent = String(Math.round(event.x))
    },
    onSettle: (event) => {
      query('[data-drag-status]').textContent = String(Math.round(event.x))
    },
  })
  const bars = [...host.querySelectorAll('[data-bar]')]
  let timeline,
    cueCount = 0
  const reset = () => {
    if (timeline) scope.release(timeline)
    runtime.set(bars, { opacity: 0, scale: 0.8 })
    cueCount = 0
    query('[data-cues]').textContent = 'Events: 0'
  }
  on('[data-stagger]', () => {
    reset()
    const scene = runtime.timeline(
      bars.map((bar, index) => [
        bar,
        { opacity: 1, scale: 1 },
        { duration: 700, at: index * 250 },
      ]),
    )
    timeline = scope.withTimelineCues(
      scene,
      [
        {
          name: 'bite',
          at: 350,
          effect: () => {
            cueCount++
            query('[data-cues]').textContent = `Events: ${cueCount}`
            return () => {}
          },
        },
        {
          name: 'rest',
          at: 950,
          effect: () => {
            cueCount++
            query('[data-cues]').textContent = `Events: ${cueCount}`
          },
        },
      ],
      { late: 'catch-up' },
    )
  })
  on('[data-sequence]', () => {
    reset()
    timeline = scope.sequence(
      bars.map((bar) => [bar, { opacity: 1, scale: 1 }, { duration: 350 }]),
    )
  })
  on('[data-cancel]', () => {
    timeline?.dispose?.()
    timeline?.stop?.()
    query('[data-cues]').textContent = `Cancelled · Events: ${cueCount}`
  })
  const layout = scope.sharedLayout(query('[data-layout-host]'), {
    transition: { duration: 550 },
  })
  scope.add(layout.attach(query('[data-layout]'), 'card'))
  let expanded = false
  on('[data-layout-toggle]', () =>
    layout.transition(() => {
      expanded = !expanded
      Object.assign(query('[data-layout]').style, {
        width: expanded ? '180px' : '70px',
        height: expanded ? '95px' : '70px',
        marginLeft: expanded ? '90px' : '0px',
      })
    }),
  )
  const scroll = scope.scrollValue(query('[data-scroll]'))
  scope.scrollLinked(
    query('[data-scroll]'),
    query('[data-scroll-header]'),
    { scale: [1, 0.7], y: [0, -20] },
    { range: [0, 300] },
  )
  scope.subscribe(scroll, (offset) => {
    query('[data-scroll-status]').textContent = Math.min(1, offset / 300).toFixed(2)
  })
  const inspector = scope.add(
    createMotionInspector(host.ownerDocument, runtime, {
      development: true,
      capacity: 8,
      diagnostics: window.expansionDiagnostics,
    }),
  )
  scope.add(inspector.watch(query('[data-value]'), 'value'))
  on('[data-inspect]', () => {
    const sample = inspector.sample('value', 'x', spring.get())
    query('[data-inspector]').textContent =
      `Inspector: ${sample.source} · expected ${sample.expected.toFixed(1)} · observed ${sample.observed?.toFixed(1)}`
  })
  on('[data-preset]', () => {
    const recipe = createPreset('fadeInUp', { distance: 55, scale: 0.65, duration: 550 })
    scope.animate(query('[data-layout]'), recipe.keyframes, recipe.transition)
  })
  const record = { scope, value, spring, pointer, drag, layout, scroll, inspector, host }
  ;(window.expansionOwners ??= []).push(record)
}
