/** Reuse the published Web capabilities through each actual framework's resource owner. */
export function advancedSetup(scope, host, runtime) {
  host.innerHTML = `<section data-advanced>
  <h2>Portable dynamics & drawing</h2><p>Shared contracts, platform rendering, one component owner.</p>
  <div class="resource-stage"><div class="resource-card" data-map>MAP</div></div>
  <div class="controls"><button data-map-right>Map right</button><button data-map-left>Map left</button></div>
  <div class="resource-stage"><div class="resource-card" data-group>GROUP</div></div>
  <div class="controls"><button data-group-right>Group right</button><button data-group-left>Group left</button></div>
  <div class="resource-stage"><div class="resource-card pointer" data-state>STATE</div></div>
  <div class="controls"><button data-state-focus>Focus</button><button data-state-rest>Rest</button><button data-pet>Pet</button><button data-dress>Dress</button><button data-eat>Eat</button></div><output data-behavior>Ready</output>
  <div class="resource-stage"><div class="resource-card" data-seek>SEEK</div></div>
  <div class="controls"><button data-seek-quarter>Seek 25%</button><button data-seek-threequarters>Seek 75%</button><button data-seek-play>Play seek</button></div><output data-seek-status>Events: 0</output>
  <h2 data-gradient>Draw a little wonder.</h2>
  <div class="advanced-drawing"><div data-vectors></div><div data-stroke></div><div data-path>➤</div></div>
  <div class="controls"><button data-drawing-play>Play drawing</button><button data-drawing-pause>Pause drawing</button><button data-drawing-resume>Resume drawing</button><button data-drawing-clear>Clear drawing</button></div><output data-drawing-status>Retained shapes: 21</output>
  <div class="resource-stage"><button class="resource-card drag" data-inertia aria-label="Inertial card">DRAG</button></div><output data-inertia-status>Release with inertia</output>
  <output data-activity>Renderer: idle</output>
  <div class="advanced-viewport" data-viewport><div class="viewport-spacer">Scroll to enter</div><div class="viewport-card" data-entry-once>ONCE</div><div class="viewport-card pointer" data-entry-replay>REPLAY</div><div style="height:300px"></div></div>
  </section>`
  scope.add(() => host.replaceChildren())
  const q = (selector) => host.querySelector(selector),
    abort = new AbortController()
  scope.add(() => abort.abort())
  const on = (selector, callback) =>
    q(selector).addEventListener('click', callback, { signal: abort.signal })
  const source = scope.motionValue(0),
    mapped = scope.map(source, [0, 0.5, 1], [-100, 0, 100]),
    color = scope.map(source, [0, 1], ['#7766ff', '#dbff7a'])
  scope.bind(q('[data-map]'), { x: mapped, backgroundColor: color })
  const model = { x: 0, scale: 1 },
    render = () => {
      const node = q('[data-group]')
      if (node) node.style.transform = `translateX(${model.x}px) scale(${model.scale})`
    }
  const property = (name, unit) =>
    scope.property(model, {
      name: 'demo/' + name,
      units: [unit],
      spatial: true,
      read: (target) => target[name],
      write: (target, value) => {
        target[name] = value
        render()
      },
      encode: (value) => [value],
      decode: (values) => values[0],
    })
  const group = scope.propertyGroup({
    x: property('x', 'px'),
    scale: property('scale', 'ratio'),
  })
  const activity = scope.renderActivity({
    change: (active) => {
      const node = q('[data-activity]')
      if (node) node.textContent = 'Renderer: ' + (active ? 'active' : 'idle')
    },
    redraw: render,
  })
  const track = (animation) => {
    scope.add(activity.track(animation))
    return animation
  }
  on('[data-map-right]', () =>
    track(scope.animate(source, 1, { duration: 1000, ease: 'linear' })),
  )
  on('[data-map-left]', () =>
    track(scope.animate(source, 0, { duration: 1000, ease: 'linear' })),
  )
  on('[data-group-right]', () =>
    track(group.animate({ x: 100, scale: 1.25 }, { duration: 800 })),
  )
  on('[data-group-left]', () =>
    track(group.animate({ x: -100, scale: 0.8 }, { duration: 800 })),
  )
  const states = scope.motionStates(
    { card: q('[data-state]') },
    { rest: { card: { x: 0, scale: 1 } }, focus: { card: { x: 80, scale: 1.3 } } },
    { transition: { duration: 500 } },
  )
  const behaviors = scope.motionBehaviors(
    {
      rest: {
        priority: -1,
        run: ({ scope: run }) => {
          q('[data-behavior]').textContent = 'Behavior: rest'
          return run.animate(q('[data-state]'), { x: 0, scale: 1 }, { duration: 500 })
            .finished
        },
      },
      pet: {
        priority: 1,
        run: ({ scope: run }) =>
          run.animate(q('[data-state]'), { x: -90, scale: 1.1 }, { duration: 2500 })
            .finished,
      },
      dress: {
        priority: 2,
        blocks: ['eat'],
        run: ({ scope: run }) =>
          run.animate(q('[data-state]'), { x: 90, scale: 0.8 }, { duration: 3500 })
            .finished,
      },
      eat: {
        priority: 3,
        run: ({ scope: run }) =>
          run.animate(q('[data-state]'), { x: 0, scale: 1.4 }, { duration: 1000 })
            .finished,
      },
    },
    { rest: 'rest' },
  )
  on('[data-state-focus]', () => {
    behaviors.stop()
    states.to('focus')
  })
  on('[data-state-rest]', () => {
    behaviors.stop()
    states.to('rest')
  })
  for (const name of ['pet', 'dress', 'eat'])
    on('[data-' + name + ']', () => {
      states.stop()
      const allowed = behaviors.can(name)
      behaviors.request(name)
      q('[data-behavior]').textContent = name + ': ' + (allowed ? 'running' : 'blocked')
    })
  let events = 0
  const seekScene = scope.seekableTimeline(
    [
      {
        target: q('[data-seek]'),
        keyframes: { x: [-100, 100] },
        transition: { duration: 4000, ease: 'linear' },
      },
    ],
    { paused: true },
  )
  const cue = (name) => {
    events++
    q('[data-seek-status]').textContent = `Events: ${events} · ${name}`
  }
  const seek = scope.withTimelineCues(
    seekScene,
    [
      { name: 'first', at: 1000, effect: () => cue('first') },
      { name: 'second', at: 3000, effect: () => cue('second') },
    ],
    { late: 'catch-up' },
  )
  for (const [selector, progress] of [
    ['quarter', 0.25],
    ['threequarters', 0.75],
  ])
    on('[data-seek-' + selector + ']', () => {
      seek.pause()
      seek.progress = progress
      q('[data-seek-status]').textContent = `Events: ${events} · seek ${progress}`
    })
  on('[data-seek-play]', () => {
    track(seekScene)
    seek.play()
  })
  const path = 'M25 100 L95 25 L165 100 L235 25 L295 100'
  const drawing = scope.drawBatch(q('[data-vectors]'), {
    viewBox: [0, 0, 320, 185],
    styles: { dot: { fill: '#7766ff' } },
    items: Array.from({ length: 20 }, (_, i) => ({
      id: 'dot' + i,
      style: 'dot',
      kind: 'circle',
      cx: (i % 10) * 30 + 17,
      cy: Math.floor(i / 10) * 22 + 140,
      radius: 5,
    })),
  })
  const stroke = scope.shape(q('[data-stroke]'), {
    d: path,
    viewBox: [0, 0, 320, 185],
    stroke: '#dbff7a',
    strokeWidth: 4,
    strokeEnd: 0,
    unload: 'pause',
  })
  const title = scope.gradientText(q('[data-gradient]'), {
    colors: ['#dbff7a', '#7766ff'],
    sheen: { width: 0.25 },
  })
  let graphics = []
  on('[data-drawing-play]', () => {
    graphics.forEach((animation) => animation.stop())
    stroke.set({ strokeEnd: 0 })
    graphics = [
      stroke.animate({ strokeEnd: 1 }, { duration: 2500, ease: 'linear' }),
      scope.animate(
        q('[data-path]'),
        { path, orient: true },
        { duration: 2500, ease: 'linear' },
      ),
      title.play({ duration: 1800, ease: 'linear' }),
    ]
    graphics.forEach(track)
  })
  on('[data-drawing-pause]', () => graphics.forEach((animation) => animation.pause()))
  on('[data-drawing-resume]', () => graphics.forEach((animation) => animation.play()))
  on('[data-drawing-clear]', () => {
    scope.release(drawing)
    scope.release(stroke)
    q('[data-drawing-status]').textContent = 'Retained shapes: 0'
  })
  const drag = scope.drag(q('[data-inertia]'), {
    axis: 'x',
    bounds: { left: -115, right: 115 },
    release: 'decay',
    rubberband: false,
    onMove: (event) => {
      q('[data-inertia-status]').textContent = 'x: ' + event.x.toFixed(0)
    },
    onSettle: (event) => {
      q('[data-inertia-status]').textContent = 'Settled: ' + event.x.toFixed(0)
    },
  })
  const viewport = q('[data-viewport]')
  const once = scope.viewportEnter(q('[data-entry-once]'), {
    root: viewport,
    threshold: 0.5,
    once: true,
    transition: { duration: 500 },
  })
  const replay = scope.viewportEnter(q('[data-entry-replay]'), {
    root: viewport,
    threshold: 0.5,
    once: false,
    transition: { duration: 500 },
  })
  ;(window.advancedOwners ??= []).push({
    scope,
    source,
    mapped,
    color,
    group,
    states,
    behaviors,
    seekScene,
    seek,
    drawing,
    stroke,
    title,
    drag,
    once,
    replay,
    activity,
    model,
    host,
  })
}
