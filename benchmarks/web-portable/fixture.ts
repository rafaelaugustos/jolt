import { portableDots } from '../../demo/src/portable-recipe.js'
import { createWebRuntime, type WebAnimation } from '../../src/web/public.js'
import { portableScene } from './scene.js'
const el = (id: string) => document.getElementById(id)!
const status = (text: string) => {
  el('status').textContent = text
}
let runtime = createWebRuntime(document),
  scope = runtime.scope(),
  mode = 'groups'
let run = () => {},
  playback: WebAnimation | undefined
const dots = portableDots
function boot(next = mode) {
  runtime.dispose()
  runtime = createWebRuntime(document)
  scope = runtime.scope()
  mode = next
  playback = undefined
  el('stage').replaceChildren()
  el('variant').style.display = mode === 'drawing' ? '' : 'none'
  let sceneFrames = () => 0,
    sceneValues = () => [] as number[]
  if (mode === 'pointer') {
    el('stage').innerHTML =
      '<div id="region"><div id="dot"></div><button id="inside">Tap still works</button></div>'
    const pointer = scope.pointerFollow(el('region'), {
      range: { x: [-300, 300], y: [-110, 110] },
    })
    scope.bind(el('dot'), { x: pointer.x, y: pointer.y })
    scope.subscribe(pointer.presence, (value) =>
      status(
        `Presence ${value} · mouse or hovering pen\nTouch does not synthesize hover`,
      ),
    )
    let taps = 0
    el('inside').onclick = () => {
      el('inside').dataset.actions = String(++taps)
      status(`Button actions: ${taps}`)
    }
    scope.press(el('inside'))
    run = () => {
      el('region').style.inset = '55px'
      pointer.refresh()
      status('Input region resized · move, leave and re-enter')
    }
    status('Move the pointer into the chart region')
  } else if (mode === 'drawing') {
    const items = dots()
    const drawing = scope.drawBatch(el('stage'), {
      viewBox: [0, 0, 760, 300],
      styles: {
        dots: { fill: '#63e3c2', strokeWidth: 0 },
        signal: { fill: '#ffc572', strokeWidth: 0 },
      },
      items,
    })
    let phase = 0,
      showingIndicator = false
    el('variant').onclick = () => {
      showingIndicator = !showingIndicator
      drawing.set({
        items: showingIndicator
          ? Array.from({ length: 10 }, (_, i) => ({
              id: `segment-${i}`,
              style: i < 7 ? 'signal' : 'dots',
              kind: 'rect' as const,
              x: 45 + i * 68,
              y: 100,
              width: 50,
              height: 100,
            }))
          : items,
      })
      status(
        showingIndicator
          ? 'Segmented progress · same drawing owner'
          : 'Dense chart · same drawing owner',
      )
    }
    run = () => {
      if (showingIndicator) el('variant').click()
      phase++
      drawing.update(
        items
          .filter((_, i) => i % 7 === phase % 7)
          .map((item) => ({
            ...item,
            style: phase % 2 ? 'signal' : 'dots',
            ...(item.kind === 'circle' ? { radius: phase % 2 ? 8 : 4 } : {}),
          })),
      )
      status(
        `${drawing.snapshot().items} ordered items · one SVG surface\nTargeted updates; whole-surface motion remains separate`,
      )
      playback = scope.animate(el('stage'), { scale: [1, 0.94, 1] }, { duration: 900 })
    }
    status('259 chart dots · one host · bounded retained paths')
  } else {
    el('stage').innerHTML =
      '<div class="bars" style="height:75%"><div class="bar"></div><div class="bar"></div><div class="bar"></div></div><canvas id="scene" width="800" height="100" style="height:25%"></canvas>'
    const bars = [...document.querySelectorAll<HTMLElement>('.bar')]
    const definition = {
      name: 'demo/height',
      units: ['CSS px'],
      spatial: true,
      read: (target: object) => parseFloat((target as HTMLElement).style.height || '35'),
      write: (target: object, value: number) => {
        ;(target as HTMLElement).style.height = `${value}px`
      },
      encode: (value: number) => [value],
      decode: (value: readonly number[]) => value[0]!,
    }
    const scene = portableScene(el('scene') as HTMLCanvasElement, scope)
    sceneFrames = () => scene?.frames ?? 0
    sceneValues = () => scene?.properties.map((property) => property.get()) ?? []
    const properties = bars.map((bar) => scope.property(bar, definition))
    const group = scope.propertyGroup({
      a: properties[0]!,
      b: properties[1]!,
      c: properties[2]!,
    })
    const uniforms =
      scene &&
      scope.propertyGroup({
        a: scene.properties[0]!,
        b: scene.properties[1]!,
        c: scene.properties[2]!,
      })
    let boundaries = 0,
      phase = false
    const activity = scope.renderActivity({
      change(active) {
        scene?.render(active)
        status(
          `Renderer demand: ${active ? 'active' : 'idle'} · boundary ${++boundaries}\nThree DOM adapters + three WebGL uniforms`,
        )
      },
      redraw() {
        scene?.draw()
      },
    })
    run = () => {
      phase = !phase
      playback = group.animate(
        phase ? { a: 120, b: 240, c: 180 } : { a: 240, b: 80, c: 120 },
        { duration: 1600, ease: 'linear' },
      )
      activity.track(playback)
      if (uniforms)
        activity.track(
          uniforms.animate(phase ? { a: 0.8, b: 0.4, c: 1 } : { a: 0.25, b: 1, c: 0.5 }, {
            duration: 1600,
            ease: 'linear',
          }),
        )
    }
    status('Three adapters · one playback · no idle render polling')
  }
  Object.assign(window, {
    portable: {
      runtime,
      scope,
      boot,
      dots,
      run,
      sceneFrames,
      sceneValues,
      get playback() {
        return playback
      },
    },
  })
}
document
  .querySelectorAll<HTMLButtonElement>('[data-mode]')
  .forEach((button) => (button.onclick = () => boot(button.dataset.mode)))
el('run').onclick = () => run()
el('pause').onclick = () => scope.suspend()
el('resume').onclick = () => scope.resume()
el('reset').onclick = () => boot()
boot(new URLSearchParams(location.search).get('mode') ?? 'groups')
declare global {
  interface Window {
    portable: {
      runtime: typeof runtime
      scope: typeof scope
      boot: typeof boot
      dots: typeof dots
      run(): void
      sceneFrames(): number
      sceneValues(): number[]
      readonly playback?: WebAnimation
    }
  }
}
