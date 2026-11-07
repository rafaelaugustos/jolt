import { action, element, tile, type Experiment } from './types'

export const interactionExperiments: Experiment[] = [
  {
    id: 'drop-zones',
    family: 'touch',
    guide: 'interaction-depth',
    apis: ['dropZones'],
    title: ['Drop targets', 'Alvos de soltura', 'Destinos de arrastre', '放置目标'],
    hint: [
      'Drag or accept with the button.',
      'Arraste ou aceite pelo botão.',
      'Arrastra o acepta con el botón.',
      '拖动，或使用按钮接受。',
    ],
    code: `const drop = scope.dropZones(card, {\n  targets: [{ id: 'accept', target: zone }],\n  onDrop: () => scope.animate(card, { scale: [1, .7, 1] })\n})\n// Accessible alternative:\ndrop.request('accept')`,
    mount(ctx) {
      const row = element(ctx.host, 'div', '')
      row.style.cssText = 'width:100%;height:220px;position:relative'
      const zone = element(
        row,
        'div',
        '',
        ctx.t(['Accept', 'Aceitar', 'Aceptar', '接受']),
      )
      zone.style.cssText =
        'position:absolute;right:12px;top:20px;width:110px;height:100px;border:2px dashed #5f8e6d;display:grid;place-items:center;border-radius:20px'
      const card = element(row, 'button', 'lab-tile lab-object', '↗')
      card.type = 'button'
      card.style.cssText = 'position:absolute;left:12px;top:110px;touch-action:none'
      const drop = ctx.scope.dropZones(card, {
        targets: [{ id: 'accept', target: zone }],
        drag: { snap: [0] },
        onEnter: () => {
          zone.style.background = '#5f8e6d33'
        },
        onLeave: () => {
          zone.style.background = ''
        },
        onDrop: () => {
          ctx.report(
            ctx.t(['Accepted once', 'Aceito uma vez', 'Aceptado una vez', '已接受一次']),
          )
          return ctx.scope.animate(card, { scale: [1, 0.7, 1] }, { duration: 700 })
        },
      })
      return { run: () => drop.request('accept') }
    },
  },
  {
    id: 'timeline-cues',
    family: 'motion',
    guide: 'interaction-depth',
    apis: ['withTimelineCues'],
    title: [
      'Named timeline cues',
      'Eventos na timeline',
      'Eventos en la timeline',
      '时间线命名事件',
    ],
    hint: [
      'Two markers; seeking does not fire effects.',
      'Dois marcadores; buscar não dispara efeitos.',
      'Dos marcadores; buscar no dispara efectos.',
      '两个标记；定位不会触发效果。',
    ],
    code: `const animation = scope.animate(card, { x: [0, 90, 0] }, { duration: 2000 })\nconst cues = scope.withTimelineCues(animation, [\n  { name: 'impact', at: 500, effect: () => flash() },\n  { name: 'rest', at: 1500, effect: () => flash() }\n])\ncues.progress = .7 // no side effects while seeking`,
    mount(ctx) {
      const card = tile(ctx),
        marker = element(ctx.host, 'span', '', '·')
      let current: ReturnType<typeof ctx.scope.withTimelineCues> | undefined
      return {
        run() {
          current?.dispose()
          const visual = ctx.scope.animate(card, { x: [0, 90, 0] }, { duration: 2000 })
          current = ctx.scope.withTimelineCues(
            visual,
            ['impact', 'rest'].map((name, i) => ({
              name,
              at: 500 + i * 1000,
              effect() {
                marker.textContent = name
                return ctx.scope.animate(
                  marker,
                  { opacity: [1, 0.2, 1], scale: [1, 1.2, 1] },
                  { duration: 400 },
                )
              },
            })),
          )
        },
        actions: [
          action('seek', ['Seek 70%', 'Buscar 70%', 'Buscar 70%', '定位到 70%'], () => {
            if (current) current.progress = 0.7
          }),
        ],
      }
    },
  },
  {
    id: 'motion-path',
    family: 'motion',
    guide: 'interaction-depth',
    apis: ['animate'],
    title: ['Follow a path', 'Seguir um caminho', 'Seguir una ruta', '沿路径移动'],
    hint: [
      'Local coordinates and tangent orientation.',
      'Coordenadas locais e orientação pela tangente.',
      'Coordenadas locales y orientación tangente.',
      '局部坐标与切线方向。',
    ],
    code: `scope.animate(card, { path: 'M0 0 C40 -90 120 90 160 0', orient: true }, { duration: 2400 })`,
    mount(ctx) {
      const card = tile(ctx)
      card.style.marginLeft = '-130px'
      return {
        run: () =>
          ctx.scope.animate(
            card,
            { path: 'M0 0 C40 -90 120 90 160 0', orient: true },
            { duration: 2400 },
          ),
      }
    },
  },
  {
    id: 'rotate-3d',
    family: 'motion',
    guide: 'interaction-depth',
    apis: ['animate'],
    title: ['Rotate in 3D', 'Girar em 3D', 'Girar en 3D', '三维旋转'],
    hint: [
      'The parent supplies CSS perspective.',
      'O pai define a perspectiva CSS.',
      'El padre define la perspectiva CSS.',
      '父元素提供 CSS 透视。',
    ],
    code: `parent.style.perspective = '700px'\nscope.animate(card, { rotateX: 55, rotateY: -40, rotate: 12 }, { duration: 1600 })`,
    mount(ctx) {
      const parent = element(ctx.host, 'div', '')
      parent.style.perspective = '700px'
      const card = tile({ ...ctx, host: parent })
      let phase = false
      return {
        run() {
          phase = !phase
          return ctx.scope.animate(
            card,
            {
              rotateX: phase ? 55 : -35,
              rotateY: phase ? -40 : 30,
              rotate: phase ? 12 : 0,
            },
            { duration: 1600 },
          )
        },
      }
    },
  },
  {
    id: 'shadow-channels',
    family: 'effects',
    guide: 'interaction-depth',
    apis: ['animate'],
    title: ['Move the shadow', 'Mover a sombra', 'Mover la sombra', '阴影动画'],
    hint: [
      'One outer shadow; signed offsets and coordinated color.',
      'Uma sombra externa; offsets com sinal e cor coordenada.',
      'Una sombra exterior; desplazamientos con signo y color coordinado.',
      '单个外阴影；有符号偏移与协调颜色。',
    ],
    code: `card.style.boxShadow = '0 4px 8px rgba(0,0,0,.2)'\nscope.animate(card, { shadowOpacity: .7, shadowRadius: 18, shadowOffsetX: -12, shadowOffsetY: 22 }, { duration: 1600 })`,
    mount(ctx) {
      const card = tile(ctx)
      card.style.boxShadow = '0 4px 8px rgba(0,0,0,.2)'
      let phase = false
      return {
        run() {
          phase = !phase
          return ctx.scope.animate(
            card,
            {
              shadowOpacity: phase ? 0.7 : 0.2,
              shadowRadius: phase ? 18 : 4,
              shadowOffsetX: phase ? -12 : 0,
              shadowOffsetY: phase ? 22 : 4,
            },
            { duration: 1600 },
          )
        },
      }
    },
  },
]
