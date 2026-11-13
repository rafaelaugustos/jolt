import type { DefaultTheme } from 'vitepress'
import { version } from '../../package.json'
import { withNavigationStatus } from './navigation-status'

type Labels = readonly [
  english: string,
  portuguese: string,
  spanish: string,
  chinese: string,
]

/** Topic groups share one page inventory and order across all documentation locales. */
export function sidebar(
  prefix: string,
  t: Record<string, string>,
): DefaultTheme.SidebarItem[] {
  const locale = Math.max(0, ['', '/pt-BR', '/es', '/zh-Hans'].indexOf(prefix))
  const label = (labels: Labels) => labels[locale]!
  const page = (key: string, path: string) => ({
    text: t[key],
    link: `${prefix}/guide/${path}`,
  })
  const localized = (labels: Labels, path: string) => ({
    text: label(labels),
    link: `${prefix}/guide/${path}`,
  })
  const group = (
    labels: Labels,
    items: DefaultTheme.SidebarItem[],
  ): DefaultTheme.SidebarItem => ({
    text: `<span class="jolt-nav-topic">${label(labels)}</span><span class="jolt-nav-count" aria-hidden="true">${items.length}</span>`,
    collapsed: true,
    items,
  })

  return withNavigationStatus(
    [
      group(
        ['Start here', 'Comece aqui', 'Primeros pasos', '开始使用'],
        [
          page('introduction', ''),
          page('install', 'install'),
          page('animating', 'animating'),
          page('demo', 'demo'),
        ],
      ),
      group(
        [
          'Motion fundamentals',
          'Fundamentos de movimento',
          'Fundamentos del movimiento',
          '动效基础',
        ],
        [
          page('transitions', 'transitions'),
          page('presets', 'presets'),
          page('stagger', 'stagger'),
          page('sequences', 'sequences'),
          page('motionValues', 'motion-values'),
          page('liveSprings', 'live-springs'),
          page('layers', 'layers'),
          page('interrupting', 'interrupting'),
          page('playback', 'playback'),
        ],
      ),
      group(
        ['Gestures and input', 'Gestos e entrada', 'Gestos y entrada', '手势与输入'],
        [
          page('press', 'press'),
          page('drag', 'drag'),
          page('gestures', 'gestures'),
          page('interactionSurface', 'interaction-surface'),
          page('portableFoundations', 'portable-foundations'),
          page('interactionDepth', 'interaction-depth'),
          page('haptics', 'haptics'),
          page('keyboard', 'keyboard'),
          page('sensor', 'device-sensors'),
        ],
      ),
      group(
        ['Scroll and lists', 'Scroll e listas', 'Desplazamiento y listas', '滚动与列表'],
        [
          page('scrollLinked', 'scroll-linked'),
          page('scrollHeader', 'scroll-header'),
          page('lists', 'lists'),
          page('reorder', 'reorder'),
          localized(
            [
              'Values, scroll and lists',
              'Valores, scroll e listas',
              'Valores, scroll y listas',
              '组合值、滚动与列表',
            ],
            'values-scroll-lists',
          ),
        ],
      ),
      group(
        [
          'Layout and navigation',
          'Layout e navegação',
          'Diseño y navegación',
          '布局与导航',
        ],
        [
          page('layout', 'layout'),
          page('size', 'size'),
          page('sharedLayout', 'shared-layout'),
          page('sharedNavigation', 'shared-navigation'),
          page('sharedGestures', 'shared-gestures'),
          page('returnTargets', 'return-targets'),
          page('gallery', 'gallery'),
          page('interactiveNavigation', 'interactive-navigation'),
          page('predictiveBack', 'predictive-back'),
          page('bottomSheet', 'bottom-sheet'),
        ],
      ),
      group(
        [
          'Paths and physics',
          'Trajetórias e física',
          'Trayectorias y física',
          '路径与物理',
        ],
        [
          page('paths', 'paths'),
          page('decay', 'decay'),
          page('gravity', 'gravity'),
          page('circlePhysics', 'circle-physics'),
          page('physicsAttachments', 'physics-attachments'),
        ],
      ),
      group(
        [
          'Drawing and surfaces',
          'Desenho e superfícies',
          'Dibujo y superficies',
          '绘图与表面',
        ],
        [
          page('colors', 'colors'),
          page('gradients', 'gradients'),
          page('decorations', 'decorations'),
          page('shapes', 'shapes'),
          page('blur', 'blur'),
          page('glass', 'glass'),
        ],
      ),
      group(
        ['Text and effects', 'Texto e efeitos', 'Texto y efectos', '文字与特效'],
        [
          page('text', 'text'),
          page('rolling', 'rolling'),
          page('symbols', 'symbol-effects'),
          page('shimmer', 'shimmer'),
          page('loaders', 'loaders'),
          page('reveal', 'reveal'),
          page('particles', 'particles'),
          page('liquid', 'liquid'),
          page('imageEffects', 'image-effects'),
          page('photoZoom', 'photo-zoom'),
        ],
      ),
      group(
        [
          'Composition and scenes',
          'Composição e cenas',
          'Composición y escenas',
          '组合与场景',
        ],
        [
          page('motionControllers', 'motion-controllers'),
          page('nativeComposition', 'native-composition'),
          page('portableComposition', 'portable-composition'),
          page('configure', 'configure'),
          page('nativeProperties', 'native-properties'),
          page('sceneLighting', 'scene-lighting'),
          page('sceneCamera', 'scene-camera'),
          page('sceneShaders', 'scene-shaders'),
        ],
      ),
      group(
        ['Frameworks', 'Frameworks', 'Frameworks', '框架'],
        [
          page('vue', 'vue'),
          page('nativeAdapters', 'frameworks'),
          localized(
            [
              'React · Angular · Svelte · Solid (Web)',
              'React · Angular · Svelte · Solid (Web)',
              'React · Angular · Svelte · Solid (Web)',
              'React · Angular · Svelte · Solid（Web）',
            ],
            'web-frameworks',
          ),
          page('webVue', 'web-vue'),
          page('reactNative', 'react-native'),
        ],
      ),
      group(
        ['SwiftUI', 'SwiftUI', 'SwiftUI', 'SwiftUI'],
        [
          localized(
            [
              'Installation and scope',
              'Instalação e escopo',
              'Instalación y alcance',
              '安装与范围',
            ],
            'swiftui',
          ),
          localized(
            [
              'Motion and lifecycle',
              'Movimento e ciclo de vida',
              'Movimiento y ciclo de vida',
              '动效与生命周期',
            ],
            'swiftui-motion',
          ),
          localized(
            [
              'Graphics and scroll',
              'Gráficos e scroll',
              'Gráficos y desplazamiento',
              '图形与滚动',
            ],
            'swiftui-advanced',
          ),
          localized(
            ['Characters', 'Personagens', 'Personajes', '角色'],
            'swiftui-characters',
          ),
          localized(
            [
              'Geometry and interaction',
              'Geometria e interação',
              'Geometría e interacción',
              '几何与交互',
            ],
            'swiftui-geometry',
          ),
          localized(['Text', 'Texto', 'Texto', '文字'], 'swiftui-text'),
        ],
      ),
      group(
        ['Web runtime', 'Runtime Web', 'Runtime Web', 'Web 运行时'],
        [
          page('webRuntime', 'web-runtime'),
          page('webDynamic', 'web-dynamic'),
          page('webSupport', 'web-support'),
          page('webPress', 'web-press'),
          page('webLifecycle', 'web-lifecycle'),
          page('webProof', 'web-composition'),
        ],
      ),
      group(
        ['Web capabilities', 'Recursos Web', 'Capacidades Web', 'Web 功能'],
        [
          page('webVisual', 'web-visual'),
          page('webGestures', 'web-gestures'),
          page('webEffects', 'web-effects'),
          page('webSurfaces', 'web-surfaces'),
          page('webPlatforms', 'web-platforms'),
          page('webParity', 'web-parity'),
          page('webOrchestration', 'web-orchestration'),
          page('webCollections', 'web-collections'),
          page('webInteractions', 'web-interactions'),
          page('mobileWeb', 'mobile-web'),
        ],
      ),
      group(
        [
          'Examples and recipes',
          'Exemplos e receitas',
          'Ejemplos y recetas',
          '示例与配方',
        ],
        [
          page('showcase', 'showcase'),
          localized(
            [
              'Motion collection',
              'Coleção de movimentos',
              'Colección de movimiento',
              '动效精选',
            ],
            'motion-gallery',
          ),
          localized(
            ['Web playground', 'Playground Web', 'Playground Web', 'Web 互动体验'],
            'web-playground',
          ),
          page('recipes', 'recipes'),
          localized(
            [
              'Jolt Drive recipes',
              'Receitas do Jolt Drive',
              'Recetas de Jolt Drive',
              'Jolt Drive 动效配方',
            ],
            'drive-recipes',
          ),
          localized(
            [
              'The Hexdrop recipe',
              'A receita do Hexdrop',
              'La receta de Hexdrop',
              'Hexdrop 动效配方',
            ],
            'hexdrop-recipes',
          ),
          localized(
            [
              'Auralis recipes',
              'Receitas do Auralis',
              'Recetas de Auralis',
              'Auralis 动效配方',
            ],
            'auralis-recipes',
          ),
          localized(
            ['Vena recipes', 'Receitas do Vena', 'Recetas de Vena', 'Vena 动效配方'],
            'vena-recipes',
          ),
        ],
      ),
      group(
        [
          'Tools and performance',
          'Ferramentas e desempenho',
          'Herramientas y rendimiento',
          '工具与性能',
        ],
        [
          localized(
            [
              'Inspection and replay',
              'Inspeção e replay',
              'Inspección y replay',
              '检查与重播',
            ],
            'portable-tools',
          ),
          page('interactionReplay', 'interaction-replay'),
          page('motionInspector', 'motion-inspector'),
          page('androidBusy', 'android-performance'),
          page('comparison', 'comparison'),
        ],
      ),
      group(
        ['Reference', 'Referência', 'Referencia', '参考'],
        [
          page('api', 'api'),
          page('internals', 'how-it-works'),
          page('limits', 'not-there-yet'),
        ],
      ),
    ],
    prefix,
    version,
  )
}
