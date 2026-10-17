<script lang="ts" setup>
import {
  Application,
  type EventData,
  type ScrollView,
  type View,
} from '@nativescript/core'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'nativescript-vue'
import { rollTo } from '@rafaelaugusto/jolt'
import Icon from './Icon.vue'
import Sheet from './Sheet.vue'
import { Motion, reducedMotion, viewOf } from './motion'
import { documents, sentMessages, transcript, waveform } from './data'
const emit = defineEmits<{ voice: []; interact: [] }>()
const message = ref('')
const root = ref()
const messages = ref()
const scroll = ref()
const clock = ref()
const keyboardInset = ref(0)
const selectedDocument = ref<string | null>(null)
const showAudio = ref(reducedMotion())
const showSummary = ref(reducedMotion())
const playingAudio = ref(false)
const remaining = ref(37)
const motion = new Motion()
const waves = new Motion()
const waveViews = new Map<number, View>()
let observer: unknown
let follow = false
let ready = false
const ease = [0.37, 0, 0.63, 1] as const
const length = 37
const time = (seconds: number) => `00:${String(seconds).padStart(2, '0')}`
function entered(event: EventData) {
  motion.play(
    event.object as View,
    { opacity: [0, 1], y: [16, -3, 0] },
    {
      duration: 520,
      times: [0, 0.7, 1],
      ease: [ease, ease],
      opacity: { duration: 320, ease },
    },
  )
}
function documentEntered(index: number, event: EventData) {
  motion.play(
    event.object as View,
    { opacity: [0, 1], y: [14, 0], scale: [0.94, 1] },
    {
      type: 'spring',
      duration: 460,
      bounce: 0.13,
      delay: 180 + index * 85,
      opacity: { duration: 300 },
    },
  )
}
async function toggleAudio() {
  emit('interact')
  if (playingAudio.value) {
    stopAudio()
    return
  }
  playingAudio.value = true
  remaining.value = length
  waves.cancel()
  if (!reducedMotion())
    for (const [index, view] of waveViews)
      waves.play(
        view,
        { scaleY: [null, 0.45, 1.1, 0.65, 1] },
        {
          duration: 650 + (index % 4) * 70,
          delay: index * 13,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      )
  while (remaining.value > 0) {
    if (!(await waves.wait(1000))) return
    remaining.value--
    waves.track(
      rollTo(clock.value, time(remaining.value), { direction: 'down', duration: 450 }),
    )
  }
  stopAudio()
}
function stopAudio() {
  playingAudio.value = false
  waves.cancel()
  for (const view of waveViews.values()) view.scaleY = 1
  if (remaining.value !== length) {
    remaining.value = length
    motion.track(rollTo(clock.value, time(length), { duration: 450 }))
  }
}
function preview(title: string) {
  emit('interact')
  ;(viewOf(root.value)?.nativeViewProtected as UIView | undefined)?.endEditing(true)
  selectedDocument.value = title
}
function closeDocument() {
  selectedDocument.value = null
}
async function send() {
  const text = message.value.trim()
  if (!text) return
  emit('interact')
  follow = true
  sentMessages.value.push(text)
  message.value = ''
  await nextTick()
  scrollBottom()
}
function scrollBottom() {
  const view = viewOf<ScrollView>(scroll.value)
  view?.scrollToVerticalOffset(view.scrollableHeight, false)
}
function scrolled(event: EventData) {
  const native = (event.object as ScrollView).nativeViewProtected as UIScrollView
  if (native.dragging || native.tracking) emit('interact')
}
function layout() {
  if (follow) {
    follow = false
    scrollBottom()
  }
}
onMounted(async () => {
  motion.play(
    messages.value,
    { opacity: [0, 1], y: [24, -10, 0] },
    {
      duration: 850,
      times: [0, 0.56, 1],
      ease: [ease, ease],
      opacity: { duration: 500, ease },
    },
  )
  observer = Application.ios.addNotificationObserver(
    UIKeyboardWillChangeFrameNotification,
    (notification) => {
      const view = viewOf(root.value)
      if (!view?.isLoaded) return
      const frame = notification.userInfo?.objectForKey(UIKeyboardFrameEndUserInfoKey)
        ?.CGRectValue as CGRect
      if (!frame) return
      keyboardInset.value = Math.max(
        0,
        view.getLocationOnScreen().y + view.getActualSize().height - frame.origin.y,
      )
    },
  )
  if (!showAudio.value) {
    if (!(await motion.wait(900))) return
    showAudio.value = true
    if (!(await motion.wait(850))) return
    showSummary.value = true
  }
  ready = true
})
onBeforeUnmount(() => {
  motion.dispose()
  waves.dispose()
  waveViews.clear()
  if (observer)
    Application.ios.removeNotificationObserver(
      observer,
      UIKeyboardWillChangeFrameNotification,
    )
})
defineExpose({
  send,
  message,
  preview,
  closeDocument,
  toggleAudio,
  playingAudio,
  remaining,
  showAudio,
  showSummary,
  selectedDocument,
  keyboardInset,
  ready: () => ready,
})
</script>
<template>
  <GridLayout
    ref="root"
    rows="*, 84"
    class="assistant-chat"
    :paddingBottom="keyboardInset"
  >
    <ScrollView ref="scroll" scrollBarIndicatorVisible="false" @scroll="scrolled">
      <StackLayout ref="messages" class="assistant-messages" @layoutChanged="layout">
        <Label
          class="assistant-user-bubble"
          textWrap="true"
          accessible="true"
          :accessibilityLabel="transcript"
        >
          <FormattedString
            ><Span text="Hello, I need to find an invoice for " /><Span
              text="October 2024. "
              fontWeight="600" /><Span
              text="There was also a calculation for the " /><Span
              text="iScanner."
              fontWeight="600"
          /></FormattedString>
        </Label>
        <GridLayout columns="32, 10, *" class="assistant-reply-row">
          <GridLayout class="assistant-avatar"
            ><Icon name="sparkles" :size="18" color="#ffffff"
          /></GridLayout>
          <StackLayout col="2">
            <StackLayout class="assistant-reply-bubble">
              <Label
                text="Here are some documents I found based on your request."
                textWrap="true"
                fontWeight="600"
              />
              <Label
                text="Perhaps you would like me to provide a brief summary based on your files?"
                textWrap="true"
                marginTop="14"
              />
            </StackLayout>
            <GridLayout columns="*, *" class="assistant-documents">
              <StackLayout
                v-for="(document, index) in documents"
                :key="document.title"
                :col="index"
                class="assistant-document"
                accessible="true"
                accessibilityRole="button"
                :accessibilityLabel="`Preview ${document.title}`"
                v-press="{ scale: 0.94 }"
                @loaded="documentEntered(index, $event)"
                @tap="preview(document.title)"
              >
                <GridLayout
                  class="assistant-document-icon"
                  :backgroundColor="document.color"
                  ><Icon :name="document.icon" :size="22"
                /></GridLayout>
                <Label
                  :text="document.title"
                  class="assistant-document-name"
                  textWrap="true"
                />
              </StackLayout>
            </GridLayout>
          </StackLayout>
        </GridLayout>
        <GridLayout
          v-if="showAudio"
          columns="*, auto, 20"
          class="assistant-audio-bubble"
          accessible="true"
          accessibilityRole="button"
          :accessibilityLabel="
            playingAudio
              ? `Stop voice message preview, ${remaining} seconds left`
              : 'Play voice message preview, 37 seconds'
          "
          @loaded="entered"
          @tap="toggleAudio"
        >
          <StackLayout
            orientation="horizontal"
            verticalAlignment="center"
            accessible="false"
          >
            <Label
              v-for="(height, index) in waveform"
              :key="index"
              class="assistant-wave-bar"
              :height="height"
              @loaded="waveViews.set(index, $event.object)"
            />
          </StackLayout>
          <Label ref="clock" col="1" text="00:37" class="assistant-audio-time" />
          <Icon
            col="2"
            :name="playingAudio ? 'pause.fill' : 'play.fill'"
            :size="14"
            color="#f9f5e9"
          />
        </GridLayout>
        <GridLayout
          v-if="showSummary"
          columns="32, 10, *"
          class="assistant-reply-row"
          @loaded="entered"
        >
          <GridLayout class="assistant-avatar"
            ><Icon name="sparkles" :size="18" color="#ffffff"
          /></GridLayout>
          <StackLayout col="2" class="assistant-reply-bubble"
            ><Label
              text="Unfortunately, this is all the information I found based on your request."
              textWrap="true"
          /></StackLayout>
        </GridLayout>
        <Label
          v-for="(text, index) in sentMessages"
          :key="index"
          class="assistant-user-bubble"
          :text="text"
          textWrap="true"
          @loaded="entered"
        />
      </StackLayout>
    </ScrollView>
    <GridLayout row="1" columns="*, 12, 48" class="assistant-composer">
      <GridLayout columns="40, *" class="assistant-input-pill">
        <GridLayout
          accessible="true"
          accessibilityRole="button"
          accessibilityLabel="Browse example documents"
          v-press="{ scale: 0.94 }"
          @tap="preview('Your documents')"
          ><Icon name="plus" :size="20"
        /></GridLayout>
        <TextField
          col="1"
          v-model="message"
          hint="Type a message"
          class="assistant-message-input"
          returnKeyType="send"
          @returnPress="send"
          @focus="emit('interact')"
          accessibilityLabel="Message"
        />
      </GridLayout>
      <GridLayout
        col="2"
        class="assistant-dark-button assistant-composer-send"
        accessible="true"
        accessibilityRole="button"
        :accessibilityLabel="message.trim() ? 'Send message' : 'Open voice conversation'"
        v-press="{ scale: 0.94 }"
        @tap="message.trim() ? send() : emit('voice')"
        ><Icon :name="message.trim() ? 'arrow.up' : 'mic'" :size="23" color="#fffaf2"
      /></GridLayout>
    </GridLayout>
    <Sheet
      v-if="selectedDocument"
      rowSpan="2"
      :title="selectedDocument"
      :copy="'October 2024 · Personal workspace\n\nA sample document from your conversation.'"
      icon="doc.text"
      action="Back to conversation"
      @close="closeDocument"
      @action="closeDocument"
    />
  </GridLayout>
</template>
