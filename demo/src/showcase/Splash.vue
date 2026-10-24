<script setup lang="ts">
import { palette } from './theme'
import { usePreviewI18n } from './i18n'
import { ref, onUnmounted } from 'nativescript-vue'
import { animate, motionScope, reducedMotion } from '@rafaelaugusto/jolt'
import { useRouter } from 'vue-router-ns'
import type { EventData, View } from '@nativescript/core'
const { t } = usePreviewI18n()
const emit = defineEmits<{ done: [] }>()
const router = useRouter()
const mark = ref(),
  word = ref(),
  orbit = ref(),
  ring = ref(),
  caption = ref(),
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
          scope.animate(
            orbit.value,
            { rotate: [-65, 25], scale: [0.45, 1], opacity: [0, 1] },
            { duration: 1550, ease: 'expoOut' },
          ).finished,
          scope.animate(
            ring.value,
            { scale: [0.2, 1.15], opacity: [0, 0.7, 0] },
            { duration: 1450, ease: 'cubicOut' },
          ).finished,
          scope.animate(
            mark.value,
            { scale: [0.12, 1], rotate: [-25, -8], opacity: [0, 1] },
            { duration: 950, delay: 130, ease: 'backOut' },
          ).finished,
          scope.animate(
            word.value,
            { y: [48, 0], opacity: [0, 1] },
            { duration: 850, delay: 420, ease: 'expoOut' },
          ).finished,
          scope.animate(
            caption.value,
            { y: [12, 0], opacity: [0, 1] },
            { duration: 650, delay: 720 },
          ).finished,
          scope.animate(
            line.value,
            { scaleX: [0, 1] },
            { duration: 1550, ease: 'cubicInOut' },
          ).finished,
        ])
    await Promise.all([router.isReady(), entrance])
    if (!alive) return
    if (!router.currentRoute.value.matched.length) throw new Error('No initial page')
    if (!reducedMotion())
      await scope.add(
        animate(
          event.object as View,
          { opacity: 0, scale: 1.06 },
          { duration: 340, ease: 'cubicIn' },
        ),
      ).finished
    if (alive) emit('done')
  } catch (error) {
    failed.value = true
    console.error('Jolt showcase startup', error)
  }
}
</script>
<template>
  <GridLayout
    :backgroundColor="palette.background"
    iosOverflowSafeArea="true"
    @loaded="reveal"
    clipToBounds="true"
  >
    <GridLayout rows="auto,*,auto" padding="56 30 38">
      <GridLayout columns="*,auto">
        <Label
          :text="t('JOLT®')"
          color="#E3FC62"
          fontSize="12"
          fontWeight="bold"
          letterSpacing=".18"
        />
        <Label
          col="1"
          :text="t('NATIVE MOTION STUDIO')"
          :color="palette.subtle"
          fontSize="9"
          letterSpacing=".14"
          verticalAlignment="middle"
        />
      </GridLayout>
      <StackLayout row="1" verticalAlignment="middle" marginTop="-30">
        <GridLayout height="320" clipToBounds="false">
          <GridLayout
            ref="ring"
            width="300"
            height="300"
            borderRadius="150"
            borderWidth="1"
            borderColor="#E3FC62"
          />
          <GridLayout
            ref="orbit"
            width="280"
            height="280"
            borderRadius="140"
            borderWidth="1"
            borderColor="#435348"
          >
            <GridLayout
              width="220"
              height="220"
              borderRadius="110"
              borderWidth="1"
              :borderColor="palette.border"
            />
            <Label
              width="20"
              height="20"
              backgroundColor="#BBA8ED"
              borderRadius="10"
              horizontalAlignment="left"
              marginLeft="9"
            />
            <Label
              width="12"
              height="12"
              backgroundColor="#E3FC62"
              borderRadius="6"
              horizontalAlignment="right"
              marginRight="8"
              translateY="58"
            />
            <Label
              text="✦"
              width="38"
              height="44"
              fontSize="38"
              color="#E7A584"
              verticalAlignment="top"
              horizontalAlignment="right"
              margin="36 36"
            />
          </GridLayout>
          <GridLayout
            ref="mark"
            width="132"
            height="152"
            backgroundColor="#E3FC62"
            borderRadius="34"
            rotate="-8"
          >
            <Image
              src="~/assets/jolt-mark.png"
              width="100"
              height="110"
              stretch="aspectFit"
              :accessibilityLabel="t('Jolt logo')"
            />
          </GridLayout>
        </GridLayout>
        <Label
          ref="word"
          :text="t('jolt.')"
          fontSize="112"
          fontWeight="bold"
          letterSpacing="-.065"
          :color="palette.text"
          textAlignment="center"
          marginTop="-30"
        />
        <StackLayout ref="caption" marginTop="5">
          <Label
            :text="t('Made to move you.')"
            :color="palette.muted"
            fontSize="19"
            textAlignment="center"
          />
          <Label
            :text="t('TOUCH  /  FEEL  /  REPEAT')"
            :color="palette.subtle"
            fontSize="9"
            letterSpacing=".22"
            textAlignment="center"
            marginTop="16"
          />
        </StackLayout>
      </StackLayout>
      <StackLayout row="2">
        <GridLayout height="2" :backgroundColor="palette.border" marginBottom="18">
          <Label ref="line" height="2" backgroundColor="#E3FC62" originX="0" />
        </GridLayout>
        <GridLayout columns="*,auto">
          <Label
            :text="t('54 WAYS TO FEEL SOMETHING')"
            fontSize="9"
            letterSpacing=".1"
            :color="palette.subtle"
          />
          <Label col="1" text="↗" fontSize="20" color="#E3FC62" />
        </GridLayout>
        <Label
          v-if="failed"
          :text="t('Could not open the collection. Please restart Jolt.')"
          textWrap="true"
          :color="palette.text"
          marginTop="12"
        />
      </StackLayout>
    </GridLayout>
  </GridLayout>
</template>
