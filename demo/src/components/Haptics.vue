<script lang="ts" setup>
import { usePreviewI18n } from '../showcase/i18n'
import { isAndroid, isIOS, type LayoutBase } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import {
  animate,
  motionScope,
  playbackProgress,
  set,
  type PlaybackAnimation,
  type HapticStyle,
} from '@rafaelaugusto/jolt'
import { HapticProbe } from '../haptic-probe'
import { checkAndroidHaptics } from '../../../benchmarks/haptics'
import { launchArgument } from '../launch'
const { t } = usePreviewI18n()

const lane = ref()
const ball = ref()
const bouncing = ref()
const right = ref(false)
const first = ref(),
  second = ref(),
  third = ref(),
  checksHost = ref()
const status = ref('Ready'),
  progress = ref(0),
  paused = ref(false),
  checking = ref(false)
const styles: HapticStyle[] = ['light', 'medium', 'heavy']
const scope = motionScope()
let spring: PlaybackAnimation | undefined
let bounce: PlaybackAnimation | undefined
let current: PlaybackAnimation | undefined
let releaseProgress: (() => void) | undefined

function observe(animation: PlaybackAnimation, description: string) {
  releaseProgress?.()
  current = animation
  paused.value = false
  status.value = description
  releaseProgress = playbackProgress(animation).subscribe((value) => {
    progress.value = Math.round(value * 100)
  })
  void animation.finished.then((finished) => {
    if (current === animation) {
      status.value = finished ? 'Finished' : 'Stopped'
      releaseProgress?.()
      releaseProgress = undefined
    }
  })
}

function toss(haptic: HapticStyle) {
  right.value = !right.value
  const width = lane.value.nativeView.getActualSize().width
  spring = scope.add(
    animate(
      ball.value,
      { x: right.value ? width - 48 : 0 },
      {
        type: 'spring',
        duration: 550,
        bounce: 0.3,
        haptic,
      },
    ),
  )
  observe(spring, `${haptic} spring`)
}

function jump() {
  bounce?.stop()
  bouncing.value.nativeView.translateY = 0
  bounce = scope.add(
    animate(bouncing.value, 'bounce', {
      haptic: { style: 'light', times: [0.6, 1] },
    }),
  )
  observe(bounce, 'Two bounce impacts')
}

function tween(feedback = true) {
  spring?.stop()
  set(ball.value, { x: 0 })
  right.value = true
  spring = scope.add(
    animate(
      ball.value,
      { x: lane.value.nativeView.getActualSize().width - 48 },
      {
        duration: 2200,
        ease: 'linear',
        haptic: feedback ? { style: 'light', times: [0.3, 0.8] } : false,
      },
    ),
  )
  observe(spring, feedback ? 'Impacts at 30% and 80%' : 'Feedback disabled')
}

function stagger() {
  const targets = [first.value, second.value, third.value]
  targets.forEach((target) => set(target, { y: 0 }))
  observe(
    scope.add(
      animate(
        targets,
        { y: [0, -16, 0] },
        { duration: 600, stagger: 180, ease: 'sineInOut', haptic: 'light' },
      ),
    ),
    'Three staggered arrivals',
  )
}

function togglePause() {
  if (!current) return
  if (current.paused) current.play()
  else current.pause()
  paused.value = current.paused
  status.value = paused.value ? 'Paused' : 'Resumed'
}

function seek(value: number) {
  if (!current) return
  current.progress = value
  progress.value = Math.round(value * 100)
}

async function checks() {
  if (checking.value) return
  cancel()
  checking.value = true
  try {
    await checkAndroidHaptics(
      checksHost.value.nativeView as LayoutBase,
      (text) => {
        status.value = text
      },
      launchArgument('haptic-checks') || 'all',
    )
  } catch (error) {
    status.value = `FAILED: ${String(error)}`
  } finally {
    checking.value = false
  }
}

function cancel() {
  scope.reset()
  releaseProgress?.()
  releaseProgress = undefined
  current = spring = bounce = undefined
  paused.value = false
  status.value = 'Stopped'
}

