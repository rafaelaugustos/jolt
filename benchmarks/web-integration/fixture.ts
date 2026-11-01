import {
  createApp,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  Transition,
  vShow,
  watch,
  type Ref,
  type ShallowRef,
  withDirectives,
} from 'vue'
import { useWebMotion } from '../../src/web/vue/index.js'
import { createWebRuntime } from '../../src/web/runtime.js'
import type { WebPress } from '../../src/web/public.js'

let app: ReturnType<typeof createApp>
let state: {
  target: ShallowRef<HTMLElement | null>
  show: Ref<boolean>
  key: Ref<number>
  motion: ReturnType<typeof useWebMotion>
  feedback: () => WebPress | undefined
  events: string[]
  nextTick: typeof nextTick
}
const status = document.querySelector('#status')!
const events: string[] = []
function mount(
  config: {
    show?: boolean
    persisted?: boolean
    duration?: number
    press?: boolean
  } = {},
) {
  app?.unmount()
  events.length = 0
  document.querySelector('#app')!.replaceChildren()
  app = createApp(
    defineComponent({
      setup() {
        const target = shallowRef<HTMLElement | null>(null),
          show = ref(config.show ?? true),
          key = ref(0)
        const motion = useWebMotion(target, {
          initial: { opacity: 0, y: 35 },
          enter: {
            keyframes: { opacity: 1, y: 0 },
            transition: { duration: config.duration ?? 600, ease: 'easeOut' },
          },
          leave: {
            keyframes: { opacity: 0, y: -35 },
            transition: { duration: config.duration ?? 600, ease: 'easeIn' },
          },
        })
        let feedback: WebPress | undefined
        watch(
          target,
          (value) => {
            if (value && config.press !== false) {
              motion.set({ scale: 1.1 })
              feedback = motion.press({ scale: 0.96 })
            }
          },
          { flush: 'post' },
        )
        const event = (name: string) => {
          events.push(name)
          status.textContent = events.slice(-6).join(' → ')
        }
        state = { target, show, key, motion, feedback: () => feedback, events, nextTick }
        const shortcut = (e: KeyboardEvent) => {
          if (e.key.toLowerCase() === 'g' && !e.repeat && target.value) {
            motion.animate({ scale: 1.2 }, 'snappy')
            event('application scale 1.2')
          }
        }
        onMounted(() => {
          event('mounted')
          window.addEventListener('keydown', shortcut)
        })
        onScopeDispose(() => window.removeEventListener('keydown', shortcut))
        return () =>
          h('div', [
            h('nav', [
              h(
                'button',
                { id: 'toggle', onClick: () => (show.value = !show.value) },
                show.value ? 'Hide card' : 'Show card',
              ),
              h(
                'button',
                {
                  id: 'retarget',
                  onClick: () => {
                    motion.animate({ scale: 1.2, x: 60 }, 'snappy')
                    event('application retargeted')
                  },
                },
                'Animate application',
              ),
              h(
                'button',
                { id: 'replace', onClick: () => key.value++ },
                'Replace surface',
              ),
            ]),
            h('div', { id: 'stage' }, [
              h(
                Transition,
                {
                  ...motion.transition,
                  appear: true,
                  persisted: config.persisted,
                  onAfterEnter: () => event('entered'),
                  onAfterLeave: () => event('left'),
                  onEnterCancelled: [
                    motion.transition.onEnterCancelled,
                    () => event('enter cancelled'),
                  ],
                  onLeaveCancelled: [
                    motion.transition.onLeaveCancelled,
                    () => event('leave cancelled'),
                  ],
                },
                {
                  default: () => {
                    const card = h(
                      'button',
                      {
                        id: 'card',
                        key: key.value,
                        ref: target,
                        onClick: () => event('native click'),
                      },
                      'Hold to press',
                    )
                    return config.persisted
                      ? withDirectives(card, [[vShow, show.value]])
                      : show.value
                        ? card
                        : null
                  },
                },
              ),
            ]),
          ])
      },
    }),
  )
  app.mount('#app')
  return state
}
const lab = { mount, state: () => state, unmount: () => app.unmount(), createWebRuntime }
declare global {
  var integrationLab: typeof lab
}
globalThis.integrationLab = lab
mount({ persisted: true })
