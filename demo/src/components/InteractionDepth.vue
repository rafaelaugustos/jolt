<script setup lang="ts">
import { Application, File, isIOS, knownFolders, type View } from '@nativescript/core'
import { ref, nextTick, onUnmounted, registerElement } from 'nativescript-vue'
import {
  configure,
  motionScope,
  set,
  withTimelineCues,
  type PlaybackAnimation,
  type DropZones,
} from '@rafaelaugusto/jolt'
import { audioCue, type AudioCue } from '@rafaelaugusto/jolt/audio'
import {
  createMotionInspector,
  type MotionInspector,
} from '@rafaelaugusto/jolt/inspector'
import { propertyGroup, type NativeProperty } from '@rafaelaugusto/jolt/native'
import { PortableReveal, portableReveal } from '../portable-reveal'
import { PortableScene } from '../portable-scene'
import { measureInspection } from '../inspection-audit'
import { launchArgument } from '../launch'
registerElement('PortableReveal', () => PortableReveal)
registerElement('PortableScene', () => PortableScene)
const mode = launchArgument('interaction-depth') || 'drop'
const titles: Record<string, string> = {
  drop: 'Drop with intent',
  board: 'Drop into order',
  audio: 'Sound on the timeline',
  inspector: 'Who owns this motion?',
  path: 'One path, one clock',
  depth: 'Rotation in three axes',
  shadow: 'Light and depth',
}
const root = ref(),
  mounted = ref(true),
  status = ref('Preparing'),
  detail = ref(''),
  muted = ref(false),
  home = ref<'backlog' | 'done'>('backlog'),
  gap = ref<{ column: 'backlog' | 'done'; top: boolean }>(),
  opened = ref(0),
  reduced = ref(false),
  paddingTop = ref(110)
let scope = motionScope(),
  initialized = false,
  disposed = false,
  request = 0,
  count = 0
let playback:
  | {
      pause(): void
      play(): void
      stop(): void
      paused: boolean
      progress?: number
      finished: Promise<boolean>
    }
  | undefined
let drop: DropZones | undefined,
  sound: AudioCue | undefined,
  inspector: MotionInspector | undefined
let group:
  ReturnType<typeof propertyGroup<Record<string, NativeProperty<number>>>> | undefined
let activity: ReturnType<typeof scope.renderActivity> | undefined
const events: object[] = []
const target = (id: string): View => root.value?.nativeView.getViewById(id)
const columns = ['backlog', 'done'] as const
let hovered: string | undefined,
  moves = 0
