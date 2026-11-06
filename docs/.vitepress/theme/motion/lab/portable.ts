import { portableDots, portableStyles } from '../../../../../demo/src/portable-recipe'
import { type Experiment, element } from './types'

export const portableExperiments: Experiment[] = [
  {
    id: 'property-group',
    family: 'motion',
    title: [
      'Properties together',
      'Propriedades juntas',
      'Propiedades juntas',
      '属性协调',
    ],
    hint: [
      'Three values, one animation. Drawing stops when they settle.',
      'Três valores, uma animação. O desenho para ao concluir.',
      'Tres valores, una animación. El dibujo se detiene al terminar.',
      '三个值，一次动画；结束后停止绘制。',
    ],
    guide: 'portable-foundations',
    apis: ['property', 'propertyGroup', 'renderActivity'],
    code: `const property = target => scope.property(target, {\n  name: 'chart/level', units: ['ratio'],\n  read: t => t.level, write: (t, n) => { t.level = n },\n  encode: n => [n], decode: values => values[0]\n})\nconst group = scope.propertyGroup({ a: property(a), b: property(b), c: property(c) })\nconst activity = scope.renderActivity({ change: renderContinuously, redraw: draw })\nactivity.track(group.animate({ a: .8, b: .4, c: 1 }, { duration: 1800 }))`,
    mount(ctx) {
      const canvas = element(ctx.host, 'canvas', 'lab-art-panel')
      canvas.width = 360
      canvas.height = 240
      canvas.setAttribute('role', 'img')
      canvas.setAttribute(
        'aria-label',
        ctx.t([
          'Three coordinated bars',
          'Três barras coordenadas',
          'Tres barras coordinadas',
          '三个协调条形',
        ]),
      )
      const painter = canvas.getContext('2d')!
      const values = [{ level: 0.1 }, { level: 0.1 }, { level: 0.1 }]
      const draw = () => {
        painter.clearRect(0, 0, 360, 240)
        values.forEach((value, i) => {
          painter.fillStyle = '#1c4936'
          painter.fillRect(20, 25 + i * 70, 320, 45)
          painter.fillStyle = '#dcf71d'
          painter.fillRect(20, 25 + i * 70, 320 * value.level, 45)
        })
      }
      const property = (target: { level: number }) =>
        ctx.scope.property(target, {
          name: 'chart/level',
          units: ['ratio'],
          read: (t) => (t as { level: number }).level,
          write: (t, n: number) => {
            ;(t as { level: number }).level = n
          },
          encode: (n) => [n],
          decode: (v) => v[0]!,
        })
      const group = ctx.scope.propertyGroup({
        a: property(values[0]!),
        b: property(values[1]!),
        c: property(values[2]!),
      })
      const window = canvas.ownerDocument.defaultView!
      let frame: number | undefined,
        phase = false
      const activity = ctx.scope.renderActivity({
        change(active) {
          if (frame !== undefined) window.cancelAnimationFrame(frame)
          frame = undefined
          ctx.report(
            ctx.t(
              active
                ? ['Drawing', 'Desenhando', 'Dibujando', '绘制中']
                : ['Idle', 'Em repouso', 'En reposo', '空闲'],
            ),
          )
          if (active) {
            const tick = () => {
              draw()
              frame = window.requestAnimationFrame(tick)
            }
            frame = window.requestAnimationFrame(tick)
          }
        },
        redraw: draw,
      })
      draw()
      return {
        run() {
          phase = !phase
          const motion = group.animate(
            phase ? { a: 0.8, b: 0.4, c: 1 } : { a: 0.25, b: 1, c: 0.5 },
            { duration: 1800, ease: 'linear' },
          )
          activity.track(motion)
          return motion
        },
      }
    },
  },
  {
    id: 'drawing-batch',
    family: 'effects',
    title: [
      'A drawing surface',
      'Uma superfície de desenho',
      'Una superficie de dibujo',
      '绘图表面',
    ],
    hint: [
      '259 dots share one drawing owner. Update a few, keep the rest.',
      '259 pontos no mesmo desenho. Mude alguns e preserve os outros.',
      '259 puntos en un dibujo. Cambia algunos y conserva el resto.',
      '259 个点共用一个绘图对象；局部更新，其余保留。',
    ],
    guide: 'portable-foundations',
    apis: ['drawBatch'],
    code: `const drawing = scope.drawBatch(host, {\n  viewBox: [0, 0, 760, 300], styles, items\n})\ndrawing.update(changedItems)\n// Static geometry; whole-host motion is independently owned.`,
    mount(ctx) {
      const art = element(ctx.host, 'div', 'lab-art-panel')
      const items = portableDots()
      const drawing = ctx.scope.drawBatch(art, {
        viewBox: [0, 0, 760, 300],
        styles: portableStyles,
        items,
      })
      let phase = false
      return {
        run() {
          phase = !phase
          drawing.update(
            items
              .filter((_, i) => i % 7 === 0)
              .map((item) => ({
                ...item,
                style: phase ? 'signal' : 'dots',
                ...(item.kind === 'circle' ? { radius: phase ? 8 : 4 } : {}),
              })),
          )
          return ctx.scope.animate(art, { scale: [1, 0.94, 1] }, { duration: 1000 })
        },
      }
    },
  },
]
