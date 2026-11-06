import type {
  WebGradient,
  WebImageEffect,
  WebLiquid,
  WebParticles,
} from '../../../../../src/web/public'
import { type Experiment, type LabContext, element, photo, action, onRun } from './types'

const intensity = {
  label: ['Intensity', 'Intensidade', 'Intensidad', '强度'] as const,
  min: 0,
  max: 1,
  step: 0.05,
  value: 0.5,
}
const panel = (ctx: LabContext) => element(ctx.host, 'div', 'lab-art-panel')
export const effectExperiments: Experiment[] = [
  {
    id: 'gradient',
    family: 'effects',
    title: ['Gradients', 'Gradientes', 'Gradientes', '渐变'],
    hint: [
      'Linear, radial, conic. Let the colors find each other.',
      'Linear, radial, cônico. Deixe as cores se encontrarem.',
      'Lineal, radial, cónico. Deja que los colores se encuentren.',
      '线性、径向、锥形，让色彩交汇。',
    ],
    guide: 'web-effects#gradients',
    apis: ['gradient'],
    code: `const gradient = scope.gradient(panel, {\n  type: 'linear', colors: ['#dcf71d', '#1c4936'], angle: 30\n})\ngradient.animate({ colors: ['#e8b9d8', '#5550a3'], angle: 210 },\n  { duration: 1400 })\n// type also accepts 'radial' and 'conic'.`,
    mount(ctx) {
      const art = panel(ctx)
      element(art, 'span', 'lab-art-word', 'jolt.')
      let gradient: WebGradient,
        shifted = false
      function attach(type: 'linear' | 'radial' | 'conic') {
        gradient?.dispose()
        gradient = ctx.scope.gradient(art, {
          type,
          colors: ['#dcf71d', '#1c4936'],
          angle: 30,
        })
        shifted = false
      }
      attach('linear')
      const run = () => {
        shifted = !shifted
        return gradient.animate(
          {
            colors: shifted ? ['#e8b9d8', '#5550a3'] : ['#dcf71d', '#1c4936'],
            angle: shifted ? 210 : 30,
          },
          { duration: 1400 },
        )
      }
      return {
        run,
        actions: (['linear', 'radial', 'conic'] as const).map((type, i) =>
          action(
            type,
            [
              ['Linear', 'Linear', 'Lineal', '线性'],
              ['Radial', 'Radial', 'Radial', '径向'],
              ['Conic', 'Cônico', 'Cónico', '锥形'],
            ][i]! as [string, string, string, string],
            () => {
              attach(type)
              run()
            },
          ),
        ),
      }
    },
  },
  {
    id: 'particles',
    family: 'effects',
    title: ['Particles', 'Partículas', 'Partículas', '粒子'],
    hint: [
      'A small atmosphere, made of moving light.',
      'Uma pequena atmosfera feita de luz em movimento.',
      'Una pequeña atmósfera hecha de luz en movimiento.',
      '用流动的光创造一片小天地。',
    ],
    guide: 'web-surfaces#particles',
    apis: ['particles'],
    code: `scope.particles(host, {\n  colors: ['#dcf71d', '#e8b9d8', '#b8d5fa'],\n  source: 'bottom', angle: -90, spread: 45,\n  rate: 45, size: 4, velocity: 100,\n  lifetime: 2400, duration: 3500\n})`,
    mount(ctx) {
      const art = panel(ctx)
      art.classList.add('lab-dark-art')
      element(art, 'span', 'lab-art-word', '✳︎')
      let effect: WebParticles | undefined
      return {
        run() {
          effect?.dispose()
          effect = ctx.scope.particles(art, {
            colors: ['#dcf71d', '#e8b9d8', '#b8d5fa'],
            source: 'bottom',
            angle: -90,
            spread: 45,
            rate: 45,
            size: 4,
            velocity: 100,
            lifetime: 2400,
            duration: 3500,
          })
        },
      }
    },
  },
  {
    id: 'confetti',
    family: 'effects',
    title: ['Confetti', 'Confete', 'Confeti', '彩纸'],
    hint: [
      'A little celebration, on demand.',
      'Uma pequena celebração quando você quiser.',
      'Una pequeña celebración cuando quieras.',
      '随时来一场小小庆祝。',
    ],
    guide: 'web-surfaces#particles',
    apis: ['confetti', 'press'],
    code: `scope.confetti(host, {\n  count: 90, colors: ['#dcf71d', '#e8b9d8', '#b8d5fa']\n})`,
    mount(ctx) {
      const art = panel(ctx)
      const button = element(art, 'button', 'lab-celebrate', '✳︎')
      button.setAttribute(
        'aria-label',
        ctx.t(['Celebrate', 'Comemorar', 'Celebrar', '庆祝']),
      )
      ctx.scope.press(button, { scale: 0.9 })
      let effect: WebParticles | undefined
      const run = () => {
        effect?.dispose()
        effect = ctx.scope.confetti(art, {
          count: 90,
          colors: ['#dcf71d', '#e8b9d8', '#b8d5fa'],
        })
      }
      onRun(ctx, button, run)
      return { run }
    },
  },
  {
    id: 'blur',
    family: 'effects',
    title: ['Blur', 'Desfoque', 'Desenfoque', '模糊'],
    hint: [
      'Soften the image, keep control of the intensity.',
      'Suavize a imagem e controle a intensidade.',
      'Suaviza la imagen y controla la intensidad.',
      '柔化图像，掌控强度。',
    ],
    guide: 'web-surfaces#blur',
    apis: ['blur'],
    parameter: intensity,
    code: `const blur = scope.blur(photo, { radius: 24, amount: 0 })\nblur.animate(.7, 'smooth')\nblur.set(.3)`,
    mount(ctx) {
      const art = panel(ctx),
        image = photo(ctx, art)
      const blur = ctx.scope.blur(image, { radius: 24, amount: 0 })
      let soft = false
      return {
        run() {
          soft = !soft
          return blur.animate(soft ? 0.7 : 0, 'smooth')
        },
        adjust: (value) => blur.set(value),
      }
    },
  },
  {
    id: 'glass',
    family: 'effects',
    title: ['Glass', 'Vidro', 'Cristal', '玻璃'],
    hint: [
      'A filtered backdrop. The button stays yours to press.',
      'O fundo se dissolve. O botão continua respondendo.',
      'El fondo se difumina. El botón sigue respondiendo.',
      '背景柔化，按钮依旧可用。',
    ],
    guide: 'web-parity#glass',
    apis: ['glass'],
    parameter: intensity,
    code: `const glass = scope.glass(panel, {\n  amount: .5, radius: 24, tint: 'rgba(20,30,25,.25)',\n  fallbackColor: '#253528'\n})\nglass.animate(1, { duration: 700 })\n// glass.snapshot().backend reports CSS filtering or solid fallback.`,
    mount(ctx) {
      const art = panel(ctx)
      photo(ctx, art)
      const surface = element(art, 'div', 'lab-glass-card')
      const button = element(surface, 'button', 'lab-glass-button', '＋')
      let count = 0
      button.setAttribute(
        'aria-label',
        ctx.t(['Add one', 'Somar um', 'Sumar uno', '加一']),
      )
      onRun(ctx, button, () => {
        count++
        button.textContent = String(count)
      })
      const glass = ctx.scope.glass(surface, {
        amount: 0.5,
        radius: 24,
        tint: 'rgba(20,30,25,.25)',
        fallbackColor: '#253528',
      })
      ctx.report(glass.snapshot().backend)
      let strong = false
      return {
        run() {
          strong = !strong
          return glass.animate(strong ? 1 : 0, { duration: 700 })
        },
        adjust: (value) => glass.set(value),
      }
    },
  },
  {
    id: 'shape',
    family: 'effects',
    title: ['Shape morphing', 'Morph de formas', 'Morph de formas', '形状变换'],
    hint: [
      'One outline, a completely different character.',
      'Um contorno, outra personalidade.',
      'Un contorno, otra personalidad.',
      '一条轮廓，另一种性格。',
    ],
    guide: 'web-surfaces#shape',
    apis: ['shape'],
    code: `const shape = scope.shape(host, {\n  viewBox: [0, 0, 100, 100],\n  d: 'M10 10 L90 10 L90 90 L10 90 Z',\n  fill: '#dcf71d', stroke: '#e8b9d8', strokeWidth: 2\n})\nshape.animate({ d: 'M50 0 L100 50 L50 100 L0 50 Z' }, 'bouncy')`,
    mount(ctx) {
      const art = element(ctx.host, 'div', 'lab-shape-host')
      const square = 'M10 10 L90 10 L90 90 L10 90 Z',
        diamond = 'M50 0 L100 50 L50 100 L0 50 Z'
      const shape = ctx.scope.shape(art, {
        viewBox: [0, 0, 100, 100],
        d: square,
        fill: '#dcf71d',
        stroke: '#e8b9d8',
        strokeWidth: 2,
      })
      let pointed = false
      return {
        run() {
          pointed = !pointed
          return shape.animate({ d: pointed ? diamond : square }, 'bouncy')
        },
      }
    },
  },
  {
    id: 'draw-path',
    family: 'effects',
    title: ['Draw a path', 'Desenhe um traçado', 'Dibuja un trazado', '绘制路径'],
    hint: [
      'Draw, erase, reverse before the ink arrives.',
      'Desenhe, apague, reverta antes de terminar.',
      'Dibuja, borra, invierte antes de terminar.',
      '绘制、擦除，在完成前反向。',
    ],
    guide: 'web-orchestration#svg',
    apis: ['drawPath'],
    code: `const drawing = scope.drawPath(path, { progress: 0 })\ndrawing.animate(1, { duration: 1400, ease: 'easeInOut' })\n// Interrupt with drawing.animate(0, 'smooth').`,
    mount(ctx) {
      const svg = ctx.host.ownerDocument.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg',
      )
      svg.setAttribute('viewBox', '0 0 320 140')
      svg.classList.add('lab-wave')
      const path = ctx.host.ownerDocument.createElementNS(
        svg.namespaceURI,
        'path',
      ) as SVGPathElement
      path.setAttribute(
        'd',
        'M10 70 H65 L85 55 L105 80 L130 15 L155 125 L180 60 L205 70 H310',
      )
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', '#dcf71d')
      path.setAttribute('stroke-width', '3')
      path.setAttribute('stroke-linecap', 'round')
      svg.append(path)
      ctx.host.append(svg)
      const drawing = ctx.scope.drawPath(path, { progress: 0 })
      let full = false
      return {
        run() {
          full = !full
          return ctx.scope.add(
            drawing.animate(full ? 1 : 0, { duration: 1400, ease: 'easeInOut' }),
          )
        },
      }
    },
  },
  {
    id: 'liquid',
    family: 'effects',
    title: ['Liquid image', 'Imagem líquida', 'Imagen líquida', '液态图像'],
    hint: [
      'A still landscape starts to flow.',
      'Uma paisagem parada começa a fluir.',
      'Un paisaje quieto empieza a fluir.',
      '静止的风景开始流动。',
    ],
    guide: 'web-surfaces#liquid',
    apis: ['liquid'],
    code: `await photo.decode()\nconst liquid = scope.liquid(photo, { intensity: .8 })\nliquid.pause()\nliquid.resume()`,
    mount(ctx) {
      const art = panel(ctx),
        image = photo(ctx, art)
      let effect: WebLiquid | undefined
      return {
        async run() {
          await image.decode()
          if (!ctx.alive()) return
          effect?.dispose()
          effect = ctx.scope.liquid(image, { intensity: 0.8 })
        },
      }
    },
  },
  {
    id: 'image-effects',
    family: 'effects',
    title: ['Image effects', 'Efeitos de imagem', 'Efectos de imagen', '图像效果'],
    hint: [
      'Ripple, distortion and dissolve. Same image, new feeling.',
      'Onda, distorção e dissolução. Outra sensação na mesma imagem.',
      'Onda, distorsión y disolución. Otra sensación en la misma imagen.',
      '涟漪、扭曲、溶解，同一图像，不同感受。',
    ],
    guide: 'web-surfaces#image',
    apis: ['imageEffect'],
    code: `await Promise.all([photo.decode(), nextPhoto.decode()])\nscope.imageEffect(photo, 'ripple', { duration: 1400 })\n// Also: 'distortion', or 'dissolve' with { to: nextPhoto }.`,
    mount(ctx) {
      const art = panel(ctx),
        image = photo(ctx, art),
        next = photo(ctx, art, true)
      next.classList.add('lab-image-destination')
      next.alt = ''
      let effect: WebImageEffect | undefined
      let type: 'ripple' | 'distortion' | 'dissolve' = 'ripple'
      const run = async () => {
        await Promise.all([image.decode(), next.decode()])
        if (!ctx.alive()) return
        effect?.dispose()
        effect = ctx.scope.imageEffect(image, type, {
          duration: 1400,
          ...(type === 'dissolve' ? { to: next } : {}),
        })
        ctx.report(effect.diagnostics.backend)
      }
      return {
        run,
        actions: [
          action('ripple', ['Ripple', 'Onda', 'Onda', '涟漪'], () => {
            type = 'ripple'
            return run()
          }),
          action('distortion', ['Distortion', 'Distorção', 'Distorsión', '扭曲'], () => {
            type = 'distortion'
            return run()
          }),
          action('dissolve', ['Dissolve', 'Dissolução', 'Disolución', '溶解'], () => {
            type = 'dissolve'
            return run()
          }),
        ],
      }
    },
  },
  {
    id: 'reveal',
    family: 'effects',
    title: ['Circular reveal', 'Revelação circular', 'Revelado circular', '圆形揭示'],
    hint: [
      'Let a new scene grow from a single point.',
      'Deixe uma nova cena nascer de um ponto.',
      'Deja que una escena nazca de un punto.',
      '让新场景从一个点生长。',
    ],
    guide: 'web-effects#reveal',
    apis: ['reveal', 'conceal'],
    code: `scope.conceal(panel, { to: { x: 32, y: 32 }, duration: 850 })\n// Reverse from the current circle:\nscope.reveal(panel, { from: { x: 32, y: 32 }, duration: 850 })`,
    mount(ctx) {
      const art = panel(ctx)
      photo(ctx, art)
      let shown = true
      return {
        run() {
          shown = !shown
          return shown
            ? ctx.scope.reveal(art, { from: { x: 32, y: 32 }, duration: 850 })
            : ctx.scope.conceal(art, { to: { x: 32, y: 32 }, duration: 850 })
        },
      }
    },
  },
  {
    id: 'shimmer',
    family: 'effects',
    title: ['Shimmer', 'Shimmer', 'Shimmer', '微光'],
    hint: [
      'Make the wait feel considered.',
      'Faça a espera parecer parte da experiência.',
      'Haz que la espera forme parte de la experiencia.',
      '让等待也成为体验的一部分。',
    ],
    guide: 'web-effects#loading',
    apis: ['shimmer'],
    code: `const shimmer = scope.shimmer(placeholder, { duration: 1500 })\nshimmer.pause()\nshimmer.play()`,
    mount(ctx) {
      const skeleton = element(ctx.host, 'div', 'lab-skeleton')
      for (let i = 0; i < 4; i++) element(skeleton, 'div', 'lab-skeleton-line')
      skeleton.setAttribute(
        'aria-label',
        ctx.t([
          'Loading preview',
          'Prévia de carregamento',
          'Vista de carga',
          '加载预览',
        ]),
      )
      const shimmer = ctx.scope.shimmer(skeleton, { duration: 1500 })
      return { run: () => shimmer.play() }
    },
  },
  {
    id: 'loaders',
    family: 'effects',
    title: ['Loaders', 'Indicadores', 'Indicadores', '加载指示器'],
    hint: [
      'Dots, bars, a ring. A rhythm for every wait.',
      'Pontos, barras, um anel. Um ritmo para cada espera.',
      'Puntos, barras, un anillo. Un ritmo para cada espera.',
      '圆点、条形、圆环，为每次等待赋予节奏。',
    ],
    guide: 'web-effects#loading',
    apis: ['loader'],
    code: `for (const [host, style] of loaders) {\n  scope.loader(host, { style, size: 52, color: '#dcf71d' })\n}\n// style: 'dots' | 'bars' | 'ring'`,
    mount(ctx) {
      const row = element(ctx.host, 'div', 'lab-loaders')
      const effects = (['dots', 'bars', 'ring'] as const).map((style) => {
        const slot = element(row, 'div', 'lab-loader-slot')
        slot.setAttribute('aria-label', style)
        return ctx.scope.loader(slot, { style, size: 52, color: '#dcf71d' })
      })
      return { run: () => effects.forEach((effect) => effect.play()) }
    },
  },
]
