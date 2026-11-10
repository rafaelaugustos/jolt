/** Reuse the public Web contracts under the actual framework's lifecycle owner. */
export function characterSetup(scope, host, runtime) {
  host.innerHTML = `<section data-characters><h2>Keyframes, interaction & characters</h2>
  <p>Existing portable APIs · one framework owner</p>
  <div class="controls"><button data-key-play>Play twice</button><button data-key-pause>Pause</button><button data-key-resume>Resume</button></div>
  <div class="resource-stage"><div class="resource-card" data-key-marker>KEYFRAMES</div></div><output data-key-status>ready</output>
  <div class="resource-stage character-gesture"><button class="resource-card" data-gesture aria-label="Transform card">↗ TRANSFORM</button></div>
  <output data-gesture-status>ready</output><div class="controls"><button data-gesture-zoom>Zoom +</button><button data-gesture-turn>Turn 30°</button><button data-gesture-reset>Reset transform</button></div>
  <h3>Move with intent</h3><div class="transfer-stage"><button data-gift>GIFT</button><div class="drop-targets"><div data-basket>BASKET</div><div data-locked>LOCKED</div></div></div>
  <output data-drop-status>ready</output><div class="controls"><button data-drop-send>Send to basket</button><button data-drop-return>Return</button></div>
  <div class="character-list" data-list></div><output data-order-status></output><div class="controls"><button data-order-down>First item down</button><button data-order-reset>Reset list</button></div>
  <h3>A little personality</h3><div class="character-canvas" data-character><div data-body><div data-head><i></i><i></i></div><div data-arm><span data-flower aria-label="Flower">✿</span></div></div></div>
  <div class="controls"><button data-rig-wave>Wave</button><button data-rig-blend>Blend poses</button><button data-rig-rest>Rest</button><button data-celebrate>Celebrate</button><button data-effect-cancel>Cancel effect</button><button data-emit>Emit</button></div>
  <output data-rig-status>rest</output> · <output data-particle-status>ready</output>
  <p>CSS pixels and degrees. Mouse/keyboard controls; touch composition tested separately.</p></section>`
  const q = (selector) => host.querySelector(selector)
  scope.add(() => host.replaceChildren())
  const abort = new AbortController()
  scope.add(() => abort.abort())
  const on = (selector, callback) =>
    q(selector).addEventListener('click', callback, { signal: abort.signal })
  const owner = { scope, key: undefined, effect: undefined, particles: undefined }
  on('[data-key-play]', () => {
    if (owner.key) scope.release(owner.key)
    const animation = (owner.key = scope.animate(
      q('[data-key-marker]'),
      { x: [-100, 100, 0] },
      {
        duration: 1800,
        times: [0, 0.6, 1],
        ease: ['easeIn', 'easeOut'],
        repeat: 1,
        repeatType: 'reverse',
      },
    ))
    q('[data-key-status]').textContent = 'running'
    animation.finished.then((ok) => {
      if (owner.key === animation && !scope.disposed)
        q('[data-key-status]').textContent = ok ? 'completed' : 'cancelled'
    })
  })
  on('[data-key-pause]', () => {
    owner.key?.pause()
    q('[data-key-status]').textContent = 'paused'
  })
  on('[data-key-resume]', () => {
    owner.key?.play()
    q('[data-key-status]').textContent = 'running'
  })
  const gestureStatus = () => {
    const p = owner.gestures.position
    q('[data-gesture-status]').textContent =
      `x ${p.x.toFixed(0)} · scale ${p.scale.toFixed(2)} · angle ${p.rotate.toFixed(0)}`
  }
  owner.gestures = scope.gestures(q('[data-gesture]'), {
    pan: { bounds: { left: -100, right: 100, top: -70, bottom: 70 } },
    pinch: { min: 0.6, max: 2 },
    rotate: true,
    onMove: gestureStatus,
    onSettled: gestureStatus,
  })
  for (const value of [owner.gestures.x, owner.gestures.scale, owner.gestures.rotate])
    scope.subscribe(value, gestureStatus)
  on('[data-gesture-zoom]', () =>
    owner.gestures.settleTo({ scale: Math.min(2, owner.gestures.position.scale * 1.25) }),
  )
  on('[data-gesture-turn]', () =>
    owner.gestures.settleTo({ rotate: owner.gestures.position.rotate + 30 }),
  )
  on('[data-gesture-reset]', () =>
    owner.gestures.settleTo({ x: 0, y: 0, scale: 1, rotate: 0 }),
  )
  let effects = 0
  const dropStatus = (text) => {
    q('[data-drop-status]').textContent = `${text} · effects ${effects}`
  }
  owner.drop = scope.dropZones(q('[data-gift]'), {
    targets: [
      { id: 'basket', target: q('[data-basket]') },
      { id: 'locked', target: q('[data-locked]'), priority: 10, accept: () => false },
    ],
    drag: {},
    onReject: () => dropStatus('rejected'),
    onDrop: ({ id }) => {
      effects++
      dropStatus('accepted · ' + id)
      return () => {
        effects--
        dropStatus('returned')
      }
    },
  })
  on('[data-drop-send]', () => owner.drop.request('basket'))
  on('[data-drop-return]', () => {
    owner.drop.cancel()
    runtime.set(q('[data-gift]'), { x: 0, y: 0 })
  })
  const list = q('[data-list]'),
    original = Array.from({ length: 12 }, (_, i) => `Item ${i + 1}`)
  let keys = [...original]
  const rows = new Map(
    keys.map((key) => {
      const row = document.createElement('div')
      row.className = 'character-row'
      row.dataset.key = key
      const text = document.createElement('span')
      text.textContent = key
      const handle = document.createElement('button')
      handle.dataset.handle = ''
      handle.textContent = '☰'
      handle.setAttribute('aria-label', 'Move ' + key)
      row.append(text, handle)
      return [key, row]
    }),
  )
  const render = () => {
    for (const key of keys) list.append(rows.get(key))
    q('[data-order-status]').textContent = keys.slice(0, 4).join(', ')
  }
  render()
  owner.reorder = scope.reorder(list, {
    items: () => keys.map((key) => ({ key, target: rows.get(key) })),
    handle: '[data-handle]',
    scrollContainer: list,
    onCommit: ({ key, toIndex }) => {
      keys.splice(keys.indexOf(key), 1)
      keys.splice(toIndex, 0, key)
      render()
      owner.reorder.refresh()
    },
  })
  on('[data-order-down]', () => owner.reorder.moveDown(keys[0]))
  on('[data-order-reset]', () => {
    owner.reorder.cancel()
    keys = [...original]
    render()
    owner.reorder.refresh()
    list.scrollTop = 0
  })
  owner.rig = scope.rig2d(
    {
      parts: {
        body: { rest: { x: 70, y: 100 } },
        head: { parent: 'body', rest: { x: 5, y: -65 }, rotation: [-20, 20] },
        arm: {
          parent: 'body',
          pivot: { x: 0, y: 0.5 },
          rest: { x: 85, y: 38 },
          rotation: [-90, 30],
        },
      },
      poses: {
        rest: {},
        wave: { arm: { rotate: -65 }, head: { rotate: -12 } },
        bow: { body: { y: 112, rotate: 8 }, head: { rotate: 16 } },
      },
      sockets: { hand: { part: 'arm', x: 0.95, y: 0.5, units: 'relative' } },
    },
    { body: q('[data-body]'), head: q('[data-head]'), arm: q('[data-arm]') },
  )
  owner.rig.accessory('hand', q('[data-flower]'))
  on('[data-rig-wave]', () => {
    owner.rig.to('wave', 'smooth')
    q('[data-rig-status]').textContent = 'wave'
  })
  on('[data-rig-blend]', () => {
    owner.rig.blend(
      [
        { pose: 'wave', weight: 0.5 },
        { pose: 'bow', weight: 0.5 },
      ],
      'smooth',
    )
    q('[data-rig-status]').textContent = 'blended'
  })
  on('[data-rig-rest]', () => {
    owner.rig.to('rest', 'smooth')
    q('[data-rig-status]').textContent = 'rest'
  })
  const cue = scope.motionValue(0)
  on('[data-celebrate]', () => {
    if (owner.effect) scope.release(owner.effect)
    cue.set(0)
    const timeline = runtime.seekableTimeline([
      { value: cue, keyframes: [0, 1], transition: { duration: 4000 } },
    ])
    owner.effect = scope.withTimelineCues(
      timeline,
      [
        {
          name: 'celebrate',
          at: 200,
          effect: () => {
            const particles = (owner.particles = runtime.confetti(q('[data-character]'), {
              count: 100,
              colors: ['#dbff7a', '#7766ff', '#ff9dce'],
            }))
            q('[data-particle-status]').textContent = '100 · running'
            particles.finished.then(() => {
              if (!scope.disposed && owner.particles === particles)
                q('[data-particle-status]').textContent = '0 · completed'
            })
            return particles
          },
        },
      ],
      { late: 'catch-up' },
    )
    timeline.play()
  })
  on('[data-emit]', () => {
    owner.effect?.dispose()
    owner.particles?.dispose()
    const particles = (owner.particles = scope.particles(q('[data-character]'), {
      colors: ['#dbff7a', '#7766ff', '#ff9dce'],
      shape: 'rectangle',
      rate: 24,
      duration: 1400,
      lifetime: 1600,
      velocity: 150,
      velocityRange: 70,
      angle: -90,
      spread: 90,
      gravity: 250,
      spinRange: 180,
    }))
    q('[data-particle-status]').textContent = 'finite emission'
    particles.finished.then(() => {
      if (!scope.disposed && owner.particles === particles)
        q('[data-particle-status]').textContent = '0 · completed'
    })
  })
  on('[data-effect-cancel]', () => {
    owner.effect?.dispose()
    owner.particles?.dispose()
    q('[data-particle-status]').textContent = '0 · cancelled'
  })
  ;(window.characterOwners ??= []).push(owner)
}
