import { createSSRApp, defineComponent, h, shallowRef } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'
export function render() {
  return renderToString(
    createSSRApp(
      defineComponent({
        setup() {
          const motion = useWebMotion(shallowRef<HTMLElement | null>(null))
          return () => h('main', { 'data-motion': typeof motion.animate }, 'SSR')
        },
      }),
    ),
  )
}
