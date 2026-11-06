import {
  type Experiment,
  tile,
  travel,
  blocks,
  element,
  onRun,
  action,
  resetWords,
} from './types'

export const motionExperiments: Experiment[] = [
  {
    id: 'spring',
    family: 'motion',
    title: ['Spring', 'Spring', 'Spring', '弹簧'],
    hint: [
      'Tap, retarget, interrupt. Keep the momentum.',
      'Toque, mude o destino, interrompa. Sinta o impulso.',
      'Toca, cambia el destino, interrumpe. Siente el impulso.',
      '点击、改变目标、打断，保留动量。',
    ],
    guide: 'web-runtime#supported-motion',
    apis: ['animate', 'press'],
    parameter: {
      label: ['Bounce', 'Elasticidade', 'Rebote', '弹性'],
      min: 0,
      max: 0.8,
      step: 0.05,
      value: 0.4,
    },
    code: `scope.animate(card, { x: 110, rotate: 12 }, {\n  type: 'spring', bounce: 0.4, duration: 800\n})`,
    mount(ctx) {
      const card = tile(ctx)
      let right = false,
        bounce = ctx.parameter
      ctx.scope.press(card, { scale: 0.88 }, { transition: 'bouncy' })
      const run = () => {
        right = !right
        return ctx.scope.animate(
          card,
          { x: (right ? 1 : -1) * travel(ctx), rotate: right ? 12 : -12 },
          { type: 'spring', bounce, duration: 800 },
        )
      }
      onRun(ctx, card, run)
      return {
        run,
        adjust(value) {
          bounce = value
          run()
        },
      }
    },
  },
  {
    id: 'stagger',
    family: 'motion',
    title: ['Stagger', 'Stagger', 'Stagger', '交错'],
    hint: [
      'One gesture. A whole wave.',
      'Um gesto. Uma onda inteira.',
      'Un gesto. Toda una ola.',
      '一个动作，带起一整道波。',
    ],
    guide: 'web-runtime#supported-motion',
    apis: ['animate'],
    code: `scope.animate(cards, { y: [44, 0], scale: [.65, 1], opacity: [.15, 1] },\n  { type: 'spring', bounce: .35, duration: 650, stagger: 70 })`,
    mount(ctx) {
      const cards = blocks(ctx, 7)
      return {
        run: () =>
          ctx.scope.animate(
            cards,
            { y: [44, 0], scale: [0.65, 1], opacity: [0.15, 1] },
            { type: 'spring', bounce: 0.35, duration: 650, stagger: 70 },
          ),
      }
    },
  },
  {
    id: 'keyframes',
    family: 'motion',
    title: ['Keyframes', 'Keyframes', 'Keyframes', '关键帧'],
    hint: [
      'A little choreography, frame by frame.',
      'Uma pequena coreografia, quadro a quadro.',
      'Una pequeña coreografía, paso a paso.',
      '逐帧编排一段小小舞步。',
    ],
    guide: 'web-runtime#supported-motion',
    apis: ['animate'],
    code: `scope.animate(card, { x: [-80, 80, 0], y: [0, -55, 0], rotate: [0, 160, 360] },\n  { duration: 1400, ease: 'easeInOut' })`,
    mount(ctx) {
      const card = tile(ctx)
      return {
        run: () =>
          ctx.scope.animate(
            card,
            { x: [-travel(ctx), travel(ctx), 0], y: [0, -55, 0], rotate: [0, 160, 360] },
            { duration: 1400, ease: 'easeInOut' },
          ),
      }
    },
  },
  {
    id: 'presets',
    family: 'motion',
    title: ['Presets', 'Presets', 'Presets', '预设'],
    hint: [
      'Give a familiar entrance your own signature.',
      'Dê a uma entrada a sua assinatura.',
      'Dale tu firma a una entrada.',
      '为入场添加你的标记。',
    ],
    guide: 'web-runtime#supported-motion',
    apis: ['definePreset', 'animate'],
    code: `motion.definePreset('hello', {\n  keyframes: { y: [50, 0], rotate: [-18, 0], opacity: [0, 1] },\n  transition: { type: 'spring', bounce: .3, duration: 800 }\n})\nscope.animate(card, 'hello')`,
    mount(ctx) {
      const card = tile(ctx, '✳︎')
      ctx.motion.definePreset('labHello', {
        keyframes: { y: [50, 0], rotate: [-18, 0], opacity: [0, 1] },
        transition: { type: 'spring', bounce: 0.3, duration: 800 },
      })
      return { run: () => ctx.scope.animate(card, 'labHello') }
    },
  },
  {
    id: 'gravity',
    family: 'motion',
    title: ['Gravity', 'Gravidade', 'Gravedad', '重力'],
    hint: [
      'Let it drop. Watch the bounce settle.',
      'Solte e veja o quique se acomodar.',
      'Suéltalo y mira cómo se asienta.',
      '让它落下，看弹跳渐渐停稳。',
    ],
    guide: 'web-parity#gravity',
    apis: ['animate', 'set'],
    code: `scope.set(ball, { y: -95 })\nscope.animate(ball, { y: 75 },\n  { type: 'gravity', acceleration: 1800, restitution: .58 })`,
    mount(ctx) {
      const ball = tile(ctx, '●')
      ball.classList.add('lab-ball')
      element(ctx.host, 'div', 'lab-floor')
      return {
        run() {
          ctx.scope.set(ball, { y: -95 })
          return ctx.scope.animate(
            ball,
            { y: 75 },
            { type: 'gravity', acceleration: 1800, restitution: 0.58 },
          )
        },
      }
    },
  },
  {
    id: 'decay',
    family: 'motion',
    title: ['Decay & snap', 'Inércia e snap', 'Inercia y snap', '惯性与吸附'],
    hint: [
      'Launch it with velocity. Let friction find the stop.',
      'Lance com velocidade. O atrito encontra a parada.',
      'Lánzalo con velocidad. La fricción encuentra la parada.',
      '赋予速度，让摩擦找到停点。',
    ],
    guide: 'web-orchestration#decay',
    apis: ['decay', 'set'],
    code: `scope.set(card, { x: -100 })\nscope.decay(card, { x: 650 },\n  { friction: .99, snap: [-100, 0, 100] })`,
    mount(ctx) {
      const card = tile(ctx)
      let right = true
      return {
        run() {
          const d = travel(ctx)
          ctx.scope.set(card, { x: right ? -d : d })
          const velocity = right ? 650 : -650
          right = !right
          return ctx.scope.decay(
            card,
            { x: velocity },
            { friction: 0.99, snap: [-d, 0, d] },
          )
        },
      }
    },
  },
  {
    id: 'timeline',
    family: 'motion',
    title: ['Timeline', 'Timeline', 'Timeline', '时间线'],
    hint: [
      'Three arrivals, one shared clock. Pause them together.',
      'Três chegadas, um relógio. Pause tudo junto.',
      'Tres llegadas, un reloj. Páusalas juntas.',
      '三个入场，共用一个时钟，统一暂停。',
    ],
    guide: 'web-orchestration#groups',
    apis: ['timeline', 'set'],
    code: `scope.timeline([\n  [cards[0], { y: [60, 0] }, { duration: 900 }],\n  [cards[1], { y: [60, 0] }, { at: 250, duration: 900 }],\n  [cards[2], { y: [60, 0] }, { at: 500, duration: 900 }]\n])`,
    mount(ctx) {
      const cards = blocks(ctx, 3)
      return {
        run: () =>
          ctx.scope.timeline(
            cards.map(
              (card, i) =>
                [
                  card,
                  { y: [60, 0], opacity: [0.15, 1] },
                  { at: i * 250, duration: 900 },
                ] as const,
            ),
          ),
      }
    },
  },
  {
    id: 'sequence',
    family: 'motion',
    title: ['Sequence', 'Sequência', 'Secuencia', '序列'],
    hint: [
      'Pass the motion from one card to the next.',
      'Passe o movimento de um card para o próximo.',
      'Pasa el movimiento de una tarjeta a la siguiente.',
      '把动效从一张卡片传递到下一张。',
    ],
    guide: 'web-orchestration#groups',
    apis: ['sequence'],
    code: `scope.sequence(cards.map(card =>\n  [card, { y: [0, -45, 0], rotate: [0, 12, 0] },\n    { duration: 650 }]))`,
    mount(ctx) {
      const cards = blocks(ctx, 3)
      return {
        run: () =>
          ctx.scope.sequence(
            cards.map(
              (card) =>
                [
                  card,
                  { y: [0, -45, 0], rotate: [0, 12, 0] },
                  { duration: 650 },
                ] as const,
            ),
          ),
      }
    },
  },
  {
    id: 'scene',
    family: 'motion',
    title: ['Scrub a scene', 'Controle a cena', 'Controla la escena', '拖动时间轴'],
    hint: [
      'The whole scene follows your finger on the timeline.',
      'A cena inteira segue seu dedo na timeline.',
      'Toda la escena sigue tu dedo en la timeline.',
      '整个场景随时间轴上的手指而动。',
    ],
    guide: 'web-visual#scenes',
    apis: ['seekableTimeline'],
    parameter: {
      label: ['Progress', 'Progresso', 'Progreso', '进度'],
      min: 0,
      max: 1,
      step: 0.01,
      value: 0,
    },
    code: `const scene = scope.seekableTimeline([\n  { target: card, keyframes: { x: [-100, 100], rotate: [-25, 25] },\n    transition: { duration: 2000 } }\n], { paused: true })\nscene.progress = .5\nscene.play()`,
    mount(ctx) {
      const card = tile(ctx)
      const scene = ctx.scope.seekableTimeline(
        [
          {
            target: card,
            keyframes: {
              x: [-travel(ctx), travel(ctx)],
              rotate: [-25, 25],
              backgroundColor: ['#dcf71d', '#e8b9d8'],
            },
            transition: { duration: 2000 },
          },
        ],
        { paused: true },
      )
      return {
        run() {
          scene.progress = 0
          scene.play()
        },
        adjust(value) {
          scene.pause()
          scene.progress = value
        },
      }
    },
  },
  {
    id: 'states',
    family: 'motion',
    title: ['Named states', 'Estados nomeados', 'Estados con nombre', '命名状态'],
    hint: [
      'Idle, working, done. Interrupt any transition.',
      'Parado, trabalhando, pronto. Interrompa qualquer transição.',
      'En reposo, trabajando, listo. Interrumpe cualquier transición.',
      '待机、工作、完成。随时打断转场。',
    ],
    guide: 'web-orchestration#states',
    apis: ['motionStates'],
    code: `const state = scope.motionStates({ card }, {\n  idle: { card: { scale: 1, rotate: 0 } },\n  working: { card: { scale: .8, rotate: 45 } },\n  done: { card: { scale: 1.12, rotate: 0 } }\n}, { transition: 'bouncy' })\nstate.to('working')`,
    mount(ctx) {
      const card = tile(ctx)
      const state = ctx.scope.motionStates(
        { card },
        {
          idle: {
            card: { scale: 1, rotate: 0, borderRadius: 24, backgroundColor: '#dcf71d' },
          },
          working: {
            card: {
              scale: 0.8,
              rotate: 45,
              borderRadius: 12,
              backgroundColor: '#e8b9d8',
            },
          },
          done: {
            card: {
              scale: 1.12,
              rotate: 0,
              borderRadius: 50,
              backgroundColor: '#b8d5fa',
            },
          },
        },
        { transition: 'bouncy' },
      )
      const names = ['idle', 'working', 'done'] as const
      let index = 0
      return {
        run() {
          index = (index + 1) % names.length
          card.textContent = ['↗', '✳︎', '✓'][index]!
          return state.to(names[index]!)
        },
      }
    },
  },
  {
    id: 'values',
    family: 'motion',
    title: [
      'Values & bindings',
      'Valores e vínculos',
      'Valores y vínculos',
      '数值与绑定',
    ],
    hint: [
      'One value drives position, rotation and color.',
      'Um valor controla posição, rotação e cor.',
      'Un valor controla posición, rotación y color.',
      '一个数值驱动位置、旋转与颜色。',
    ],
    guide: 'web-dynamic#values',
    apis: ['motionValue', 'springValue', 'bind', 'animate', 'set'],
    parameter: {
      label: ['Value', 'Valor', 'Valor', '数值'],
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.5,
    },
    code: `const value = scope.motionValue(.5)\nconst smooth = scope.springValue(value, { stiffness: 160, damping: 18 })\nscope.bind(card, {\n  x: scope.map(smooth, [0, 1], [-100, 100]),\n  rotate: scope.map(smooth, [0, 1], [-35, 35]),\n  backgroundColor: scope.map(smooth, [0, 1], ['#dcf71d', '#e8b9d8'])\n})\nvalue.set(1)`,
    mount(ctx) {
      const card = tile(ctx)
      const value = ctx.scope.motionValue(0.5)
      const smooth = ctx.scope.springValue(value, { stiffness: 160, damping: 18 })
      ctx.scope.bind(card, {
        x: ctx.scope.map(smooth, [0, 1], [-travel(ctx), travel(ctx)]),
        rotate: ctx.scope.map(smooth, [0, 1], [-35, 35]),
        backgroundColor: ctx.scope.map(smooth, [0, 1], ['#dcf71d', '#e8b9d8']),
      })
      let side = true
      return {
        run() {
          side = !side
          return ctx.scope.animate(value, side ? 1 : 0, { duration: 900 })
        },
        adjust: (number) => value.set(number),
      }
    },
  },
  {
    id: 'physics',
    family: 'motion',
    title: ['Circle physics', 'Física de círculos', 'Física de círculos', '圆形物理'],
    hint: [
      'Catch a body, pull the tether, release the energy.',
      'Segure um corpo, puxe a mola, solte a energia.',
      'Atrapa un cuerpo, tira del muelle, suelta la energía.',
      '抓住圆球，拉动弹簧，释放能量。',
    ],
    guide: 'web-platforms#physics',
    apis: ['physicsWorld'],
    code: `const world = scope.physicsWorld(host, [\n  { id: 'a', view: ballA, radius: 22, x: 70, y: 85, drag: { type: 'spring' } },\n  { id: 'b', view: ballB, radius: 22, x: 160, y: 85, drag: 'direct' }\n], { gravity: { x: 0, y: 350 }, restitution: .75,\n  springs: [{ id: 'link', from: 'a', to: 'b', length: 90 }] })\nworld.impulse('a', { x: 180, y: -180 })`,
    mount(ctx) {
      const worldHost = element(ctx.host, 'div', 'lab-physics')
      const a = element(worldHost, 'div', 'lab-physics-ball', 'A'),
        b = element(worldHost, 'div', 'lab-physics-ball', 'B')
      const width = worldHost.clientWidth
      const world = ctx.scope.physicsWorld(
        worldHost,
        [
          {
            id: 'a',
            view: a,
            radius: 22,
            x: width * 0.3,
            y: 85,
            drag: { type: 'spring' },
          },
          { id: 'b', view: b, radius: 22, x: width * 0.7, y: 85, drag: 'direct' },
        ],
        {
          gravity: { x: 0, y: 350 },
          restitution: 0.75,
          springs: [
            {
              id: 'link',
              from: 'a',
              to: 'b',
              length: width * 0.4,
              line: { color: '#e8b9d8', width: 2 },
            },
          ],
        },
      )
      return {
        run: () => world.impulse('a', { x: 180, y: -180 }),
        actions: [action('reset-physics', resetWords, () => world.reset())],
      }
    },
  },
]
