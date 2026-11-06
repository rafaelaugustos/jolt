import type { WebZoomable } from '../../../../../src/web/public'
import {
  type Experiment,
  tile,
  travel,
  element,
  action,
  resetWords,
  photo,
} from './types'

export const touchExperiments: Experiment[] = [
  {
    id: 'press',
    family: 'touch',
    title: [
      'Press feedback',
      'Resposta ao pressionar',
      'Respuesta al pulsar',
      '按压反馈',
    ],
    hint: [
      'Hold, release, slide outside. Space and Enter work too.',
      'Segure, solte, saia do botão. Espaço e Enter também funcionam.',
      'Mantén, suelta, sal del botón. Espacio y Enter también funcionan.',
      '按住、松开、移出按钮，也支持空格与回车。',
    ],
    guide: 'web-press',
    apis: ['press'],
    manual: true,
    runLabel: ['Focus button', 'Focar o botão', 'Enfocar botón', '聚焦按钮'],
    code: `scope.press(button, { scale: .88, rotate: -6 },\n  { transition: 'bouncy' })`,
    mount(ctx) {
      const card = tile(ctx, '↓')
      ctx.scope.press(card, { scale: 0.88, rotate: -6 }, { transition: 'bouncy' })
      return { run: () => card.focus({ preventScroll: true }) }
    },
  },
  ...(['drag', 'inertia'] as const).map((id): Experiment => ({
    id,
    family: 'touch',
    title:
      id === 'drag'
        ? ['Drag & snap', 'Arraste e snap', 'Arrastre y snap', '拖动与吸附']
        : ['Inertial drag', 'Arraste com inércia', 'Arrastre con inercia', '惯性拖动'],
    hint:
      id === 'drag'
        ? ['Drag it. Let go.', 'Arraste. Solte.', 'Arrastra. Suelta.', '拖动，然后松手。']
        : [
            'Throw it toward a stop. Catch it while it moves.',
            'Lance até uma parada. Segure enquanto se move.',
            'Lánzalo a una parada. Atrápalo en movimiento.',
            '甩向停点，在移动中再次抓住。',
          ],
    guide: id === 'drag' ? 'web-dynamic#drag' : 'web-gestures#drag',
    apis: ['drag', 'set'],
    runLabel: resetWords,
    code:
      id === 'drag'
        ? `scope.drag(card, {\n  bounds: { left: -100, right: 100, top: -65, bottom: 65 },\n  snap: { x: [0], y: [0] }, rubberband: true,\n  spring: { bounce: .4, duration: 650 }\n})`
        : `scope.drag(card, {\n  axis: 'x', release: 'decay', friction: .994,\n  bounds: { left: -100, right: 100 },\n  snap: { x: [-100, 0, 100] }, rubberband: true\n})`,
    mount(ctx) {
      const card = tile(ctx)
      card.classList.add('draggable')
      const d = travel(ctx)
      const options =
        id === 'drag'
          ? {
              bounds: { left: -d, right: d, top: -65, bottom: 65 },
              snap: { x: [0], y: [0] },
              spring: { bounce: 0.4, duration: 650 },
              rubberband: true,
            }
          : {
              axis: 'x' as const,
              release: 'decay' as const,
              friction: 0.994,
              bounds: { left: -d, right: d },
              snap: { x: [-d, 0, d] },
              rubberband: true,
            }
      let drag = ctx.scope.drag(card, options)
      return {
        run() {
          drag.dispose()
          ctx.scope.set(card, { x: 0, y: 0 })
          drag = ctx.scope.drag(card, options)
        },
      }
    },
  })),
  {
    id: 'gestures',
    family: 'touch',
    title: [
      'Pan, pinch & rotate',
      'Pan, pinça e rotação',
      'Pan, pinza y rotación',
      '平移、缩放与旋转',
    ],
    hint: [
      'Drag with one contact. Pinch and rotate with two.',
      'Arraste com um contato. Use dois para pinça e rotação.',
      'Arrastra con un contacto. Usa dos para pinza y rotación.',
      '单指拖动，双指缩放与旋转。',
    ],
    guide: 'web-gestures#contacts',
    apis: ['gestures', 'bind'],
    runLabel: resetWords,
    code: `const gesture = scope.gestures(surface, {\n  pan: { bounds: { left: -100, right: 100, top: -80, bottom: 80 } },\n  pinch: { min: .6, max: 2 }, rotate: true\n})\nscope.bind(card, { x: gesture.x, y: gesture.y,\n  scale: gesture.scale, rotate: gesture.rotate })`,
    mount(ctx) {
      const card = element(ctx.host, 'div', 'lab-tile lab-object', '✳︎')
      const gesture = ctx.scope.gestures(ctx.host, {
        pan: { bounds: { left: -travel(ctx), right: travel(ctx), top: -80, bottom: 80 } },
        pinch: { min: 0.6, max: 2 },
        rotate: true,
      })
      ctx.scope.bind(card, {
        x: gesture.x,
        y: gesture.y,
        scale: gesture.scale,
        rotate: gesture.rotate,
      })
      return {
        run: () => gesture.settleTo({ x: 0, y: 0, scale: 1, rotate: 0 }),
        actions: [
          action('rotate', ['Rotate', 'Girar', 'Girar', '旋转'], () =>
            gesture.settleTo({ rotate: gesture.position.rotate + 45 }),
          ),
          action('scale', ['Zoom', 'Ampliar', 'Ampliar', '缩放'], () =>
            gesture.settleTo({ scale: gesture.position.scale > 1 ? 1 : 1.6 }),
          ),
        ],
      }
    },
  },
  {
    id: 'pointer',
    family: 'touch',
    title: ['Pointer follow', 'Siga o ponteiro', 'Sigue el puntero', '跟随指针'],
    hint: [
      'Move inside the stage. Leave to let it settle.',
      'Mova dentro da área. Saia para deixar acomodar.',
      'Muévete dentro del área. Sal para dejarlo reposar.',
      '在区域内移动，离开后回到原位。',
    ],
    guide: 'web-lifecycle#pointer',
    apis: ['pointerFollow', 'bind', 'observeGeometry', 'refresh'],
    runLabel: resetWords,
    code: `const pointer = scope.pointerFollow(region, {\n  range: { x: [-90, 90], y: [-60, 60] },\n  spring: { stiffness: 160, damping: 18 }\n})\nscope.bind(card, { x: pointer.x, y: pointer.y })\nscope.observeGeometry(card)`,
    mount(ctx) {
      const card = element(ctx.host, 'div', 'lab-tile lab-object', '↗')
      const pointer = ctx.scope.pointerFollow(ctx.host, {
        range: { x: [-travel(ctx), travel(ctx)], y: [-60, 60] },
        spring: { stiffness: 160, damping: 18 },
      })
      ctx.scope.bind(card, { x: pointer.x, y: pointer.y })
      ctx.scope.observeGeometry(card)
      ctx.motion.refresh(card)
      return {
        run() {
          pointer.update({ disabled: true })
          pointer.update({ disabled: false })
        },
      }
    },
  },
  {
    id: 'zoom',
    family: 'touch',
    title: ['Photo zoom', 'Zoom de imagem', 'Zoom de imagen', '图片缩放'],
    hint: [
      'Double tap, pinch, pan. Keep the point under your fingers.',
      'Toque duas vezes, use pinça, arraste. Mantenha o ponto sob os dedos.',
      'Doble toque, pinza, arrastre. Mantén el punto bajo tus dedos.',
      '双击、缩放、拖动，保持手指下的焦点。',
    ],
    guide: 'web-gestures#zoom',
    apis: ['zoomable'],
    runLabel: ['Zoom', 'Ampliar', 'Ampliar', '缩放'],
    code: `await photo.decode()\nconst zoom = scope.zoomable(photo, {\n  viewport, scale: [1, 4], doubleTap: 2.5, dismiss: false\n})\nzoom.zoomTo(2.5)\n// zoom.reset()`,
    mount(ctx) {
      const viewport = element(ctx.host, 'div', 'lab-zoom')
      const image = photo(ctx, viewport)
      let zoom: WebZoomable | undefined
      const ready = image.decode().then(() => {
        if (ctx.alive())
          zoom = ctx.scope.zoomable(image, {
            viewport,
            scale: [1, 4],
            doubleTap: 2.5,
            dismiss: false,
          })
      })
      ready.catch((error) => {
        if (ctx.alive()) ctx.report(String(error))
      })
      return {
        async run() {
          await ready
          if (ctx.alive()) zoom?.zoomTo(zoom.state.scale > 1 ? 1 : 2.5)
        },
        actions: [action('reset-zoom', resetWords, () => zoom?.reset())],
      }
    },
  },
  {
    id: 'reorder',
    family: 'touch',
    title: ['Reorder', 'Reordenar', 'Reordenar', '重新排序'],
    hint: [
      'Grab a handle. Or use Space, arrows and Enter.',
      'Segure pela alça. Ou use Espaço, setas e Enter.',
      'Toma un asa. O usa Espacio, flechas y Enter.',
      '抓住把手，或使用空格、方向键与回车。',
    ],
    guide: 'web-gestures#reorder',
    apis: ['reorder'],
    runLabel: ['Move first down', 'Descer o primeiro', 'Bajar el primero', '下移首项'],
    code: `scope.reorder(list, {\n  items: () => rows.map(row => ({ key: row.id, target: row.element })),\n  handle: '[data-reorder-handle]',\n  onCommit: ({ key, beforeKey }) => moveItemBefore(key, beforeKey)\n})`,
    mount(ctx) {
      const list = element(ctx.host, 'div', 'lab-list')
      const rows = ['01', '02', '03', '04'].map((key) => {
        const row = element(list, 'div', 'lab-list-row')
        row.dataset.key = key
        const handle = element(row, 'button', 'lab-grab', '⠿')
        handle.dataset.reorderHandle = ''
        handle.setAttribute(
          'aria-label',
          ctx.t(['Move item ', 'Mover item ', 'Mover elemento ', '移动项目 ']) + key,
        )
        element(row, 'span', '', ctx.t(['Track ', 'Faixa ', 'Pista ', '音轨 ']) + key)
        return { key, target: row }
      })
      const reorder = ctx.scope.reorder(list, {
        items: () => rows,
        handle: '[data-reorder-handle]',
        onCommit: ({ fromIndex, toIndex }) => {
          const moved = rows.splice(fromIndex, 1)[0]!
          rows.splice(toIndex, 0, moved)
          list.append(...rows.map((row) => row.target))
        },
        accessibility: {
          label: (key) => ctx.t(['Track ', 'Faixa ', 'Pista ', '音轨 ']) + key,
        },
      })
      return { run: () => reorder.moveDown(rows[0]!.key) }
    },
  },
]
