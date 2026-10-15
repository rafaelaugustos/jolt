<script lang="ts" setup>
import { Application, type EventData, type View } from '@nativescript/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'nativescript-vue'
import Home from './Home.vue'
import Voice from './Voice.vue'
import Chat from './Chat.vue'
import Icon from './Icon.vue'
import Sheet from './Sheet.vue'
import { Motion } from './motion'
import { sentMessages } from './data'
type Screen = 'home' | 'voice' | 'chat'
type Scene = { id: number; name: Screen }
const props = withDefaults(
  defineProps<{ initialScreen?: Screen; autoplay?: boolean }>(),
  { initialScreen: 'home', autoplay: false },
)
const screen = ref<Screen>(props.autoplay ? 'voice' : props.initialScreen)
const scenes = ref<Scene[]>([{ id: 0, name: screen.value }])
const panel = ref<'help' | 'profile' | null>(null)
const playing = ref(false)
const revision = ref(0)
const title = computed(() =>
  screen.value === 'voice' ? 'Voice Analysis' : screen.value === 'chat' ? 'Chat' : '',
)
const heading = ref()
const warmth = ref()
const views = new Map<number, View>()
const components = new Map<number, unknown>()
const navigation = new Motion()
const tour = new Motion()
const ambient = new Motion()
let nextId = 0
let observer: unknown
let transitioning = false
let suspended = false
function stopTour() {
  tour.cancel()
  playing.value = false
}
function register(id: number, event: EventData) {
  views.set(id, event.object as View)
}
function component(id: number, instance: unknown) {
  if (instance) components.set(id, instance)
  else components.delete(id)
}
async function navigate(destination: Screen, automated = false) {
  if (!automated) stopTour()
  panel.value = null
  ;(Application.getRootView()?.nativeViewProtected as UIView | undefined)?.endEditing(
    true,
  )
  if (destination === screen.value && !transitioning) return
  navigation.cancel()
  const token = navigation.token
  transitioning = true
  const previous = scenes.value.at(-1)
  const entering = { id: ++nextId, name: destination }
  // Keep one outgoing scene, even when a second tap interrupts a transition.
  scenes.value = previous ? [previous, entering] : [entering]
  screen.value = destination
  await nextTick()
  const incoming = views.get(entering.id)
  if (!incoming || !navigation.current(token)) return
  const outgoing = previous ? views.get(previous.id) : undefined
  const animations = [
    navigation.play(
      incoming,
      { opacity: [0, 1], y: [destination === 'home' ? 18 : 10, 0], scale: [0.99, 1] },
      { duration: 380, ease: [0.25, 0.1, 0.25, 1] },
    ),
  ]
  if (outgoing) {
    outgoing.isUserInteractionEnabled = false
    animations.push(
      navigation.play(
        outgoing,
        { opacity: 0, y: -8, scale: 1.015 },
        { duration: 260, ease: 'easeIn' },
      ),
    )
  }
  if (heading.value)
    navigation.play(
      heading.value,
      { opacity: [0, 1], y: [3, 0] },
      { duration: 260, delay: 80 },
    )
  await Promise.all(animations)
  if (!navigation.current(token)) return
  scenes.value = [entering]
  for (const id of views.keys()) if (id !== entering.id) views.delete(id)
  transitioning = false
}
async function playDemo() {
  stopTour()
  panel.value = null
  sentMessages.value = []
  navigation.cancel()
  const token = tour.token
  playing.value = true
  screen.value = 'voice'
  scenes.value = [{ id: ++nextId, name: 'voice' }]
  transitioning = false
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
    const home = components.get(scenes.value.at(-1)!.id) as
      { select(index: number, manual: boolean): void } | undefined
    home?.select(index!, false)
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
  ambient.refreshPress()
  revision.value++
  scenes.value = [{ id: ++nextId, name: screen.value }]
  transitioning = false
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
  navigation.dispose()
  tour.dispose()
  ambient.dispose()
  views.clear()
  components.clear()
  Application.off(Application.suspendEvent, background)
  Application.off(Application.resumeEvent, foreground)
  if (observer)
    Application.ios.removeNotificationObserver(
      observer,
      UIAccessibilityReduceMotionStatusDidChangeNotification,
    )
})
defineExpose({
  navigate,
  playDemo,
  openPanel,
  stopTour,
  screen,
  playing,
  scenes,
  components,
})
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
        @loaded="ambient.press"
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
        @loaded="ambient.press"
        @tap="screen === 'chat' ? navigate('home') : openPanel('profile')"
      >
        <Icon
          :name="screen === 'chat' ? 'square.3.layers.3d' : 'person.crop.circle'"
          :size="23"
        />
      </GridLayout>
    </GridLayout>
    <GridLayout
      v-for="scene in scenes"
      :key="`${scene.id}:${revision}`"
      row="1"
      @loaded="register(scene.id, $event)"
      @unloaded="views.delete(scene.id)"
    >
      <Home
        v-if="scene.name === 'home'"
        :ref="(instance) => component(scene.id, instance)"
        @voice="navigate('voice')"
        @interact="stopTour"
      />
      <Voice
        v-else-if="scene.name === 'voice'"
        :ref="(instance) => component(scene.id, instance)"
        @chat="navigate('chat')"
        @interact="stopTour"
      />
      <Chat
        v-else
        :ref="(instance) => component(scene.id, instance)"
        @voice="navigate('voice')"
        @interact="stopTour"
      />
    </GridLayout>
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