function outline() {
  const done = target('depth-done')
  if (done) paddingTop.value = 10 + done.getActualSize().height
}
function board() {
  const card = target('depth-card')
  drop = scope.dropZones(card, {
    targets: [
      { id: 'backlog', target: target('depth-backlog'), padding: { bottom: 60 } },
      { id: 'done', target: target('depth-done'), padding: { bottom: 60 } },
      { id: 'locked', target: target('depth-locked'), accept: () => false },
    ],
    drag: { handle: target('depth-grip'), snap: [0] },
    onMove: ({ id, bounds }) => {
      moves++
      const column = id === 'backlog' || id === 'done' ? id : undefined
      const first = column && target(`depth-first-${column}`)
      const point = first?.getLocationInWindow()
      const top =
        !!first &&
        !!point &&
        bounds.y + bounds.height / 2 < point.y + first.getActualSize().height / 2
      if (gap.value?.column !== column || gap.value?.top !== top)
        gap.value = column ? { column, top } : undefined
      status.value = `Over ${id ?? 'nothing'} · y ${Math.round(bounds.y)} DIP · ${moves} moves`
      if (id !== hovered) {
        hovered = id
        audit('move', { id, bounds, moves })
      }
    },
    onLeave: () => {
      gap.value = undefined
    },
    onReject: (event) => {
      status.value = event
        ? `Rejected by ${event.id} · spring returns`
        : 'No target · returned'
      audit('rejected', { id: event?.id })
    },
    onDrop: ({ id, method }) => {
      count++
      const column = id === 'done' ? 'done' : 'backlog'
      status.value = `Dropped in ${column} · ${method}`
      audit('accepted', { id, method, count, moves })
      const pulse = scope.animate(card, { scale: [1, 0.92, 1] }, { duration: 320 })
      void pulse.finished.then((complete) => {
        if (!complete || disposed) return
        home.value = column
        void reset(false)
      })
      return pulse
    },
  })
  status.value = 'Drag the grip; the card body keeps its button'
}
function audit(name: string, data: object = {}) {
  events.push({ name, time: Date.now(), mode, scope: scope.size, ...data, name })
  if (events.length > 1000) events.shift()
  if (launchArgument('depth-audit') === undefined) return
  const directory = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null).getAbsolutePath()
  File.fromPath(directory + '/interaction-depth.json').writeTextSync(
    JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }, null, 2),
  )
}
function inspect() {
  const snapshot = inspector?.read()
  if (snapshot) {
    detail.value = snapshot.adapters.properties
      .map((p) => `${p.id}: ${p.ownerLabel ?? 'idle'}`)
      .join(' · ')
    status.value = snapshot.adapters.events
      .slice(-4)
      .map((e) => `${e.target} ${e.kind}`)
      .join(' / ')
    audit('inspection', { snapshot: snapshot.adapters })
  } else
    audit('snapshot', {
      status: status.value,
      detail: detail.value,
      paused: playback?.paused,
      progress: playback?.progress,
      audio: sound?.status,
      accepted: count,
    })
}
function setup() {
  if (initialized || disposed || !target('depth-stage')?.isLoaded) return
  initialized = true
  try {
    if (mode === 'board') board()
    else if (mode === 'drop') {
      drop = scope.dropZones(target('depth-card'), {
        targets: [
          { id: 'accept', target: target('depth-accept') },
          { id: 'reject', target: target('depth-reject'), accept: () => false },
        ],
        drag: { snap: [0] },
        onEnter: ({ id, target: zone }) => {
          zone.opacity = 0.65
          status.value = `${id}: entered`
          audit('enter', { id })
        },
        onLeave: ({ target: zone }) => {
          zone.opacity = 1
        },
        onReject: () => {
          status.value = 'Rejected · spring returns the card'
          audit('rejected')
        },
        onDrop: ({ method }) => {
          count++
          status.value = `Accepted once · ${method} · ${count}`
          audit('accepted', { method, count })
          return scope.animate(
            target('depth-card'),
            { scale: [1, 0.7, 1] },
            { duration: 700 },
          )
        },
      })
      status.value = 'Drag the card onto either target'
    } else if (mode === 'audio') {
      sound = scope.resource(() =>
        audioCue('~/assets/cue.wav', {
          onError(error) {
            status.value = 'Sound unavailable · visuals continue'
            audit('audio-error', { error: String(error) })
          },
        }),
      )
      void sound.ready.then((ready) => {
        if (!disposed) {
          status.value = ready ? 'Local sound ready · tap Play' : 'Sound unavailable'
          audit('audio-ready', { ready, duration: sound?.duration })
        }
      })
    } else if (mode === 'inspector') {
      if (launchArgument('depth-measure') !== undefined) {
        const properties = [0, 1, 2].map((i) =>
          scope.resource(() =>
            portableReveal(target(`depth-bar-${i}`).nativeViewProtected),
          ),
        )
        void measureInspection(
          target('depth-stage'),
          properties,
          (message) => {
            status.value = message
          },
          () => !disposed,
        ).catch((error) => {
          status.value = String(error)
          audit('measure-error', { error: String(error) })
        })
        return
      }
      inspector = createMotionInspector({ development: true, capacity: 32 })
      scope.resource(() => inspector!)
      const scene = target('depth-scene') as PortableScene
      const properties: Record<string, NativeProperty<number>> = {}
      scene.properties().forEach((property, i) => {
        properties[`shader${i}`] = scope.resource(() => property)
      })
      for (let i = 0; i < 3; i++)
        properties[`bar${i}`] = scope.resource(() =>
          portableReveal(target(`depth-bar-${i}`).nativeViewProtected),
        )
      for (const [id, property] of Object.entries(properties))
        inspector.adapters.watch(property, id)
      group = scope.resource(() => propertyGroup(properties))
      activity = scope.renderActivity({
        change(active) {
          scene.render(active)
          audit('renderer', { active })
        },
        redraw() {
          scene.redraw()
        },
      })
      inspector.adapters.activity(activity, 'scene')
      detail.value = isIOS
        ? '3 SceneKit uniforms + 3 native drawing properties'
        : '3 native drawing properties · no shader adapter on this Android fixture'
      status.value = 'Tap Play, then Replace and Inspect'
    } else {
      if (mode === 'shadow' && isIOS)
        target('depth-card').boxShadow = '0 4 8 rgba(0,0,0,0.25)'
      status.value = 'Tap Play · pause, seek or replace'
    }
    audit('mounted')
  } catch (error) {
    status.value = String(error)
    audit('setup-error', { error: String(error) })
  }
}
function play(replace = false) {
  try {
    if (mode === 'board' && replace) {
      reduced.value = !reduced.value
      configure({ reducedMotion: reduced.value ? 'always' : 'user' })
      status.value = reduced.value
        ? 'Reduced motion: drops return at once'
        : 'Motion: user'
      audit('reduced', { reduced: reduced.value })
      return
    }
    if (mode === 'board') {
      drop?.request(home.value === 'done' ? 'backlog' : 'done')
      return
    }
    if (mode === 'drop') {
      drop?.request('accept')
      return
    }
    const card = target('depth-card')
    if (mode === 'inspector') {
      const values = Object.fromEntries(
        Object.keys(group!.get()).map((id) => [id, replace ? 0.2 : 0.95]),
      )
      playback = scope.add(group!.animate(values, { duration: 2600 }))
      inspector!.label(playback as PlaybackAnimation, replace ? 'click' : 'pulse')
      activity!.track(playback as PlaybackAnimation)
      inspect()
      return
    }
    const token = ++request
    if (mode === 'audio') {
      playback?.stop()
      set(card, { x: 0, rotate: 0 })
      const visual = scope.animate(
        card,
        { x: [0, 150, 0], rotate: [0, 15, 0] },
        { duration: 2400 },
      )
      playback = scope.add(
        withTimelineCues(visual, [
          { name: 'entry', at: 200, effect: cue },
          { name: 'complete', at: 1300, effect: cue },
        ]),
      )
      function cue(event: { name: string }) {
        status.value = `Cue: ${event.name}${muted.value ? ' · muted' : ' · playing'}`
        audit('audio-start', { name: event.name, muted: muted.value })
        const voice = sound!.play()
        void voice.finished.then((completed) =>
          audit('audio-finish', { cue: event.name, completed }),
        )
        return voice
      }
    } else if (mode === 'path') {
      playback = scope.animate(
        card,
        replace
          ? { x: 0, y: 0, rotate: 0 }
          : { path: 'M0 0 C40 -150 160 90 190 -80', orient: true },
        { duration: 2600, ease: 'linear' },
      )
    } else if (mode === 'depth') {
      playback = scope.animate(
        card,
        {
          rotateX: replace ? -35 : 55,
          rotateY: replace ? 45 : -40,
          rotate: replace ? 0 : 12,
          scale: replace ? 1 : 1.15,
        },
        { duration: 2400 },
      )
    } else if (mode === 'shadow') {
      playback = scope.animate(
        card,
        {
          borderRadius: replace ? 12 : 35,
          ...(isIOS
            ? {
                shadowOpacity: replace ? 0.25 : 0.7,
                shadowRadius: replace ? 4 : 18,
                shadowOffsetX: replace ? 0 : -12,
                shadowOffsetY: replace ? 4 : 22,
              }
            : { elevation: replace ? 2 : 28, translationZ: replace ? 0 : 8 }),
        },
        { duration: 2400 },
      )
    }
    status.value = replace ? 'Replaced from the current pose' : 'Playing'
    audit(replace ? 'replace' : 'play')
    void playback?.finished.then((complete) => {
      if (!disposed && request === token) {
        status.value = complete ? 'Completed' : 'Cancelled'
        audit('finished', { complete })
      }
    })
  } catch (error) {
    status.value = String(error)
    audit('play-error', { error: String(error) })
  }
}
function pause() {
  if (mode === 'drop' || mode === 'board') {
    if (drop?.paused) drop.play()
    else drop?.pause()
    status.value = drop?.paused ? 'Paused · owned effect cancelled' : 'Ready'
    audit('pause', { paused: drop?.paused })
    return
  }
  if (playback?.paused) playback.play()
  else playback?.pause()
  status.value = playback?.paused ? 'Paused' : 'Resumed'
  audit('pause', { paused: playback?.paused })
  if (inspector) inspect()
}
function seek() {
  if (playback && 'progress' in playback) {
    playback.progress = 0.6
    status.value = 'Seek to 60% · cues stay silent'
    audit('seek')
  }
  if (inspector) inspect()
}
function mute() {
  muted.value = !muted.value
  if (sound) sound.muted = muted.value
  status.value = muted.value ? 'Muted · audio clock continues' : 'Unmuted'
  audit('mute', { muted: muted.value })
}
async function reset(log = true) {
  request++
  muted.value = false
  gap.value = undefined
  hovered = undefined
  scope.dispose()
  inspector = undefined
  scope = motionScope()
  playback = undefined
  drop = undefined
  sound = undefined
  mounted.value = false
  initialized = false
  await nextTick()
  mounted.value = true
  if (log) audit('remount')
}
onUnmounted(() => {
  disposed = true
  if (reduced.value) configure({ reducedMotion: 'user' })
  request++
  scope.dispose()
  audit('disposed')
})
</script>
<template>
  <ScrollView
    :isScrollEnabled="mode !== 'drop' && mode !== 'board'"
    backgroundColor="#0C1424"
  >
    <StackLayout ref="root" padding="20" color="#E8F0FF">
      <Label
        :text="titles[mode]"
        fontSize="27"
        fontWeight="bold"
        marginTop="28"
        textWrap="true"
      />
      <Label
        :text="isIOS ? 'iOS · native playback' : 'Android · native playback'"
        fontSize="13"
        color="#A5B7D1"
        marginTop="6"
      />
      <AbsoluteLayout
        v-if="mounted"
        id="depth-stage"
        width="320"
        height="300"
        backgroundColor="#16273C"
        marginTop="16"
        @loaded="setup"
      >
        <template v-if="mode === 'drop'">
          <Label
            id="depth-reject"
            automationText="depth-reject"
            text="REJECT"
            left="14"
            top="25"
            width="125"
            height="95"
            textAlignment="center"
            verticalTextAlignment="center"
            backgroundColor="#8B3C49"
            borderRadius="14"
          />
          <Label
            id="depth-accept"
            automationText="depth-accept"
            text="ACCEPT"
            left="180"
            top="25"
            width="125"
            height="95"
            textAlignment="center"
            verticalTextAlignment="center"
            backgroundColor="#227B6B"
            borderRadius="14"
          />
        </template>
        <template v-if="mode === 'board'">
          <StackLayout
            v-for="(column, index) in columns"
            :key="column"
            :id="`depth-${column}`"
            :automationText="`depth-${column}`"
            :left="10 + index * 155"
            top="10"
            width="145"
            padding="6"
            backgroundColor="#1B3048"
            borderRadius="12"
            @layoutChanged="column === 'done' && outline()"
          >
            <Label
              :text="column === 'done' ? 'DONE' : 'BACKLOG'"
              fontSize="11"
              color="#A5B7D1"
              margin="2 4 6"
            />
            <Label
              :height="gap?.column === column && gap.top ? 44 : 0"
              backgroundColor="#2C5764"
              borderRadius="10"
            />
            <Label
              :id="`depth-first-${column}`"
              :text="column === 'done' ? 'Ship' : 'Spec'"
              height="40"
              padding="0 10"
              backgroundColor="#2A4060"
              borderRadius="10"
              marginBottom="6"
            />
            <GridLayout
              v-if="home === column"
              id="depth-card"
              automationText="depth-card"
              columns="36,*"
              rows="auto,auto"
              backgroundColor="#61E4C2"
              borderRadius="10"
              marginBottom="6"
            >
              <Label
                id="depth-grip"
                automationText="depth-grip"
                rowSpan="2"
                text="⋮⋮"
                color="#102C35"
                fontSize="18"
                textAlignment="center"
                verticalTextAlignment="center"
                backgroundColor="#3FB89A"
                borderRadius="10 0 0 10"
              />
              <Label
                col="1"
                text="Launch notes"
                color="#102C35"
                fontWeight="bold"
                fontSize="13"
                margin="8 8 2"
              />
              <Button
                col="1"
                row="1"
                :text="`Open · ${opened}`"
                automationText="depth-open"
                fontSize="11"
                height="30"
                margin="0 8 8"
                color="#61E4C2"
                backgroundColor="#102C35"
                @tap="opened++"
              />
            </GridLayout>
            <Label
              :height="gap?.column === column && !gap.top ? 44 : 0"
              backgroundColor="#2C5764"
              borderRadius="10"
            />
          </StackLayout>
          <Label
            text="+60 DIP hit padding"
            left="165"
            :top="paddingTop"
            width="145"
            height="60"
            fontSize="11"
            color="#70A9B9"
            textAlignment="center"
            verticalTextAlignment="center"
            borderWidth="1"
            borderColor="#70A9B9"
            borderRadius="0 0 12 12"
          />
          <Label
            id="depth-locked"
            automationText="depth-locked"
            text="LOCKED"
            left="165"
            top="230"
            width="145"
            height="60"
            textAlignment="center"
            verticalTextAlignment="center"
            backgroundColor="#8B3C49"
            borderRadius="12"
          />
        </template>
        <template v-if="mode === 'inspector'">
          <PortableScene id="depth-scene" left="0" top="0" width="320" height="130" />
          <PortableReveal
            v-for="i in [0, 1, 2]"
            :key="i"
            :id="`depth-bar-${i}`"
            left="20"
            :top="145 + i * 45"
            width="280"
            height="34"
            backgroundColor="#24374E"
          />
        </template>
        <GridLayout
          v-else-if="mode !== 'board'"
          id="depth-card"
          automationText="depth-card"
          :left="mode === 'shadow' || mode === 'depth' ? 110 : 20"
          :top="mode === 'drop' ? 210 : 150"
          width="80"
          height="70"
          backgroundColor="#61E4C2"
          borderRadius="12"
        >
          <Label
            :text="mode === 'path' ? '➜' : 'JOLT'"
            color="#102C35"
            fontSize="20"
            fontWeight="bold"
            textAlignment="center"
            verticalAlignment="center"
          />
        </GridLayout>
      </AbsoluteLayout>
      <Label
        :text="status"
        automationText="depth-status"
        fontSize="15"
        textWrap="true"
        marginTop="12"
        minHeight="45"
      />
      <Label
        v-if="detail"
        :text="detail"
        fontSize="11"
        color="#A5B7D1"
        textWrap="true"
        marginBottom="8"
      />
      <GridLayout columns="*,*,*" rows="44,44" marginTop="4">
        <Button
          backgroundColor="#263A57"
          color="#ECF4FF"
          fontSize="12"
          borderRadius="8"
          margin="3"
          col="0"
          row="0"
          :text="mode === 'board' ? 'Send' : mode === 'drop' ? 'Accept' : 'Play'"
          automationText="depth-play"
          @tap="play(false)"
        />
        <Button
          backgroundColor="#263A57"
          color="#ECF4FF"
          fontSize="12"
          borderRadius="8"
          margin="3"
          col="1"
          row="0"
          :text="
            mode === 'audio'
              ? muted
                ? 'Unmute'
                : 'Mute'
              : mode === 'board'
                ? reduced
                  ? 'Motion'
                  : 'Reduce'
                : 'Replace'
          "
          automationText="depth-replace"
          @tap="mode === 'audio' ? mute() : play(true)"
        />
        <Button
          backgroundColor="#263A57"
          color="#ECF4FF"
          fontSize="12"
          borderRadius="8"
          margin="3"
          col="2"
          row="0"
          text="Pause / play"
          automationText="depth-pause"
          @tap="pause"
        />
        <Button
          backgroundColor="#263A57"
          color="#ECF4FF"
          fontSize="12"
          borderRadius="8"
          margin="3"
          col="0"
          row="1"
          text="Seek 60%"
          automationText="depth-seek"
          @tap="seek"
        />
        <Button
          backgroundColor="#263A57"
          color="#ECF4FF"
          fontSize="12"
          borderRadius="8"
          margin="3"
          col="1"
          row="1"
          text="Inspect"
          automationText="depth-inspect"
          @tap="inspect"
        />
        <Button
          backgroundColor="#263A57"
          color="#ECF4FF"
          fontSize="12"
          borderRadius="8"
          margin="3"
          col="2"
          row="1"
          text="Remount"
          automationText="depth-reset"
          @tap="reset"
        />
      </GridLayout>
    </StackLayout>
  </ScrollView>
</template>
