import { createWebRuntime } from '../../src/web/runtime.js'
import { createApp, defineComponent, h, KeepAlive, nextTick, ref, shallowRef } from 'vue'
import { useWebMotion } from '../../src/web/vue/index.js'
import type { WebAnimation, WebGradient, WebMotionScope } from '../../src/web/public.js'

let runtime = createWebRuntime(document, { reducedMotion: 'never' })
let scope: WebMotionScope = runtime.scope()
let gradient: WebGradient | undefined, animation: WebAnimation | undefined
let mode = 'gradient',
  iteration = 0
const stage = document.querySelector<HTMLElement>('#stage')!
const status = document.querySelector<HTMLElement>('#status')!
function setup(next = 'gradient') {
  runtime.dispose()
  runtime = createWebRuntime(document, { reducedMotion: 'never' })
  scope = runtime.scope()
  mode = next
  iteration = 0
  gradient = animation = undefined
  stage.innerHTML =
    '<div id="surface"><div id="text">Make every detail count.</div></div>'
  const surface = document.querySelector<HTMLElement>('#surface')!
  const text = document.querySelector<HTMLElement>('#text')!
  if (next === 'gradient')
    gradient = scope.gradient(surface, {
      type: 'linear',
      colors: ['#4135c2', '#af4e86'],
      angle: 120,
    })
  if (next === 'loading') {
    text.textContent = ''
    text.style.cssText =
      'display:block;width:65%;height:30px;background:#59688d;border-radius:8px;position:absolute;top:40px'
    scope.shimmer(text)
    const area = document.createElement('div')
    area.id = 'indicator'
    area.style.cssText = 'position:absolute;bottom:25px;width:90px;height:90px'
    surface.append(area)
    scope.loader(area, { style: 'dots', color: '#f3be7c', size: 70 })
  }
  if (next === 'roll') text.textContent = '$1,249.90'
  if (next === 'reveal')
    surface.style.background = 'linear-gradient(135deg,#6d4ab9,#c66472)'
  status.textContent = `${mode} · ready`
  document.querySelector<HTMLElement>('#heading')!.textContent = (
    {
      gradient: 'Color that follows you.',
      loading: 'A little motion while you wait.',
      reveal: 'Open a new perspective.',
      text: 'Words, with a little rhythm.',
      roll: 'Every change counts.',
    } as Record<string, string>
  )[next]!
}
function action(reverse = false) {
  const surface = document.querySelector<HTMLElement>('#surface')!,
    text = document.querySelector<HTMLElement>('#text')!
  iteration++
  if (mode === 'gradient')
    animation = gradient!.animate(
      {
        colors: reverse ? ['#4135c2', '#af4e86'] : ['#087e8b', '#f5cf8e'],
        angle: reverse ? 120 : 300,
      },
      { duration: 1300, bounce: 0.2 },
    )
  if (mode === 'reveal')
    animation = reverse
      ? scope.reveal(surface, { from: { x: 80, y: 80 }, duration: 1100 })
      : scope.conceal(surface, { to: { x: 80, y: 80 }, duration: 1100 })
  if (mode === 'text')
    animation = scope.animateText(text, {
      by: reverse ? 'word' : 'letter',
      duration: 700,
      stagger: reverse ? 120 : 50,
      y: 20,
    })
  if (mode === 'roll')
    animation = scope.rollTo(text, reverse ? 899.25 : 12980.6 + iteration, {
      format: (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      duration: 1100,
      stagger: 35,
    })
  if (mode === 'loading') {
    scope.suspend()
    scope.resume()
  }
  status.textContent = `${mode} · ${reverse ? 'interrupted / reversed' : 'playing'}`
}
export const demo = {
  setup,
  action,
  get runtime() {
    return runtime
  },
  get scope() {
    return scope
  },
  get gradient() {
    return gradient!
  },
  get animation() {
    return animation!
  },
  frame: () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  inspect: () => runtime.inspect(stage),
  async vueLifecycle() {
    setup('text')
    const host = document.createElement('div')
    document.body.append(host)
    const show = ref(true),
      key = ref(0)
    const events: string[] = []
    const Component = defineComponent({
      setup() {
        const el = shallowRef<HTMLElement | null>(null)
        const motion = useWebMotion(el, { runtime })
        motion.use((scope, target) => {
          events.push('setup')
          scope.gradient(target, { type: 'linear', colors: ['red', 'blue'] })
          scope.shimmer(target)
          scope.loader(target)
          scope.animateText(target, { duration: 10000 }).pause()
          scope.add(() => events.push('cleanup'))
        })
        return () =>
          h(
            'div',
            { key: key.value, ref: el, style: 'width:200px;height:60px' },
            'Vue text',
          )
      },
    })
    const app = createApp({
      setup: () => () => h(KeepAlive, () => (show.value ? h(Component) : null)),
    })
    app.mount(host)
    const flush = async () => {
      await nextTick()
      await demo.frame()
    }
    await flush()
    const mounted = demo.inspect().interactions
    key.value++
    await flush()
    const replaced = demo.inspect().interactions
    show.value = false
    await flush()
    const deactivated = demo.inspect().interactions
    show.value = true
    await flush()
    const reactivated = demo.inspect().interactions
    app.unmount()
    await flush()
    host.remove()
    return { mounted, replaced, deactivated, reactivated, ended: demo.inspect(), events }
  },
}
Object.assign(window, { demo })
document
  .querySelectorAll<HTMLButtonElement>('[data-mode]')
  .forEach((button) => (button.onclick = () => setup(button.dataset.mode)))
document.querySelector<HTMLButtonElement>('#action')!.onclick = () => action()
document.querySelector<HTMLButtonElement>('#reverse')!.onclick = () => action(true)
document.querySelector<HTMLButtonElement>('#pause')!.onclick = () => {
  scope.suspend()
  status.textContent = 'Paused'
}
document.querySelector<HTMLButtonElement>('#play')!.onclick = () => {
  scope.resume()
  status.textContent = 'Resumed'
}
document.querySelector<HTMLButtonElement>('#reduced')!.onclick = () => {
  runtime.configure({ reducedMotion: 'always' })
  status.textContent = 'Reduced motion'
}
document.querySelector<HTMLButtonElement>('#dispose')!.onclick = () => {
  scope.dispose()
  status.textContent = 'Disposed — original styles restored'
}
setup()
