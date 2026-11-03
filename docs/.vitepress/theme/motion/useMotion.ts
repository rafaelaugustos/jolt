import { inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { createWebRuntime, type WebRuntime } from '../../../../src/web/public'
import { reduceMotionKey } from './preferences'

/** Each mounted island owns its runtime; no native entry or browser work during SSR. */
export function useMotion(setup: (runtime: WebRuntime) => void | (() => void)) {
  const reduced = inject(reduceMotionKey, ref(false))
  const ready = ref(false)
  let runtime: WebRuntime | undefined
  let cleanup: (() => void) | void
  const unwatch = watch(reduced, (value) =>
    runtime?.configure({ reducedMotion: value ? 'always' : 'user' }),
  )
  onMounted(() => {
    try {
      runtime = createWebRuntime(document, {
        reducedMotion: reduced.value ? 'always' : 'user',
      })
      cleanup = setup(runtime)
      ready.value = true
    } catch (error) {
      runtime?.dispose()
      console.error('[Jolt site] Motion setup failed:', error)
    }
  })
  onUnmounted(() => {
    unwatch()
    cleanup?.()
    runtime?.dispose()
  })
  return { ready, reduced }
}
