import { createWebRuntime } from '../../src/web/public.js'

export function mountDemo(mode: string) {
  if (!['paint', 'size', 'layout', 'scene'].includes(mode)) return
  document.body.dataset.demo = mode
  const root = document.createElement('main')
  root.className = 'demo'
  document.body.prepend(root)
  const motion = createWebRuntime(document, { reducedMotion: 'never' })
  const titles: Record<string, [string, string]> = {
    paint: [
      'Color, corners & live values',
      'Independent paint channels · application scale + press',
    ],
    size: [
      'Real size, real text reflow',
      'Width + intrinsic height · interruption · pause and resume',
    ],
    layout: [
      'Layout that follows the change',
      'Direct-child FLIP · reorder, resize, insert and remove',
    ],
    scene: [
      'One scene. One clock.',
      'Two surfaces + a numeric value · pause, seek and rewind',
    ],
  }
  const [title, subtitle] = titles[mode]!
  root.innerHTML = `<header><span class="eyebrow">JOLT / WEB</span><h1>${title}</h1><p>${subtitle}</p></header><section id="demo-stage"></section><nav id="controls" aria-label="Motion controls"></nav><p id="demo-status" role="status">Ready — use the controls below the demonstration.</p><footer>Real browser playback · no CSS transitions · original timing</footer>`
  const stage = root.querySelector<HTMLElement>('#demo-stage')!
  const controls = root.querySelector<HTMLElement>('#controls')!
  const status = (text: string) => {
    root.querySelector('#demo-status')!.textContent = text
  }
  const button = (id: string, label: string, run: () => void) => {
    const el = document.createElement('button')
    el.id = id
    el.textContent = label
    el.addEventListener('click', run)
    controls.append(el)
    return el
  }
  const range = (label: string, run: (value: number) => void) => {
    const wrapper = document.createElement('label')
    wrapper.className = 'range-label'
    wrapper.textContent = label
    const input = document.createElement('input')
    input.id = 'progress'
    input.type = 'range'
    input.min = '0'
    input.max = '100'
    input.value = '0'
    input.step = '1'
    input.setAttribute('aria-label', label)
    input.addEventListener('input', () => run(Number(input.value) / 100))
    wrapper.append(input)
    controls.append(wrapper)
    return input
  }
  if (mode === 'paint') {
    stage.innerHTML =
      '<div class="paint-row"><button id="paint-card" class="visual-card">Hold me<br><small>Application scale × press</small></button><div id="live-card" class="visual-card">Live color<br><small>One numeric source</small></div></div>'
    const card = stage.querySelector<HTMLElement>('#paint-card')!,
      live = stage.querySelector<HTMLElement>('#live-card')!
    motion.set(card, { scale: 1.05 })
    motion.press(card)
    let alternate = false
    button('paint', 'Change paint & corners', () => {
      alternate = !alternate
      motion.animate(
        card,
        {
          backgroundColor: alternate ? '#d8f381' : '#7655e8',
          color: alternate ? '#15291e' : '#ffffff',
          borderTopColor: alternate ? '#dc672a' : '#c0a5ff',
          borderRightColor: alternate ? '#168b83' : '#b9a1ff',
          borderTopWidth: alternate ? 12 : 3,
          borderRightWidth: alternate ? 8 : 3,
          borderRadius: alternate ? '42px 12px 56px 20px / 16px 32px 24px 48px' : '18px',
        },
        { type: 'spring', duration: 900, bounce: 0.12 },
      )
      status(
        'Colors, independent borders and elliptical corners share playback. Press remains independent.',
      )
    })
    const input = motion.motionValue(0),
      follower = motion.springValue(input, { stiffness: 180, damping: 24 })
    motion.bind(live, {
      backgroundColor: follower.to([0, 1], ['#7655e8', '#ed8b46']),
      borderRadius: follower.to([0, 1], [12, 64]),
      borderLeftWidth: follower.to([0, 1], [3, 16]),
    })
    range('Live value', (value) => {
      input.set(value)
      status(`Continuous color and corners follow ${Math.round(value * 100)}%.`)
    })
  } else if (mode === 'size') {
    stage.innerHTML =
      '<article id="size-card"><strong>Content has a real size.</strong><p>Changing width rewraps this text. Changing height moves the following row through actual browser layout.</p></article><div class="following">Following row · hit target remains in the layout</div>'
    const card = stage.querySelector<HTMLElement>('#size-card')!
    let expanded = false,
      operation: ReturnType<typeof motion.animateSize> | undefined
    button('resize', 'Resize / reverse', () => {
      expanded = !expanded
      operation = motion.animateSize(
        card,
        { width: expanded ? 580 : 320, height: 'auto' },
        () => {
          card.innerHTML =
            '<strong>Content has a real size.</strong><p>Changing width rewraps this text. Changing height moves the following row through actual browser layout.</p>' +
            (expanded
              ? '<p>Intrinsic height is measured again while content changes. A new target interrupts the current motion.</p>'
              : '')
        },
        { type: 'spring', duration: 1400, bounce: 0 },
      )
      status('Width and auto height are animating together. Reverse at any moment.')
    })
    button('content', 'Add content', () => {
      card.insertAdjacentHTML(
        'beforeend',
        '<p>New content joins the same intrinsic measurement.</p>',
      )
      if (!operation || operation.paused) operation?.play()
      status('Content changed while the intrinsic-size operation is active.')
    })
    button('pause', 'Pause', () => {
      operation?.pause()
      status('Paused — no size frames are scheduled.')
    })
    button('resume', 'Resume', () => {
      operation?.play()
      status('Continuing from the paused size.')
    })
  } else if (mode === 'layout') {
    stage.innerHTML = '<div id="tiles"></div>'
    const tiles = stage.querySelector<HTMLElement>('#tiles')!
    let count = 0,
      dense = false
    const insert = () => {
      const el = document.createElement('button')
      el.className = 'tile'
      el.textContent = `Card ${++count}`
      tiles.append(el)
      return el
    }
    for (let i = 0; i < 4; i++) insert()
    const change = (fn: () => void) => {
      motion.animateLayout(tiles, fn, { type: 'spring', duration: 1100, bounce: 0.12 })
      status('The final layout is applied; inverse position and size animate into place.')
    }
    button('reorder', 'Reorder', () =>
      change(() => tiles.append(tiles.firstElementChild!)),
    )
    button('density', 'Change columns', () =>
      change(() => {
        dense = !dense
        tiles.style.gridTemplateColumns = `repeat(${dense ? 3 : 2}, 1fr)`
      }),
    )
    button('insert', 'Insert card', () =>
      change(() => {
        insert()
      }),
    )
    button('remove', 'Remove card', () =>
      change(() => {
        tiles.firstElementChild?.remove()
      }),
    )
  } else {
    stage.innerHTML =
      '<div id="scene-a" class="scene-card">A</div><div id="scene-b" class="scene-card">B</div><output id="scene-value">0</output>'
    const a = stage.querySelector<HTMLElement>('#scene-a')!,
      b = stage.querySelector<HTMLElement>('#scene-b')!,
      output = stage.querySelector<HTMLOutputElement>('#scene-value')!
    const value = motion.motionValue(0)
    value.subscribe((v) => {
      output.value = String(Math.round(v))
    })
    const create = () =>
      motion.seekableTimeline(
        [
          {
            target: a,
            keyframes: {
              x: [0, 440],
              backgroundColor: ['#7655e8', '#e99245'],
              borderRadius: [14, 54],
            },
            transition: { duration: 2400, ease: 'linear' },
          },
          {
            at: 400,
            steps: [
              {
                target: b,
                keyframes: { x: [0, 300], scale: [1, 1.3], opacity: [0.45, 1] },
                transition: { duration: 1800, ease: 'linear' },
              },
            ],
          },
          { value, keyframes: [0, 100], transition: { duration: 2400, ease: 'linear' } },
        ],
        { paused: true },
      )
    let scene = create()
    button('play', 'Play', () => {
      scene.play()
      status('All tracks use one finite scene clock.')
    })
    button('pause', 'Pause', () => {
      scene.pause()
      status('Paused — seek forward or backward, including from 100%.')
    })
    button('reset', 'New scene', () => {
      scene.stop()
      scene = create()
      status('New scene ready.')
    })
    range('Scene progress', (value) => {
      scene.pause()
      scene.progress = value
      status(`Paused at ${Math.round(value * 100)}% — the endpoint can still rewind.`)
    })
  }
  window.addEventListener('pagehide', () => motion.dispose(), { once: true })
}
