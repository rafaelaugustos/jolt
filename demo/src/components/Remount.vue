<script setup lang="ts">
import { onMounted, ref } from 'nativescript-vue'
import { animate } from '@rafaelaugusto/jolt'
import { useMotionScope } from '@rafaelaugusto/jolt/vue'

const scope = useMotionScope()
const stage = scope.states(
  { logo: null },
  {
    hidden: { logo: { opacity: 0, scale: 0.6 } },
    shown: { logo: { opacity: 1, scale: 1 } },
  },
)
const logo = stage.ref('logo')
const plain = ref()
const compact = ref(false)
const shown = ref(true)

onMounted(() => {
  stage.to('shown', 'bouncy')
  scope.animate(plain.value, { opacity: 1, scale: 1 }, 'bouncy')
})

function toggle() {
  shown.value = !shown.value
  stage.to(shown.value ? 'shown' : 'hidden')
}
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Recreated views" />
    <Label class="muted" textWrap="true" text=":ref=&quot;stage.ref('logo')&quot;" />

    <GridLayout v-if="compact" columns="*, *" class="stage" height="150">
      <Label :ref="logo" class="remount-logo small" text="J" opacity="0" />
      <Label ref="plain" col="1" class="remount-logo small" text="J" opacity="0" />
    </GridLayout>
    <GridLayout v-else columns="*, *" class="stage" height="150">
      <Label :ref="logo" class="remount-logo" text="J" opacity="0" />
      <Label ref="plain" col="1" class="remount-logo" text="J" opacity="0" />
    </GridLayout>
    <GridLayout columns="*, *">
      <Label class="caption" text="States" />
      <Label col="1" class="caption" text="Entrance only" />
    </GridLayout>

    <Label
      class="note"
      textWrap="true"
      text="Switching the layout creates new views. The one attached to the states comes back as it was; the other comes back with its template opacity."
    />
    <GridLayout columns="*, *">
      <Button class="button" text="Switch layout" @tap="compact = !compact" />
      <Button
        col="1"
        class="button"
        :text="shown ? 'Hide logo' : 'Show logo'"
        @tap="toggle"
      />
    </GridLayout>
  </StackLayout>
</template>
