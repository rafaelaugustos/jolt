import {
  createApp,
  defineComponent,
  effectScope,
  h,
  KeepAlive,
  nextTick,
  ref,
  shallowRef,
  withDirectives,
} from 'vue'
import { createWebRuntime } from '../../src/web/runtime.js'
import { useWebMotion, createViewportEnterDirective } from '../../src/web/vue/index.js'

function makeTarget() {
  const el = document.createElement('button')
  el.textContent = 'Motion'
  el.style.cssText =
    'width:120px;height:70px;display:block;margin:10px;background:#164c42;color:white'
  document.querySelector('#stage')!.append(el)
  return el
}
function mountDetached(directive = false) {
  const root = document.createElement('div')
  const runtime = createWebRuntime(document, { reducedMotion: 'never' })
  const shown = ref(true),
    key = ref(0),
    events: string[] = []
  const enter = createViewportEnterDirective({
    runtime,
    viewport: { keyframes: { opacity: [0.1, 1] }, transition: { duration: 120 } },
  })
  let target: HTMLElement | null = null
  const Child = defineComponent({
    setup() {
      const el = shallowRef<HTMLElement | null>(null)
      if (!directive) {
        const motion = useWebMotion(el, { runtime })
        motion.use((scope, surface) => {
          events.push('setup')
          scope.viewportEnter(surface, {
            keyframes: { opacity: [0.1, 1] },
            transition: { duration: 120 },
          })
          scope.add(() => events.push('cleanup'))
        })
      }
      return () => {
        const node = h(
          'button',
          {
            key: key.value,
            id: 'live-card',
            ref: (value: unknown) => {
              target = value as HTMLElement | null
              el.value = target
            },
            style: 'width:180px;height:100px',
          },
          'Ready',
        )
        return directive ? withDirectives(node, [[enter]]) : node
      }
    },
  })
  const app = createApp({
    render: () =>
      h(KeepAlive, null, {
        default: () => (shown.value ? h(Child) : h('div', 'Inactive')),
      }),
  })
  const errors: string[] = []
  app.config.errorHandler = (error) => errors.push(String(error))
  app.mount(root)
  return {
    root,
    runtime,
    events,
    errors,
    insert() {
      document.querySelector('#stage')!.append(root)
    },
    async show(value: boolean) {
      shown.value = value
      await nextTick()
    },
    async replace() {
      key.value++
      await nextTick()
    },
    get target() {
      return target
    },
    unmount() {
      app.unmount()
      root.remove()
    },
  }
}
function makeSource(rtl = false) {
  const el = document.createElement('div')
  el.style.cssText =
    'width:300px;height:140px;overflow:auto;direction:' + (rtl ? 'rtl' : 'ltr')
  el.tabIndex = 0
  const content = document.createElement('div')
  content.style.cssText =
    'width:1300px;height:100px;background:linear-gradient(90deg,#12645c,#b8f272)'
  el.append(content)
  document.querySelector('#stage')!.append(el)
  return el
}
function detachedTransition() {
  const scope = effectScope(),
    runtime = createWebRuntime(document)
  const surface = document.createElement('div')
  surface.style.cssText = 'width:100px;height:100px'
  const motion = scope.run(() =>
    useWebMotion(shallowRef(null), {
      runtime,
      enter: { keyframes: { opacity: [0, 1] }, transition: { duration: 100 } },
    }),
  )!
  let completions = 0
  return {
    surface,
    runtime,
    motion,
    get completions() {
      return completions
    },
    enter() {
      motion.transition.onEnter(surface, () => completions++)
    },
    stop() {
      scope.stop()
      runtime.dispose()
    },
  }
}
export const lab = {
  createWebRuntime,
  makeTarget,
  mountDetached,
  makeSource,
  detachedTransition,
}
Object.assign(window, { lab })
if (!new URLSearchParams(location.search).has('test')) void import('./demo.js')
declare global {
  var lab: typeof import('./fixture.js').lab
  var rt: ReturnType<typeof createWebRuntime>
  var target: HTMLElement
  var app: ReturnType<typeof mountDetached>
  var rows: import('../../src/web/public.js').WebItem[]
  var items: import('../../src/web/public.js').WebItemsAnimation
  var source: HTMLElement
  var input: import('../../src/web/public.js').WebScrollValue
  var link: import('../../src/web/public.js').WebScrollLink
  var transition: ReturnType<typeof detachedTransition>
}
