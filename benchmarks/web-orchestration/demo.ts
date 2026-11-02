import {
  createWebRuntime,
  type WebAnimation,
  type TimelineAnimation,
} from '../../src/web/public.js'

export function demo(mode: string) {
  const motion = createWebRuntime(document, { reducedMotion: 'never' }),
    scope = motion.scope()
  const stage = document.querySelector<HTMLElement>('#stage')!,
    controls = document.querySelector('#controls')!,
    status = document.querySelector('#status')!
  const title = document.querySelector('#title')!,
    description = document.querySelector('#description')!
  const button = (id: string, label: string, action: () => void) => {
    const el = document.createElement('button')
    el.id = id
    el.textContent = label
    el.onclick = action
    controls.append(el)
    return el
  }
  const card = (label: string, id = 'card') => {
    const el = document.createElement('div')
    el.className = 'card'
    el.id = id
    el.textContent = label
    stage.append(el)
    return el
  }
  const say = (message: string) => {
    status.textContent = message
  }
  const trackProgress = (source: WebAnimation) => {
    const p = scope.playbackProgress(source),
      bar = document.querySelector<HTMLElement>('#bar')!
    scope.bind(bar, { scaleX: p })
    scope.subscribe(p, (v) => {
      document.querySelector('#percentage')!.textContent = `${Math.round(v * 100)}%`
    })
    return p
  }
  window.addEventListener('pagehide', () => motion.dispose(), { once: true })
  if (mode === 'stroke') {
    title.textContent = 'Draw. Interrupt. Reverse.'
    description.textContent =
      'Measured SVG connections, with one controllable drawing per path.'
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 780 320')
    svg.style.cssText = 'width:100%;height:100%'
    stage.append(svg)
    const paths = [
      'M 50 160 C 240 160 320 55 700 55',
      'M 50 160 C 260 160 360 160 700 160',
      'M 50 160 C 240 160 320 265 700 265',
    ].map((d, index) => {
      const path = document.createElementNS(svg.namespaceURI, 'path') as SVGPathElement
      path.setAttribute('d', d)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', ['#86c5b8', '#a5b4fc', '#f4c68d'][index]!)
      path.setAttribute('stroke-width', '5')
      path.setAttribute('stroke-linecap', 'round')
      svg.append(path)
      return path
    })
    for (const [x, y, label] of [
      [50, 160, 'SOURCE'],
      [700, 55, 'NORTH'],
      [700, 160, 'EAST'],
      [700, 265, 'SOUTH'],
    ] as const) {
      const dot = document.createElementNS(svg.namespaceURI, 'circle')
      dot.setAttribute('cx', String(x))
      dot.setAttribute('cy', String(y))
      dot.setAttribute('r', '10')
      dot.setAttribute('fill', '#e8edf6')
      svg.append(dot)
      const text = document.createElementNS(svg.namespaceURI, 'text')
      text.setAttribute('x', String(x))
      text.setAttribute('y', String(y + 32))
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('fill', '#adb9ce')
      text.setAttribute('font-size', '13')
      text.textContent = label
      svg.append(text)
    }
    const drawings = paths.map((path) => scope.drawPath(path, { progress: 0 }))
    let playing: WebAnimation[] = []
    const go = (progress: number) => {
      playing = drawings.map((drawing) =>
        drawing.animate(progress, { duration: 2600, ease: 'easeInOut' }),
      )
      trackProgress(playing[0]!)
      say(
        progress
          ? 'Drawing toward the destinations'
          : 'Reversing from the current presentation',
      )
    }
    button('draw', 'Draw connections', () => go(1))
    button('reverse', 'Reverse', () => go(0))
    button('pause', 'Pause', () => {
      drawings.forEach((d) => d.pause())
      say('All strokes paused at their current progress')
    })
    button('resume', 'Resume', () => {
      drawings.forEach((d) => d.play())
      say('Resuming existing drawing clocks')
    })
    button('seek', 'Seek to 65%', () => {
      playing.forEach((p) => (p.progress = 0.65))
      say('Seek changes the strokes and the progress binding')
    })
    button('geometry', 'Change geometry', () => {
      paths[0]!.setAttribute('d', 'M 50 160 C 460 300 420 20 700 55')
      drawings[0]!.refresh()
      say('Length remeasured; normalized drawing progress retained')
    })
    button('reduced', 'Reduce motion', () => {
      motion.configure({ reducedMotion: 'always' })
      go(1)
      say('Reduced motion: connections are complete immediately')
    })
  } else if (mode === 'values') {
    title.textContent = 'One value. Every surface.'
    description.textContent =
      'Keyframes, additive layers and live progress share the playback clock.'
    const tile = card('VALUE'),
      value = scope.motionValue(0)
    scope.bind(tile, { x: value })
    scope.subscribe(value, (v) => {
      tile.textContent = String(Math.round(v))
    })
    let animation: WebAnimation | undefined, layer: WebAnimation | undefined
    button('play', 'Play keyframes', () => {
      scope.set(value, 0)
      animation = scope.animate(value, [0, 320, 160, 400], {
        duration: 3600,
        ease: 'linear',
      })
      trackProgress(animation)
      say('Keyframes → 320 → 160 → 400')
    })
    button('layer', 'Add +60 layer', () => {
      layer?.stop()
      layer = scope.animate(value, 60, { layer: 'accent', duration: 500 })
      say('The accent adds to the running base value')
    })
    button('replace', 'Spring to 160', () => {
      animation = scope.animate(value, 160, 'bouncy')
      trackProgress(animation)
      say('New spring inherits current position and velocity')
    })
    button('pause', 'Pause', () => {
      animation?.pause()
      layer?.pause()
      say('Paused — value and progress hold')
    })
    button('resume', 'Resume', () => {
      animation?.play()
      layer?.play()
      say('Resuming the existing clocks')
    })
    button('seek', 'Seek to 65%', () => {
      if (animation) animation.progress = 0.65
      say('Seek updates the value and progress binding')
    })
    button('stop-layer', 'Remove layer', () => {
      motion.stop(value, { layer: 'accent' })
      say('Base movement remains owned by the application')
    })
  } else if (mode === 'decay') {
    title.textContent = 'Release with momentum.'
    description.textContent =
      'Drag the card. Velocity becomes decay, then a projected snap point.'
    const tile = card('DRAG ME')
    tile.tabIndex = 0
    tile.setAttribute(
      'aria-label',
      'Draggable card; use coast buttons for keyboard input',
    )
    tile.style.touchAction = 'none'
    let x = 0,
      anchor = 0,
      start = 0,
      last = 0,
      time = 0,
      velocity = 0,
      pointer: number | undefined,
      animation: WebAnimation | undefined
    const read = () => new DOMMatrix(getComputedStyle(tile).transform).e
    const release = (v: number) => {
      animation = scope.decay(
        tile,
        { x: v },
        { friction: 0.992, snap: [0, 140, 280, 420] },
      )
      trackProgress(animation)
      say(`Release: ${Math.round(v)} px/s · snap from projected destination`)
      void animation.finished.then((done) => {
        if (done) say(`Settled at ${Math.round(read())} px`)
      })
    }
    tile.onpointerdown = (e) => {
      pointer = e.pointerId
      anchor = read()
      motion.stop(tile, ['x'])
      start = e.clientX
      last = e.clientX
      time = e.timeStamp
      velocity = 0
      tile.setPointerCapture(pointer)
      say('Pointer captured — move, then release')
    }
    tile.onpointermove = (e) => {
      if (pointer !== e.pointerId) return
      x = Math.max(0, Math.min(420, anchor + e.clientX - start))
      const dt = e.timeStamp - time
      if (dt > 0) velocity = ((e.clientX - last) / dt) * 1000
      last = e.clientX
      time = e.timeStamp
      motion.set(tile, { x })
    }
    tile.onpointerup = (e) => {
      if (pointer !== e.pointerId) return
      pointer = undefined
      tile.releasePointerCapture(e.pointerId)
      release(Math.max(-1800, Math.min(1800, velocity)))
    }
    tile.onpointercancel = () => {
      pointer = undefined
      say('Gesture cancelled')
    }
    button('right', 'Coast right', () => release(900))
    button('left', 'Coast left', () => release(-900))
    button('pause', 'Pause', () => {
      animation?.pause()
      say('Momentum paused')
    })
    button('resume', 'Resume', () => {
      animation?.play()
      say('Momentum resumed')
    })
    button('stop', 'Stop here', () => {
      animation?.stop()
      say('Cancelled at the current position')
    })
  } else if (mode === 'groups') {
    title.textContent = 'A scene, under one control.'
    description.textContent =
      'Pause running participants and future callbacks. Overlap sequences deliberately.'
    const first = card('LEAD'),
      second = card('FUTURE', 'future'),
      third = card('FINALE', 'finale')
    second.style.top = '125px'
    third.style.top = '225px'
    let group: TimelineAnimation | undefined
    const reset = () => {
      scope.reset()
      motion.set([first, second, third], { x: 0, opacity: 1 })
      motion.set([second, third], { opacity: 0.2 })
    }
    button('timeline', 'Start timeline', () => {
      reset()
      say('Timeline running · checkpoint scheduled at 1.5 seconds')
      group = scope.timeline([
        [first, { x: [0, 400] }, { duration: 3200, ease: 'linear' }],
        {
          at: 1500,
          run: () => {
            say('Future callback activated')
            return scope.animate(second, { x: 280, opacity: 1 }, { duration: 1200 })
          },
        },
        [third, { x: 160, opacity: 1 }, { at: 2600, duration: 700 }],
      ])
      void group.finished.then((done) =>
        say(done ? 'Timeline completed' : 'Timeline cancelled — future work removed'),
      )
    })
    button('sequence', 'Play overlapping sequence', () => {
      reset()
      say('Sequence: lead, overlapping future, then finale')
      const sequence = scope.sequence([
        [first, { x: [0, 400] }, { duration: 1800 }],
        [second, { x: [0, 280], opacity: [0.2, 1] }, { duration: 1200, at: '-600' }],
        () => {
          say('Callback starts the final step')
          return scope.animate(third, { x: 160, opacity: 1 }, 'bouncy')
        },
      ])
      void sequence.finished.then((done) =>
        say(done ? 'Sequence completed' : 'Sequence cancelled'),
      )
    })
    button('pause', 'Pause scene', () => {
      group?.pause()
      say('Paused — the scheduled callback also waits')
    })
    button('resume', 'Resume scene', () => {
      group?.play()
      say('Resumed from the same scene time')
    })
    button('stop', 'Cancel scene', () => {
      scope.reset()
      say('Cancelled all owned participants and future work')
    })
  } else {
    title.textContent = 'Intent survives a new element.'
    description.textContent =
      'Named states, per-target transitions and a replaceable card reference.'
    let tile = card('READY'),
      badge = card('STATUS', 'badge')
    badge.style.top = '175px'
    badge.style.width = '180px'
    const states = scope.motionStates(
      { card: tile, badge },
      {
        ready: {
          card: { x: 0, scale: 1, backgroundColor: '#86c5b8' },
          badge: { opacity: 0.5, x: 0 },
        },
        working: {
          card: { x: 320, scale: 1.15, backgroundColor: '#a5b4fc' },
          badge: { opacity: 1, x: 160 },
        },
        error: {
          card: { x: 80, scale: 1, backgroundColor: '#f4a39a' },
          badge: { opacity: 1, x: 80 },
        },
        done: {
          card: { x: 400, scale: 1, backgroundColor: '#9cdbad' },
          badge: { opacity: 0.7, x: 280 },
        },
      },
      { transition: { duration: 2200, badge: { duration: 700 } } },
    )
    const go = (name: 'ready' | 'working' | 'error' | 'done') => {
      tile.textContent = name.toUpperCase()
      badge.textContent = name === 'working' ? 'IN PROGRESS' : name.toUpperCase()
      say(`Requested ${name} · previous settled: ${states.settled ?? 'none'}`)
      void states.to(name).finished.then((done) => {
        if (done) say(`Settled: ${states.settled}`)
      })
    }
    button('work', 'Work', () => go('working'))
    button('error', 'Interrupt with error', () => go('error'))
    button('done', 'Complete', () => go('done'))
    button('replace', 'Replace card ref', () => {
      const next = card('NEW ELEMENT', 'card')
      next.style.background = '#a5b4fc'
      states.attach('card', next)
      tile.remove()
      tile = next
      say('New card joined the active transition; completion waits for it')
    })
    button('pause', 'Pause', () => {
      states.pause()
      say('State participants paused')
    })
    button('resume', 'Resume', () => {
      states.play()
      say('State participants resumed')
    })
    button('ready', 'Reset', () => go('ready'))
  }
  say('Ready · use the controls')
}
