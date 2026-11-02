import {
  createApp,
  defineComponent,
  h,
  KeepAlive,
  nextTick,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
} from 'vue'
import { createWebRuntime } from '../../src/web/runtime.js'
import { useWebMotion } from '../../src/web/vue/index.js'
import type {
  WebMotionScope,
  WebPointerFollow,
  WebViewportEntrance,
  WebMotionValue,
  WebReadableValue,
  WebAnimation,
  WebSharedLayout,
  WebSharedLayoutAnimation,
  WebDiagnostics,
  WebDrag,
} from '../../src/web/public.js'

const rt = createWebRuntime(document)
const region = document.querySelector<HTMLElement>('#region')!
const target = document.querySelector<HTMLElement>('#target')!
const sibling = document.querySelector<HTMLElement>('#sibling')!
const scroller = document.querySelector<HTMLElement>('#scroller')!
const cards = [...document.querySelectorAll<HTMLElement>('.card')]
let app: ReturnType<typeof createApp> | undefined
function mountVue(borrow = false, fail = false) {
  app?.unmount()
  const show = ref(true),
    key = ref(0),
    pulse = ref(0)
  const events: string[] = [],
    errors: string[] = []
  let motion: ReturnType<typeof useWebMotion>
  let current: HTMLElement | null = null,
    input: WebMotionValue | undefined,
    output: WebReadableValue | undefined
  let renders = 0,
    old: HTMLElement | undefined
  const Child = defineComponent({
    setup() {
      const el = shallowRef<HTMLElement | null>(null)
      motion = useWebMotion(el, borrow ? { runtime: rt } : {})
      motion.use((scope, target) => {
        current = target
        events.push('setup')
        input = scope.motionValue(0)
        output = scope.springValue(input, { stiffness: 200, damping: 24 })
        scope.bind(target, { x: output })
        scope.observeGeometry(target)
        if (!borrow) scope.press(target)
        scope.add(() => events.push('cleanup'))
        if (fail) throw new Error('intentional setup failure')
      })
      onMounted(() => {
        if (borrow) rt.press(el.value!)
      })
      onScopeDispose(() => events.push('unmount'))
      return () => {
        renders++
        return h(
          'button',
          {
            id: 'vue-card',
            key: key.value,
            ref: el,
            onClick: () => {
              pulse.value++
              motion.animate('pulse')
            },
          },
          'Press + pulse',
        )
      }
    },
  })
  app = createApp({
    setup: () => () =>
      h('div', [
        h('div', { id: 'vue-controls' }, [
          h(
            'button',
            { id: 'vue-retarget', onClick: () => input?.set(input.get() > 0 ? 0 : 130) },
            'Retarget',
          ),
          h(
            'button',
            {
              id: 'vue-toggle',
              onClick: () => {
                old = current ?? undefined
                show.value = !show.value
              },
            },
            show.value ? 'Deactivate' : 'Reactivate',
          ),
          h(
            'button',
            {
              id: 'vue-replace',
              onClick: () => {
                old = current ?? undefined
                key.value++
              },
            },
            'Replace ref',
          ),
        ]),
        h(KeepAlive, null, { default: () => (show.value ? h(Child) : null) }),
      ]),
  })
  app.config.errorHandler = (error) => errors.push(String(error))
  app.mount('#app')
  return {
    show,
    key,
    events,
    errors,
    pulse,
    nextTick,
    motion: () => motion,
    input: () => input!,
    output: () => output!,
    target: () => current!,
    old: () => old,
    renders: () => renders,
    unmount: () => app?.unmount(),
  }
}
const lab = {
  rt,
  region,
  target,
  sibling,
  scroller,
  cards,
  createWebRuntime,
  mountVue,
  scope: undefined as WebMotionScope | undefined,
  other: undefined as WebMotionScope | undefined,
  pointer: undefined as WebPointerFollow | undefined,
  entrance: undefined as WebViewportEntrance | undefined,
  value: undefined as WebMotionValue | undefined,
  animation: undefined as WebAnimation | undefined,
  shared: undefined as WebSharedLayout | undefined,
  flight: undefined as WebSharedLayoutAnimation | undefined,
  previousFlight: undefined as WebSharedLayoutAnimation | undefined,
  diagnostic: undefined as WebDiagnostics | undefined,
  dialog: undefined as HTMLDialogElement | undefined,
  sheet: undefined as HTMLElement | undefined,
  drag: undefined as WebDrag | undefined,
  detail: undefined as HTMLElement | undefined,
  vue: undefined as ReturnType<typeof mountVue> | undefined,
  read(element = target) {
    const matrix = new DOMMatrix(getComputedStyle(element).transform)
    return {
      x: matrix.e,
      y: matrix.f,
      scale: matrix.a,
      opacity: Number(getComputedStyle(element).opacity),
    }
  },
}
declare global {
  var lifecycleLab: typeof lab
}
Object.assign(window, { lifecycleLab: lab })
window.addEventListener(
  'pagehide',
  () => {
    app?.unmount()
    rt.dispose()
  },
  { once: true },
)

if (location.search.includes('demo='))
  void import('./demo.js').then(({ demo }) => demo(lab))
export type LifecycleLab = typeof lab
