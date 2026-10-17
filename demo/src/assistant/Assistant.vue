<script lang="ts" setup>
import { Application } from '@nativescript/core'
import { computed, onBeforeUnmount, onMounted, ref } from 'nativescript-vue'
import type { AnimateValue } from '@rafaelaugusto/jolt/vue'
import Home from './Home.vue'
import Voice from './Voice.vue'
import Chat from './Chat.vue'
import Icon from './Icon.vue'
import Sheet from './Sheet.vue'
import { Motion } from './motion'
import { sentMessages } from './data'
type Screen = 'home' | 'voice' | 'chat'
const props = withDefaults(
  defineProps<{ initialScreen?: Screen; autoplay?: boolean }>(),
  { initialScreen: 'home', autoplay: false },
)
const screen = ref<Screen>(props.autoplay ? 'voice' : props.initialScreen)
const panel = ref<'help' | 'profile' | null>(null)
const playing = ref(false)
const revision = ref(0)
const title = computed(() =>
  screen.value === 'voice' ? 'Voice Analysis' : screen.value === 'chat' ? 'Chat' : '',
)
const heading = ref()
const warmth = ref()
const current = ref()
const enter: AnimateValue = [
  { opacity: [0, 1], y: [12, 0] },
  { duration: 260, ease: [0.25, 0.1, 0.25, 1] },
]
const leave: AnimateValue = [
  { opacity: 0, y: -6 },
  { duration: 160, ease: 'easeIn' },
]
const navigation = new Motion()
const tour = new Motion()
const ambient = new Motion()
let settle: (() => void) | undefined
let suspended = false
function stopTour() {
  tour.cancel()
  playing.value = false
}
function settled() {
  settle?.()
  settle = undefined
}
async function navigate(destination: Screen, automated = false) {
  if (!automated) stopTour()
  panel.value = null
  ;(Application.getRootView()?.nativeViewProtected as UIView | undefined)?.endEditing(
    true,
  )
  if (destination === screen.value) return
  settled()
  const arrived = new Promise<void>((resolve) => (settle = resolve))
  screen.value = destination
  if (heading.value)
    navigation.play(
      heading.value,
      { opacity: [0, 1], y: [3, 0] },
      { duration: 260, delay: 80 },
    )
  await arrived
}
async function playDemo() {
  stopTour()
  panel.value = null
  sentMessages.value = []
  navigation.cancel()
  const token = tour.token
  playing.value = true
  if (screen.value !== 'voice') {
    await navigate('voice', true)
    if (!tour.current(token)) return
  }
  if (!(await tour.wait(4100)) || !tour.current(token)) return
  await navigate('chat', true)
  if (!tour.current(token) || !(await tour.wait(2800))) return
  await navigate('home', true)
  if (!tour.current(token)) return
  for (const [delay, index] of [
    [1300, 2],
    [750, 3],
    [750, 4],
  ]) {
    if (!(await tour.wait(delay!)) || !tour.current(token)) return
    const home = current.value as
      { select?(index: number, manual: boolean): void } | undefined
    home?.select?.(index!, false)
  }
  if (!(await tour.wait(800)) || !tour.current(token)) return
  await navigate('voice', true)
  if (!(await tour.wait(3500)) || !tour.current(token)) return
  playing.value = false
}
function openPanel(value: 'help' | 'profile') {
  stopTour()
  panel.value = value
}
function startAmbient() {
  ambient.play(
    warmth.value,
    { opacity: [0.1, 0.28, 0.1] },
    { duration: 9000, ease: 'easeInOut', repeat: Infinity },
  )
}
function resetScene() {
  stopTour()
  navigation.cancel()
  ambient.cancel()
  revision.value++
  startAmbient()
}
function background() {
  suspended = true
  stopTour()
  navigation.cancel()
  ambient.cancel()
}
function foreground() {
  if (!suspended) return
  suspended = false
  resetScene()
}
let observer: unknown
onMounted(() => {
  startAmbient()
  observer = Application.ios.addNotificationObserver(
    UIAccessibilityReduceMotionStatusDidChangeNotification,
    resetScene,
  )
  Application.on(Application.suspendEvent, background)
  Application.on(Application.resumeEvent, foreground)
  if (props.autoplay) void playDemo()
})
onBeforeUnmount(() => {
  settled()
  navigation.dispose()
  tour.dispose()
  ambient.dispose()
  Application.off(Application.suspendEvent, background)
  Application.off(Application.resumeEvent, foreground)
  if (observer)
    Application.ios.removeNotificationObserver(
      observer,
      UIAccessibilityReduceMotionStatusDidChangeNotification,
    )
})
defineExpose({ navigate, playDemo, openPanel, stopTour, screen, playing, current })
</script>
<template>
  <GridLayout class="assistant-shell" rows="64, *" iosOverflowSafeArea="false">
    <GridLayout
      ref="warmth"
      rowSpan="2"
      class="assistant-warmth"
      isUserInteractionEnabled="false"
    />
    <GridLayout class="assistant-header" columns="44, *, 44">
      <GridLayout
        class="assistant-round-button"
        accessible="true"
        accessibilityRole="button"
        :accessibilityLabel="screen === 'home' ? 'Help' : 'Back to home'"
        v-press="{ scale: 0.94 }"
        @tap="screen === 'home' ? openPanel('help') : navigate('home')"
      >
        <Icon
          :name="screen === 'home' ? 'questionmark.bubble' : 'arrow.left'"
          :size="20"
        />
      </GridLayout>
      <Label ref="heading" col="1" class="assistant-header-title" :text="title" />
      <GridLayout
        col="2"
        class="assistant-round-button"
        accessible="true"
        accessibilityRole="button"
        :accessibilityLabel="screen === 'chat' ? 'Go to home' : 'Your profile'"
        v-press="{ scale: 0.94 }"
        @tap="screen === 'chat' ? navigate('home') : openPanel('profile')"
      >
        <Icon
          :name="screen === 'chat' ? 'square.3.layers.3d' : 'person.crop.circle'"
          :size="23"
        />
      </GridLayout>
    </GridLayout>
    <JoltTransition mode="out-in" :enter="enter" :leave="leave" @after-enter="settled">
      <Home
        v-if="screen === 'home'"
        :key="`home:${revision}`"
        ref="current"
        row="1"
        @voice="navigate('voice')"
        @interact="stopTour"
      />
      <Voice
        v-else-if="screen === 'voice'"
        :key="`voice:${revision}`"
        ref="current"
        row="1"
        @chat="navigate('chat')"
        @interact="stopTour"
      />
      <Chat
        v-else
        :key="`chat:${revision}`"
        ref="current"
        row="1"
        @voice="navigate('voice')"
        @interact="stopTour"
      />
    </JoltTransition>
    <Sheet
      v-if="panel"
      :key="panel"
      rowSpan="2"
      :title="panel === 'profile' ? 'Hi Peter.' : 'A little help.\nA lot less work.'"
      :icon="panel === 'profile' ? 'person.crop.circle' : 'sparkles'"
      :copy="
        panel === 'profile'
          ? 'Your personal workspace.\nEverything you need, all together.'
          : 'Choose a document tool or start a conversation. Watch the demo to see the whole flow.'
      "
      :action="panel === 'profile' ? 'Open conversation' : 'Watch demo'"
      @close="panel = null"
      @action="panel === 'profile' ? navigate('chat') : playDemo()"
    />
  </GridLayout>
</template>
