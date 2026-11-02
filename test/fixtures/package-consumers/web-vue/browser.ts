import {
  createApp,
  defineComponent,
  h,
  ref,
  shallowRef,
  Transition,
  onMounted,
} from 'vue'
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'

createApp(
  defineComponent({
    setup() {
      const target = shallowRef<HTMLElement | null>(null),
        shown = ref(true)
      const motion = useWebMotion(target, {
        initial: { opacity: 0 },
        enter: { keyframes: { opacity: 1 }, transition: { duration: 120 } },
        leave: { keyframes: { opacity: 0 }, transition: { duration: 300 } },
      })
      onMounted(() => {
        motion.set({ scale: 1.1 })
        motion.press()
      })
      return () =>
        h('main', [
          h(
            'button',
            { id: 'toggle', onClick: () => (shown.value = !shown.value) },
            'Toggle',
          ),
          h(
            'button',
            {
              id: 'visual',
              async onClick() {
                const paint = motion.animate(
                  { backgroundColor: '#0f0', borderRadius: '20px 8px' },
                  { duration: 60 },
                )
                const size = motion.animateSize(
                  { width: 220, height: 120 },
                  { duration: 80 },
                )
                const done = await Promise.all([paint.finished, size.finished])
                const layout = await motion.animateLayout(
                  () => {
                    target.value!.textContent = 'Resized and recolored'
                  },
                  { duration: 40 },
                ).finished
                document.querySelector('#visual-status')!.textContent = String(
                  done.every(Boolean) && layout,
                )
              },
            },
            'Visual motion',
          ),
          h(
            Transition,
            {
              ...motion.transition,
              appear: true,
              onAfterEnter: () =>
                (document.querySelector('#status')!.textContent = 'entered'),
              onAfterLeave: () =>
                (document.querySelector('#status')!.textContent = 'left'),
            },
            {
              default: () =>
                shown.value
                  ? h(
                      'button',
                      {
                        id: 'card',
                        ref: target,
                        style: 'width:180px;height:100px;margin:80px',
                      },
                      'Press',
                    )
                  : null,
            },
          ),
        ])
    },
  }),
).mount('#app')
