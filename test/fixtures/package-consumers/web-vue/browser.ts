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
