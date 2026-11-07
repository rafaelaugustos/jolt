import { companionRig } from '../../../../../demo/src/composition-recipe'
import { cubicBezier } from '../../../../../src/web/public'
import { type Experiment, element, tile, action } from './types'

export const compositionExperiments: Experiment[] = [
  {
    id: 'motion-behaviors',
    family: 'motion',
    title: [
      'Actions with priorities',
      'Ações com prioridades',
      'Acciones con prioridades',
      '动作优先级',
    ],
    hint: [
      'A stronger action interrupts the current one, then returns to rest.',
      'Uma ação prioritária interrompe a atual e volta ao repouso.',
      'Una acción prioritaria interrumpe la actual y vuelve al reposo.',
      '高优先级动作打断当前动作，完成后回到静止状态。',
    ],
    guide: 'portable-composition#behaviors',
    apis: ['motionBehaviors'],
    code: `const actions = scope.motionBehaviors({\n  rest: { priority: -1, run: ({ scope }) => scope.animate(card, { x: 0 }).finished },\n  touch: { run: ({ scope }) => scope.animate(card, { x: -70 }, { duration: 2000 }).finished },\n  dress: { priority: 2, run: ({ scope }) => scope.animate(card, { x: 70 }).finished }\n}, { rest: 'rest' })\nactions.request('touch')\nactions.request('dress')`,
    mount(ctx) {
      const card = tile(ctx, '✦')
      const actions = ctx.scope.motionBehaviors(
        {
          rest: {
            priority: -1,
            run: ({ scope }) =>
              scope.animate(card, { x: 0, rotate: 0 }, { duration: 600 }).finished,
          },
          touch: {
            run: ({ scope }) =>
              scope.animate(card, { x: -70, rotate: -25 }, { duration: 2000 }).finished,
          },
          dress: {
            priority: 2,
            run: ({ scope }) =>
              scope.animate(card, { x: 70, rotate: 25 }, { duration: 1500 }).finished,
          },
        },
        { rest: 'rest' },
      )
      return {
        run: () => actions.request('touch'),
        actions: [
          action('interrupt', ['Interrupt', 'Interromper', 'Interrumpir', '打断'], () =>
            actions.request('dress'),
          ),
        ],
      }
    },
  },
  {
    id: 'gradient-text',
    family: 'type',
    title: ['Light through letters', 'Luz nas letras', 'Luz en las letras', '文字流光'],
    hint: [
      'Selectable text with a gradient and a moving sheen.',
      'Texto selecionável com gradiente e brilho em movimento.',
      'Texto seleccionable con degradado y brillo en movimiento.',
      '可选择的文字，搭配渐变和流动高光。',
    ],
    guide: 'portable-composition#gradient-text',
    apis: ['gradientText'],
    code: `const title = scope.gradientText(element, {\n  colors: ['#7858db', '#197a88'], sheen: { width: .3 }\n})\ntitle.play({ duration: 1800 })`,
    mount(ctx) {
      const target = element(
        ctx.host,
        'h3',
        'lab-composition-title',
        ctx.t(['Made to move', 'Feito para mover', 'Hecho para moverse', '为动效而生']),
      )
      const title = ctx.scope.gradientText(target, {
        colors: ['#7858db', '#197a88'],
        sheen: { width: 0.3 },
      })
      return {
        run: () => title.play({ duration: 1800 }),
        actions: [
          action('pause', ['Pause', 'Pausar', 'Pausar', '暂停'], () => title.suspend()),
          action('resume', ['Resume', 'Retomar', 'Reanudar', '继续'], () =>
            title.resume(),
          ),
        ],
      }
    },
  },
  {
    id: 'rig-2d',
    family: 'motion',
    title: ['Poses and sockets', 'Poses e encaixes', 'Poses y anclajes', '姿态与挂点'],
    hint: [
      'A shared pose recipe keeps the flower in the character’s hand.',
      'Uma receita de poses mantém a flor na mão do personagem.',
      'Una receta de poses mantiene la flor en la mano del personaje.',
      '共用姿态定义，让花朵跟随角色的手部。',
    ],
    guide: 'portable-composition#rig',
    apis: ['rig2d'],
    code: `const character = scope.rig2d(definition, { body, head, hand })\ncharacter.accessory('grip', flower)\ncharacter.to('wave', 'bouncy')\ncharacter.blend([{ pose: 'wave', weight: .5 }, { pose: 'reach', weight: .5 }])`,
    mount(ctx) {
      const stage = element(ctx.host, 'div', 'lab-composition-rig')
      const body = element(stage, 'div', 'lab-rig-body'),
        head = element(body, 'div', 'lab-rig-head', '•ᴗ•'),
        hand = element(body, 'div', 'lab-rig-hand'),
        flower = element(hand, 'div', 'lab-rig-flower', '✿')
      const rig = ctx.scope.rig2d(companionRig, { body, head, hand })
      rig.accessory('grip', flower)
      let wave = false
      return {
        run: () => {
          wave = !wave
          return rig.to(wave ? 'wave' : 'reach', 'bouncy')
        },
        actions: [
          action('blend', ['Blend', 'Misturar', 'Mezclar', '混合'], () =>
            rig.blend([
              { pose: 'wave', weight: 0.5 },
              { pose: 'reach', weight: 0.5 },
            ]),
          ),
        ],
      }
    },
  },
  {
    id: 'motion-preferences',
    family: 'device',
    title: [
      'Motion preferences',
      'Preferências de movimento',
      'Preferencias de movimiento',
      '动态效果偏好',
    ],
    hint: [
      'The curve follows this runtime’s effective motion preference.',
      'A curva respeita a preferência efetiva deste runtime.',
      'La curva respeta la preferencia efectiva de este runtime.',
      '曲线动画遵循当前运行时的有效动态效果偏好。',
    ],
    guide: 'portable-composition#preferences',
    apis: ['reducedMotion', 'onReducedMotion'],
    code: `const reduced = motion.reducedMotion()\nscope.retain(motion.onReducedMotion(update))\nscope.animate(card, { x: [-70, 70, 0] }, {\n  duration: 1800, ease: cubicBezier(.25, .1, .25, 1)\n})`,
    mount(ctx) {
      const card = tile(ctx, '✧')
      const update = (reduced: boolean) =>
        ctx.report(
          ctx.t(
            reduced
              ? [
                  'Reduced motion',
                  'Movimento reduzido',
                  'Movimiento reducido',
                  '减少动态效果',
                ]
              : [
                  'Full motion',
                  'Movimento completo',
                  'Movimiento completo',
                  '完整动态效果',
                ],
          ),
        )
      ctx.scope.retain(ctx.motion.onReducedMotion(update))
      update(ctx.motion.reducedMotion())
      return {
        run: () =>
          ctx.scope.animate(
            card,
            { x: [-70, 70, 0] },
            { duration: 1800, ease: cubicBezier(0.25, 0.1, 0.25, 1) },
          ),
      }
    },
  },
]
