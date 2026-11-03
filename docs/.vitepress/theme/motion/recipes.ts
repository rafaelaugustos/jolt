import type { Words } from './copy'

export type Category = 'Motion' | 'Touch' | 'Visual' | 'Type' | 'Layout'
export interface Recipe {
  slug: string
  title: Words
  description: Words
  category: Category
  video: string
  guide: string
  source: string
  color: string
  platform: string
  caption: Words
}
const ios: Words = [
  'iOS 26 simulator · native playback with actual XCTest input, original speed. Not a physical-device performance measurement.',
  'Simulador iOS 26 · execução nativa com interação real via XCTest, velocidade original. Não é uma medição em aparelho físico.',
  'Simulador iOS 26 · ejecución nativa con interacción real vía XCTest, velocidad original. No mide el rendimiento de un dispositivo físico.',
  'iOS 26 模拟器 · 真实 XCTest 输入与原生播放，原始速度。并非真机性能测试。',
]
const revealCaption = ios.map(
  (caption, i) =>
    caption +
    [
      ' The app selects a 1600 ms reveal.',
      ' O app seleciona uma revelação de 1600 ms.',
      ' La app selecciona una revelación de 1600 ms.',
      ' 应用内选择了 1600 毫秒的揭示时长。',
    ][i],
) as unknown as Words
export const categoryNames: Record<Category, Words> = {
  Motion: ['Motion', 'Movimento', 'Movimiento', '运动'],
  Touch: ['Touch & gestures', 'Toque e gestos', 'Toque y gestos', '触控与手势'],
  Visual: ['Visual effects', 'Efeitos visuais', 'Efectos visuales', '视觉效果'],
  Type: ['Typography', 'Tipografia', 'Tipografía', '文字'],
  Layout: ['Layout', 'Layout', 'Layout', '布局'],
}
export const recipes: Recipe[] = [
  {
    slug: 'spring-feeling',
    title: [
      'A spring with feeling.',
      'Uma spring com personalidade.',
      'Un resorte con personalidad.',
      '有生命力的弹簧。',
    ],
    description: [
      'Interrupt it. Change direction. Keep the momentum.',
      'Interrompa. Mude a direção. Preserve o impulso.',
      'Interrumpe. Cambia de dirección. Conserva el impulso.',
      '随时打断、改变方向，动量依然流畅。',
    ],
    category: 'Motion',
    video: 'showcase-springs-ios',
    guide: 'transitions',
    source: 'showcase/MotionStudio.vue',
    color: '#d5ef8a',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'press-feedback',
    title: [
      'Made to be pressed.',
      'Feito para apertar.',
      'Hecho para pulsar.',
      '为触碰而生。',
    ],
    description: [
      'A little resistance. A satisfying release.',
      'Uma leve resistência. Uma resposta que dá gosto.',
      'Un poco de resistencia. Una respuesta que se siente bien.',
      '轻轻按下，感受恰到好处的回弹。',
    ],
    category: 'Touch',
    video: 'motion-recipe-press-ios',
    guide: 'press',
    source: 'components/Press.vue',
    color: '#ded3fc',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'drag-and-snap',
    title: [
      'Let it find its place.',
      'Deixe encontrar seu lugar.',
      'Que encuentre su lugar.',
      '找到它的位置。',
    ],
    description: [
      'Drag, release and settle into the next snap point.',
      'Arraste, solte e encaixe no próximo ponto.',
      'Arrastra, suelta y encaja en el siguiente punto.',
      '拖动、松手，自然吸附到下一个位置。',
    ],
    category: 'Touch',
    video: 'motion-recipe-drag-ios',
    guide: 'drag',
    source: 'components/DragLab.vue',
    color: '#f2ba9c',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'stagger',
    title: [
      'A beautiful ripple.',
      'Uma onda de movimento.',
      'Una onda de movimiento.',
      '层层涟漪。',
    ],
    description: [
      'One entrance becomes a whole choreography.',
      'Uma entrada vira uma coreografia inteira.',
      'Una entrada se convierte en toda una coreografía.',
      '一次入场，演绎整段编舞。',
    ],
    category: 'Motion',
    video: 'motion-recipe-stagger-ios',
    guide: 'stagger',
    source: 'components/Stagger.vue',
    color: '#b9d8ed',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'live-springs',
    title: [
      'Follow the feeling.',
      'Siga o movimento.',
      'Sigue el movimiento.',
      '跟随每一刻。',
    ],
    description: [
      'A chain of springs that stays connected to your input.',
      'Uma cadeia de springs conectada ao seu toque.',
      'Una cadena de resortes conectada a tu toque.',
      '一串弹簧，始终回应你的输入。',
    ],
    category: 'Motion',
    video: 'motion-recipe-followers-ios',
    guide: 'live-springs',
    source: 'components/LiveSprings.vue',
    color: '#d6ed92',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'gradients',
    title: [
      'Change the atmosphere.',
      'Mude a atmosfera.',
      'Cambia la atmósfera.',
      '改变氛围。',
    ],
    description: [
      'Color, light and direction, always in motion.',
      'Cor, luz e direção em movimento.',
      'Color, luz y dirección en movimiento.',
      '让色彩、光线与方向流动起来。',
    ],
    category: 'Visual',
    video: 'motion-recipe-gradients-ios',
    guide: 'gradients',
    source: 'components/Gradients.vue',
    color: '#e1b4c6',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'rolling-numbers',
    title: [
      'Every number counts.',
      'Cada número conta.',
      'Cada número cuenta.',
      '每个数字都有故事。',
    ],
    description: [
      'Turn a changing value into a moment worth noticing.',
      'Transforme uma mudança de valor em um detalhe especial.',
      'Convierte un cambio de valor en un detalle especial.',
      '让每次数值变化都值得留意。',
    ],
    category: 'Type',
    video: 'motion-recipe-rolling-ios',
    guide: 'rolling',
    source: 'components/Rolling.vue',
    color: '#f2d5a0',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'confetti',
    title: [
      'A little celebration.',
      'Uma pequena celebração.',
      'Una pequeña celebración.',
      '值得庆祝的瞬间。',
    ],
    description: [
      'Give the good moments a proper send-off.',
      'Dê aos bons momentos a resposta que merecem.',
      'Dale a los buenos momentos la respuesta que merecen.',
      '为美好的时刻，添上一场彩纸雨。',
    ],
    category: 'Visual',
    video: 'motion-recipe-confetti-ios',
    guide: 'particles',
    source: 'components/Particles.vue',
    color: '#bdcfed',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'living-layout',
    title: [
      'Make a little room.',
      'Abra um espaço.',
      'Haz un poco de espacio.',
      '腾出一点空间。',
    ],
    description: [
      'Insert, reorder and expand. Everything moves together.',
      'Insira, reordene e expanda. Tudo se move junto.',
      'Inserta, reordena y expande. Todo se mueve junto.',
      '插入、重排、展开，让所有元素一起流动。',
    ],
    category: 'Layout',
    video: 'motion-recipe-layout-ios',
    guide: 'layout',
    source: 'components/LayoutLab.vue',
    color: '#c6d3bb',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'circular-reveal',
    title: [
      'Something to reveal.',
      'Algo para revelar.',
      'Algo que revelar.',
      '惊喜即将揭晓。',
    ],
    description: [
      'A new surface unfolds from a single point.',
      'Uma nova superfície surge de um único ponto.',
      'Una nueva superficie surge de un solo punto.',
      '从一个点，展开全新的画面。',
    ],
    category: 'Visual',
    video: 'motion-recipe-reveal-ios',
    guide: 'reveal',
    source: 'components/Reveal.vue',
    color: '#d4c4e9',
    platform: 'iOS',
    caption: revealCaption,
  },
  {
    slug: 'motion-paths',
    title: [
      'Take the scenic route.',
      'Escolha outro caminho.',
      'Elige otro camino.',
      '沿途皆是风景。',
    ],
    description: [
      'Curves, arcs and a little sense of adventure.',
      'Curvas, arcos e um pouco de aventura.',
      'Curvas, arcos y un poco de aventura.',
      '曲线、弧线，还有一点冒险精神。',
    ],
    category: 'Motion',
    video: 'motion-recipe-paths-ios',
    guide: 'paths',
    source: 'components/MotionPath.vue',
    color: '#b9dbce',
    platform: 'iOS',
    caption: ios,
  },
  {
    slug: 'bottom-sheet',
    title: [
      'It all comes together.',
      'Tudo se conecta.',
      'Todo se conecta.',
      '一切自然衔接。',
    ],
    description: [
      'A sheet that drags, scrolls and follows the keyboard.',
      'Um painel que arrasta, rola e acompanha o teclado.',
      'Un panel que se arrastra, desplaza y sigue al teclado.',
      '拖动、滚动、跟随键盘的底部面板。',
    ],
    category: 'Touch',
    video: 'bottom-sheet-ios',
    guide: 'bottom-sheet',
    source: 'components/BottomSheetLab.vue',
    color: '#e9c49d',
    platform: 'iOS',
    caption: ios,
  },
]
