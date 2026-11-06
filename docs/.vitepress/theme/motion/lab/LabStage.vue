<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { useMotion } from '../useMotion'
import { useWords } from '../copy'
import { playWords, type Experiment, type LabControls } from './types'

const props = defineProps<{ experiment: Experiment }>()
const emit = defineEmits<{ ready: [value: boolean] }>()
const { t } = useWords()
const host = ref<HTMLElement>()
const controls = shallowRef<LabControls>()
const parameter = ref(props.experiment.parameter?.value ?? 0)
const status = ref('')
const failed = ref(false)
let generation = 0
function failure(error: unknown) {
  failed.value = true
  status.value = String(error)
  console.error('[Jolt playground]', error)
}
function invoke(run?: () => unknown) {
  if (!run) return
  const current = generation
  try {
    Promise.resolve(run()).catch((error) => {
      if (current === generation) failure(error)
    })
  } catch (error) {
    failure(error)
  }
}
const { ready } = useMotion((motion) => {
  const node = host.value!
  const owner = motion.scope()
  let observedWidth = node.clientWidth
  owner.use((scope) => {
    const current = ++generation
    status.value = ''
    failed.value = false
    node.replaceChildren()
    try {
      controls.value = props.experiment.mount({
        host: node,
        scope,
        motion,
        t,
        parameter: parameter.value,
        alive: () => !scope.disposed && current === generation,
        report: (message) => {
          if (!scope.disposed && current === generation) status.value = message
        },
      })
    } catch (error) {
      failure(error)
    }
    return () => {
      generation++
      controls.value = undefined
      node.querySelectorAll<HTMLElement>('*').forEach((target) => motion.release(target))
      node.replaceChildren()
    }
  })
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) owner.resume()
      else owner.suspend()
    },
    { rootMargin: '100px' },
  )
  observer.observe(node)
  const resize = new ResizeObserver(() => {
    if (Math.abs(node.clientWidth - observedWidth) < 1) return
    observedWidth = node.clientWidth
    if (!owner.suspended) {
      owner.suspend()
      owner.resume()
    }
  })
  resize.observe(node)
  emit('ready', true)
  return () => {
    generation++
    observer.disconnect()
    resize.disconnect()
    owner.dispose()
    emit('ready', false)
  }
})
</script>
<template>
  <div
    class="lab-session"
    :data-demo="experiment.id"
    :data-demo-ready="ready && !!controls"
    :data-demo-error="failed"
  >
    <div ref="host" class="lab-stage" :aria-label="t(experiment.title)"></div>
    <div class="lab-description">
      <p>{{ t(experiment.hint) }}</p>
      <p v-if="status" class="lab-status" :class="{ 'is-error': failed }" role="status">
        {{ status }}
      </p>
    </div>
    <div class="lab-controls">
      <label
        v-if="experiment.parameter"
        :for="experiment.id === 'spring' ? 'bounce' : 'lab-parameter'"
        >{{ t(experiment.parameter.label) }}
        <input
          :id="experiment.id === 'spring' ? 'bounce' : 'lab-parameter'"
          v-model.number="parameter"
          type="range"
          :min="experiment.parameter.min"
          :max="experiment.parameter.max"
          :step="experiment.parameter.step"
          @input="invoke(() => controls?.adjust?.(parameter))"
        /><output>{{ Number(parameter).toFixed(2) }}</output>
      </label>
      <button
        class="replay-button"
        :disabled="!controls || failed"
        @click="invoke(controls?.run)"
      >
        {{ t(experiment.runLabel ?? playWords) }} <span aria-hidden="true">↗</span>
      </button>
    </div>
    <div v-if="controls?.actions?.length" class="lab-actions">
      <button
        v-for="item in controls.actions"
        :key="item.id"
        :data-action="item.id"
        @click="invoke(item.run)"
      >
        {{ t(item.label) }}
      </button>
    </div>
  </div>
</template>