onUnmounted(() => {
  cancel()
  scope.dispose()
})
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        :text="t('A FEELING YOU CAN TOUCH')"
        class="ex-kicker"
        verticalAlignment="top" /><StackLayout marginTop="34"
        ><GridLayout columns="*,auto" height="16"
          ><Label :text="t('THE ARRIVAL')" class="ex-kicker" /><Label
            col="1"
            :text="t(`${progress}%`)"
            color="#E3FC62"
            fontSize="12" /></GridLayout
        ><GridLayout ref="lane" height="70"
          ><Label height="1" backgroundColor="#4A6142" /><HapticProbe
            ref="ball"
            width="48"
            height="48"
            borderRadius="24"
            backgroundColor="#E3FC62"
            horizontalAlignment="left" /></GridLayout
        ><GridLayout height="100"
          ><Label
            height="1"
            backgroundColor="#4A6142"
            verticalAlignment="bottom" /><HapticProbe
            ref="bouncing"
            width="48"
            height="48"
            borderRadius="24"
            backgroundColor="#C5B3EA"
            verticalAlignment="bottom" /></GridLayout
        ><GridLayout columns="*,*,*" height="58" marginTop="12"
          ><HapticProbe
            ref="first"
            width="24"
            height="24"
            borderRadius="12"
            backgroundColor="#E8B294"
            verticalAlignment="bottom" /><HapticProbe
            ref="second"
            col="1"
            width="24"
            height="24"
            borderRadius="12"
            backgroundColor="#E8B294"
            verticalAlignment="bottom" /><HapticProbe
            ref="third"
            col="2"
            width="24"
            height="24"
            borderRadius="12"
            backgroundColor="#E8B294"
            verticalAlignment="bottom" /></GridLayout></StackLayout></GridLayout
    ><GridLayout columns="*,*,*" class="ex-controls"
      ><Button
        v-for="(style, i) in styles"
        :key="style"
        :col="i"
        :text="t(style)"
        @tap="toss(style)"
        :class="{ 'ex-primary': i === 0 }" /></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*,*"
        ><Button col="0" :text="t('Bounce')" @tap="jump" /><Button
          col="1"
          :text="t('Stagger')"
          @tap="stagger" /><Button
          col="2"
          :text="t('Stop')"
          @tap="cancel" /></GridLayout></StackLayout
    ><Label
      :text="
        t('Use a physical device to feel the taps. The simulator shows the movement.')
      "
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout v-if="isIOS || isAndroid" class="section">
      <Label class="heading" :text="t('Haptics')" />
      <Label
        class="muted"
        textWrap="true"
        :text="
          t(
            'Feel each arrival on a physical device. Tap again to interrupt; only the new arrival gets feedback.',
          )
        "
      />
      <GridLayout ref="lane" class="lane" height="56">
        <HapticProbe
          ref="ball"
          class="ball"
          width="48"
          height="48"
          horizontalAlignment="left"
        />
      </GridLayout>
      <GridLayout columns="*, *, *">
        <Button
          v-for="(style, index) in styles"
          :key="style"
          :col="index"
          class="button"
          :text="t(style)"
          @tap="toss(style)"
        />
      </GridLayout>
      <Label class="muted" :text="t('Two bounces, two light taps.')" />
      <GridLayout class="lane" height="80">
        <HapticProbe
          ref="bouncing"
          class="ball"
          width="48"
          height="48"
          verticalAlignment="bottom"
        />
      </GridLayout>
      <GridLayout columns="*, *">
        <Button class="button" :text="t('Bounce')" @tap="jump" />
        <Button col="1" class="button" :text="t('Stop')" @tap="cancel" />
      </GridLayout>
      <GridLayout columns="*, *, *" height="52">
        <HapticProbe
          ref="first"
          class="ball"
          width="24"
          height="24"
          verticalAlignment="bottom"
        />
        <HapticProbe
          ref="second"
          col="1"
          class="ball"
          width="24"
          height="24"
          verticalAlignment="bottom"
        />
        <HapticProbe
          ref="third"
          col="2"
          class="ball"
          width="24"
          height="24"
          verticalAlignment="bottom"
        />
      </GridLayout>
      <GridLayout columns="*, *, *">
        <Button class="button" :text="t('Tween')" @tap="tween()" />
        <Button col="1" class="button" :text="t('Stagger')" @tap="stagger" />
        <Button col="2" class="button" :text="t('No feedback')" @tap="tween(false)" />
      </GridLayout>
      <GridLayout columns="*, *, *">
        <Button
          class="button"
          :text="t(paused ? 'Resume' : 'Pause')"
          @tap="togglePause"
        />
        <Button col="1" class="button" :text="t('Seek 70%')" @tap="seek(0.7)" />
        <Button col="2" class="button" :text="t('Rewind 10%')" @tap="seek(0.1)" />
      </GridLayout>
      <Label :text="t(status)" class="muted" textWrap="true" />
      <Label :text="t(`${progress}%`)" class="muted" />
      <Label
        v-if="isAndroid"
        class="muted"
        textWrap="true"
        :text="
          t(
            'A white flash marks a feedback request, not proof of vibration. Device settings decide whether it is felt.',
          )
        "
      />
      <Button
        v-if="isAndroid"
        class="button"
        :text="t('Run haptic checks')"
        :isEnabled="!checking"
        @tap="checks"
      />
      <StackLayout v-if="isAndroid" ref="checksHost" height="44" />
    </StackLayout>
  </template>
</template>
