import type {
  WebRuntime,
  WebMotionScope,
  CuedTimeline,
  WebAnimation,
} from '../../src/web/public.js'
import { audioCue } from '../../src/web/audio.js'
import { createMotionInspector } from '../../src/web/inspector.js'
import { portableScene } from '../web-portable/scene.js'

export function mountDemo(mode: string, runtime: WebRuntime, scope: WebMotionScope) {
  const el = (id: string) => document.getElementById(id)!
  const status = (text: string) => {
    el('status').textContent = text
  }
  const titles: Record<string, string> = {
    audio: 'Sound on the timeline',
    inspector: 'Who owns this motion?',
    path: 'One path, one clock',
    depth: 'Rotation in three axes',
    shadow: 'Light and depth',
  }
  el('title').textContent = titles[mode]!
  el('description').textContent =
    mode === 'inspector'
      ? 'Real WebGL uniforms · explicit inspection · no GPU-time inference.'
      : 'Browser playback · pause, seek, replace and remount.'
  el('stage').innerHTML = '<div id="source">JOLT</div>'
  el('request').textContent = 'Play'
  let playback: WebAnimation | CuedTimeline | undefined
  let play = (_replace = false) => {},
    inspect = () => {},
    muted = false
  const source = el('source')
  if (mode === 'audio') {
    const sound = scope.add(
      audioCue(document, '/cue.wav', {
        onError(error) {
          status(`Sound unavailable · visuals continue\n${String(error)}`)
        },
      }),
    )
    void sound.ready.then((ready) =>
      status(ready ? 'Local sound ready · tap Play' : 'Sound unavailable'),
    )
    play = (replace) => {
      if (replace) {
        muted = !muted
        sound.muted = muted
        status(muted ? 'Muted · audio clock continues' : 'Unmuted')
        return
      }
      playback?.stop()
      runtime.set(source, { x: 0, rotate: 0 })
      const visual = scope.animate(
        source,
        { x: [0, 430, 0], rotate: [0, 15, 0] },
        { duration: 2400 },
      )
      playback = scope.withTimelineCues(
        visual,
        ['entry', 'complete'].map((name, i) => ({
          name,
          at: 200 + i * 1100,
          effect() {
            status(`Cue: ${name} · ${muted ? 'muted' : 'playing'}`)
            return sound.play()
          },
        })),
      )
    }
    el('replace').textContent = 'Mute / unmute'
  } else if (mode === 'inspector') {
    el('stage').innerHTML =
      '<canvas id="scene" width="760" height="230" style="width:100%;height:230px"></canvas><pre id="inspection" style="padding:0 20px;font-size:14px"></pre>'
    const inspector = createMotionInspector(document, runtime, {
      development: true,
      capacity: 32,
    })
    scope.add(() => inspector.dispose())
    const scene = portableScene(el('scene') as HTMLCanvasElement, scope)
    if (!scene) throw new Error('This inspector fixture requires WebGL.')
    const group = scope.propertyGroup({
      a: scene.properties[0]!,
      b: scene.properties[1]!,
      c: scene.properties[2]!,
    })
    const activity = scope.renderActivity({ change: scene.render, redraw: scene.draw })
    scene.properties.forEach((property, i) =>
      inspector.adapters.watch(property, `material${i}`),
    )
    inspector.adapters.activity(activity, 'scene')
    inspect = () => {
      const snapshot = inspector.read().adapters
      el('inspection').textContent = snapshot.properties
        .map((p) => `${p.id}: ${p.ownerLabel ?? 'idle'} · ${p.values?.[0]?.toFixed(3)}`)
        .join('\n')
      status(
        `${snapshot.events
          .slice(-3)
          .map((e) => `${e.target}: ${e.kind}`)
          .join(
            ' / ',
          )}\nRenderer: ${activity.active ? 'active' : 'idle'} · ${snapshot.cost.writes} observed JS writes`,
      )
    }
    play = (replace) => {
      playback = scope.add(
        group.animate(replace ? { a: 0.2, b: 0.2, c: 0.2 } : { a: 1, b: 0.85, c: 0.7 }, {
          duration: 2600,
        }),
      )
      inspector.adapters.label(playback, replace ? 'click' : 'pulse')
      activity.track(playback)
      inspect()
    }
    inspect()
  } else {
    if (mode === 'depth') {
      el('stage').style.perspective = '700px'
      source.style.cssText += ';left:300px;top:110px;width:150px;height:110px'
    }
    if (mode === 'shadow') {
      source.style.cssText +=
        ';left:300px;top:100px;width:140px;height:110px;box-shadow:0 4px 8px rgba(0,0,0,.25)'
    }
    if (mode === 'path') source.textContent = '➜'
    play = (replace) => {
      if (mode === 'path')
        playback = scope.animate(
          source,
          replace
            ? { x: 0, y: 0, rotate: 0 }
            : { path: 'M0 0 C120 -220 360 180 550 -60', orient: true },
          { duration: 2600, ease: 'linear' },
        )
      if (mode === 'depth')
        playback = scope.animate(
          source,
          {
            rotateX: replace ? -35 : 55,
            rotateY: replace ? 45 : -40,
            rotate: replace ? 0 : 12,
            scale: replace ? 1 : 1.15,
          },
          { duration: 2400 },
        )
      if (mode === 'shadow')
        playback = scope.animate(
          source,
          {
            borderRadius: replace ? 12 : 35,
            shadowOpacity: replace ? 0.25 : 0.7,
            shadowRadius: replace ? 4 : 18,
            shadowOffsetX: replace ? 0 : -12,
            shadowOffsetY: replace ? 4 : 22,
            shadowColor: replace ? '#000000' : '#0000aa',
          },
          { duration: 2400 },
        )
      status(replace ? 'Replaced from the current pose' : 'Playing')
    }
    status('Ready · Play, pause, seek and replace')
  }
  return {
    play: () => play(),
    replace: () => play(true),
    inspect,
    pause() {
      if (playback?.paused) playback.play()
      else playback?.pause()
      status(playback?.paused ? 'Paused' : 'Resumed')
      if (mode === 'inspector') inspect()
    },
    seek() {
      if (playback) {
        playback.progress = 0.6
        status('Seek to 60% · cues stay silent')
        if (mode === 'inspector') inspect()
      }
    },
  }
}
