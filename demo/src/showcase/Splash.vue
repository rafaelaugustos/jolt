<script setup lang="ts">
import { ref, onUnmounted } from 'nativescript-vue'
import { animate, motionScope, reducedMotion } from '@rafaelaugusto/jolt'
import { useRouter } from 'vue-router-ns'
import type { EventData, View } from '@nativescript/core'
const emit = defineEmits<{ done: [] }>()
const router = useRouter()
const mark = ref(),
  word = ref(),
  line = ref()
const failed = ref(false)
const scope = motionScope()
let started = false,
  alive = true
onUnmounted(() => {
  alive = false
  scope.dispose()
})
async function reveal(event: EventData) {
  if (started) return
  started = true
  try {
    const entrance = reducedMotion()
      ? Promise.resolve()
      : Promise.all([
          scope.add(
            animate(
              mark.value,
              { scale: [0.65, 1], rotate: [-16, 0], opacity: [0, 1] },
              { duration: 850, ease: 'backOut' },
            ),
          ).finished,
          scope.add(
            animate(
              word.value,
              { y: [24, 0], opacity: [0, 1] },
              { duration: 650, delay: 180 },
            ),
          ).finished,
          scope.add(animate(line.value, { scaleX: [0, 1] }, { duration: 950 })).finished,
        ])
    await Promise.all([router.isReady(), entrance])
    if (!alive) return
    if (!router.currentRoute.value.matched.length) throw new Error('No initial page')
    if (!reducedMotion())
      await scope.add(animate(event.object as View, { opacity: 0 }, { duration: 280 }))
        .finished
    if (alive) emit('done')
  } catch (error) {
    failed.value = true
    console.error('Jolt showcase startup', error)
  }
}
</script>
<template>
  <GridLayout backgroundColor="#E3FC62" iosOverflowSafeArea="true" @loaded="reveal">
    <StackLayout verticalAlignment="middle" marginBottom="40">
      <GridLayout
        ref="mark"
        width="112"
        height="112"
        borderRadius="32"
        backgroundColor="#FAFBF5"
        horizontalAlignment="center"
      >
        <Image
          src="~/assets/jolt-mark.png"
          width="84"
          height="84"
          stretch="aspectFit"
          accessibilityLabel="Jolt logo"
        />
      </GridLayout>
      <Label
        ref="word"
        text="jolt."
        color="#191C23"
        fontSize="76"
        fontWeight="bold"
        textAlignment="center"
        marginTop="12"
      />
      <Label
        text="GOOD THINGS ARE IN MOTION"
        color="#414834"
        fontSize="10"
        letterSpacing=".16"
        textAlignment="center"
        marginTop="10"
      />
      <Label
        ref="line"
        width="40"
        height="3"
        backgroundColor="#191C23"
        horizontalAlignment="center"
        marginTop="30"
      />
      <Label
        v-if="failed"
        text="Could not open the collection. Please restart Jolt."
        textWrap="true"
        textAlignment="center"
        margin="24"
        color="#191C23"
      />
    </StackLayout>
    <Label
      text="A NATIVE MOTION STUDIO"
      verticalAlignment="bottom"
      horizontalAlignment="center"
      marginBottom="36"
      fontSize="10"
      color="#414834"
      letterSpacing=".12"
    />
  </GridLayout>
</template>
