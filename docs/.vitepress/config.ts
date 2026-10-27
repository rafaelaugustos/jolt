import { existsSync } from 'node:fs'
import { defineConfig, type DefaultTheme } from 'vitepress'
import { version } from '../../package.json'
import { es, zh, spanish, chinese, searchTranslations } from './translations'

const site = 'https://jolt.rafaelaugusto.dev'
const repo = 'https://github.com/rafaelaugustos/jolt'
const cortex = '<a href="https://getcortexlabs.com/">Cortex Labs</a>'
const npm = 'https://www.npmjs.com/package/@rafaelaugusto/jolt'

function sidebar(prefix: string, t: Record<string, string>): DefaultTheme.SidebarItem[] {
  const page = (key: string, path: string) => ({
    text: t[key],
    link: `${prefix}/guide/${path}`,
  })
  return [
    {
      text: t.start,
      items: [
        page('introduction', ''),
        page('install', 'install'),
        page('animating', 'animating'),
        page('demo', 'demo'),
        page('reactNative', 'react-native'),
      ],
    },
    {
      text: t.motion,
      items: [
        page('transitions', 'transitions'),
        page('decay', 'decay'),
        page('gravity', 'gravity'),
        page('circlePhysics', 'circle-physics'),
        page('physicsAttachments', 'physics-attachments'),
        page('colors', 'colors'),
        page('gradients', 'gradients'),
        page('decorations', 'decorations'),
        page('paths', 'paths'),
        page('shapes', 'shapes'),
        page('blur', 'blur'),
        page('glass', 'glass'),
        page('presets', 'presets'),
        page('stagger', 'stagger'),
        page('lists', 'lists'),
        page('layout', 'layout'),
        page('sharedLayout', 'shared-layout'),
        page('sharedNavigation', 'shared-navigation'),
        page('sharedGestures', 'shared-gestures'),
        page('returnTargets', 'return-targets'),
        page('gallery', 'gallery'),
        page('interactiveNavigation', 'interactive-navigation'),
        page('predictiveBack', 'predictive-back'),
        page('size', 'size'),
        page('sequences', 'sequences'),
        page('motionValues', 'motion-values'),
        page('liveSprings', 'live-springs'),
        page('nativeProperties', 'native-properties'),
        page('sceneLighting', 'scene-lighting'),
        page('sceneCamera', 'scene-camera'),
        page('sceneShaders', 'scene-shaders'),
        page('layers', 'layers'),
        page('motionControllers', 'motion-controllers'),
        page('press', 'press'),
        page('drag', 'drag'),
        page('gestures', 'gestures'),
        page('bottomSheet', 'bottom-sheet'),
        page('reorder', 'reorder'),
        page('interactionSurface', 'interaction-surface'),
        page('symbols', 'symbol-effects'),
        page('shimmer', 'shimmer'),
        page('liquid', 'liquid'),
        page('imageEffects', 'image-effects'),
        page('photoZoom', 'photo-zoom'),
        page('loaders', 'loaders'),
        page('reveal', 'reveal'),
        page('text', 'text'),
        page('rolling', 'rolling'),
        page('haptics', 'haptics'),
        page('particles', 'particles'),
        page('interrupting', 'interrupting'),
        page('playback', 'playback'),
        page('configure', 'configure'),
        page('scrollLinked', 'scroll-linked'),
        page('scrollHeader', 'scroll-header'),
        page('sensor', 'device-sensors'),
        page('keyboard', 'keyboard'),
        page('androidBusy', 'android-performance'),
      ],
    },
    {
      text: t.frameworks,
      items: [page('vue', 'vue')],
    },
    {
      text: t.reference,
      items: [
        page('api', 'api'),
        page('interactionReplay', 'interaction-replay'),
        page('motionInspector', 'motion-inspector'),
        page('internals', 'how-it-works'),
        page('limits', 'not-there-yet'),
      ],
    },
  ]
}

const en = {
  gallery: 'Connected gallery',
  start: 'Start',
  motion: 'Motion',
  frameworks: 'Frameworks',
  reference: 'Reference',
  introduction: 'What Jolt is',
  install: 'Install',
  animating: 'Animating',
  demo: 'Demo app',
  reactNative: 'From React Native Animated',
  transitions: 'Springs and tweens',
  decay: 'Decay and snapping',
  gravity: 'Gravity and bounce',
  circlePhysics: 'Circle physics',
  physicsAttachments: 'Attachments and snap points',
  colors: 'Colors',
  gradients: 'Gradients',
  decorations: 'Corners, borders and shadows',
  paths: 'Motion along a path',
  shapes: 'Shapes: draw and morph',
  blur: 'Animated blur',
  glass: 'Liquid Glass',
  presets: 'Presets',
  stagger: 'Several views',
  lists: 'List rows',
  nativeProperties: 'Native properties',
  sceneLighting: 'SceneKit lighting',
  sceneCamera: 'SceneKit camera FOV',
  sceneShaders: 'SceneKit environment and shaders',
  sequences: 'Sequences',
  motionValues: 'Motion values',
  liveSprings: 'Live springs',
  gestures: 'Native gestures',
  bottomSheet: 'Bottom sheet',
  reorder: 'Reorder a list',
  layers: 'Layered motion',
  motionControllers: 'Scopes and states',
  press: 'Press',
  drag: 'Drag, fling & snap',
  layout: 'Layout changes',
  sharedLayout: 'Shared layouts',
  sharedNavigation: 'Shared navigation',
  sharedGestures: 'Shared gestures',
  returnTargets: 'Recycled return targets',
  interactiveNavigation: 'Interactive navigation',
  predictiveBack: 'Predictive back',
  size: 'Real dimensions',
  interactionSurface: 'Animated touch targets',
  symbols: 'SF Symbol effects',
  shimmer: 'Shimmer',
  liquid: 'Liquid images',
  imageEffects: 'Image effects',
  photoZoom: 'Photo zoom and pan',
  loaders: 'Loaders',
  reveal: 'Circular reveal',
  text: 'Text',
  rolling: 'Rolling numbers',
  haptics: 'Haptics',
  particles: 'Particles and confetti',
  interrupting: 'Interrupting and stopping',
  playback: 'Pause and scrub',
  configure: 'Time scale and reduced motion',
  scrollLinked: 'Scroll-linked animations',
  scrollHeader: 'Collapsing headers',
  sensor: 'Device sensors',
  keyboard: 'Follow the keyboard',
  androidBusy: 'Busy JavaScript on Android',
  vue: 'Vue',
  interactionReplay: 'Interaction replay',
  motionInspector: 'Motion inspector',
  api: 'API',
  internals: 'How it works',
  limits: 'Not there yet',
}

const pt = {
  gallery: 'Galeria conectada',
  scrollHeader: 'Cabeçalhos que recolhem',
  sensor: 'Sensores do dispositivo',
  start: 'Começo',
  motion: 'Movimento',
  frameworks: 'Frameworks',
  reference: 'Referência',
  introduction: 'O que é o Jolt',
  install: 'Instalação',
  animating: 'Animando',
  demo: 'Aplicativo de demonstração',
  reactNative: 'Vindo do Animated do React Native',
  transitions: 'Springs e tweens',
  decay: 'Desaceleração e encaixe',
  gravity: 'Gravidade e quique',
  circlePhysics: 'Física de círculos',
  physicsAttachments: 'Vínculos e pontos de encaixe',
  colors: 'Cores',
  gradients: 'Gradientes',
  decorations: 'Cantos, bordas e sombras',
  paths: 'Movimento em um caminho',
  shapes: 'Formas: desenho e morph',
  blur: 'Desfoque animado',
  glass: 'Liquid Glass',
  presets: 'Presets',
  stagger: 'Várias views',
  lists: 'Linhas de lista',
  motionValues: 'Valores de movimento',
  liveSprings: 'Springs com alvo móvel',
  gestures: 'Gestos nativos',
  bottomSheet: 'Bottom sheet',
  reorder: 'Reordenar listas',
  sharedLayout: 'Layouts compartilhados',
  sharedNavigation: 'Navegação compartilhada',
  sharedGestures: 'Gestos compartilhados',
  returnTargets: 'Retorno a células recicladas',
  interactiveNavigation: 'Navegação interativa',
  predictiveBack: 'Voltar com prévia',
  layers: 'Movimento em camadas',
  motionControllers: 'Escopos e estados',
  nativeProperties: 'Propriedades nativas',
  sceneLighting: 'Iluminação SceneKit',
  sceneCamera: 'FOV da câmera SceneKit',
  sceneShaders: 'Ambiente e shaders SceneKit',
  sequences: 'Sequências',
  press: 'Press',
  drag: 'Arrastar e encaixar',
  layout: 'Mudanças de layout',
  size: 'Dimensões reais',
  interactionSurface: 'Áreas de toque animadas',
  symbols: 'Efeitos de SF Symbols',
  shimmer: 'Shimmer',
  liquid: 'Imagens com movimento líquido',
  imageEffects: 'Efeitos de imagem',
  photoZoom: 'Zoom e pan de fotos',
  loaders: 'Indicadores de carregamento',
  reveal: 'Revelação circular',
  text: 'Texto',
  rolling: 'Números rolando',
  haptics: 'Feedback tátil',
  particles: 'Partículas e confete',
  interrupting: 'Interrompendo e parando',
  playback: 'Pausa e progresso',
  configure: 'Escala de tempo e redução de movimento',
  scrollLinked: 'Animações ligadas ao scroll',
  keyboard: 'Acompanhar o teclado',
  androidBusy: 'JavaScript ocupado no Android',
  vue: 'Vue',
  interactionReplay: 'Replay de interações',
  motionInspector: 'Inspetor de movimento',
  api: 'API',
  internals: 'Como funciona',
  limits: 'O que ainda não existe',
}

const analytics = 'G-P4W61P3EV0'
const tagManager = 'GTM-T586LWZD'
const socialImageAlt =
  'Jolt. Make NativeScript move. Presets, springs, keyframes and stagger, with the lightning logo among floating native controls.'

export default defineConfig({
  title: 'Jolt',
  description:
    'Native animations for NativeScript: presets, springs, keyframes and stagger, one call each.',
  cleanUrls: true,
  lastUpdated: existsSync('.git'),
  sitemap: { hostname: site },
  head: [
    [
      'script',
      {},
      `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${tagManager}');`,
    ],
    ['link', { rel: 'icon', type: 'image/png', href: '/icon.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#dcf71d' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Jolt' }],
    ['meta', { property: 'og:image', content: `${site}/jolt-social.jpg` }],
    ['meta', { property: 'og:image:type', content: 'image/jpeg' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: socialImageAlt }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${site}/jolt-social.jpg` }],
    ['meta', { name: 'twitter:image:alt', content: socialImageAlt }],
    [
      'script',
      { async: '', src: `https://www.googletagmanager.com/gtag/js?id=${analytics}` },
    ],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${analytics}');`,
    ],
  ],
  transformHtml: (code) =>
    code.replace(
      '<body>',
      `<body><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${tagManager}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
    ),
  themeConfig: {
    logo: '/icon.png',
    search: {
      provider: 'local',
      options: {
        miniSearch: {
          options: {
            // VitePress 1.x splits on spaces by default. Segment Chinese words
            // identically while building the index and querying it in the browser.
            tokenize: (text: string) => {
              return text
                .replace(/\p{Script=Han}+/gu, (run) => {
                  if (typeof Intl.Segmenter === 'undefined') return run
                  const segmenter = new Intl.Segmenter('zh-Hans', {
                    granularity: 'word',
                  })
                  return Array.from(segmenter.segment(run), (part) => part.segment).join(
                    ' ',
                  )
                })
                .split(/[\s\p{P}]+/u)
                .filter(Boolean)
            },
          },
        },
        locales: {
          ...searchTranslations,
          'pt-BR': {
            translations: {
              button: { buttonText: 'Buscar', buttonAriaLabel: 'Buscar' },
              modal: {
                noResultsText: 'Nada encontrado para',
                resetButtonTitle: 'Limpar a busca',
                footer: {
                  selectText: 'abrir',
                  navigateText: 'navegar',
                  closeText: 'fechar',
                },
              },
            },
          },
        },
      },
    },
    socialLinks: [
      { icon: 'github', link: repo },
      { icon: 'npm', link: npm },
    ],
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/' },
          { text: 'API', link: '/guide/api' },
          { text: 'Releases', link: `${repo}/releases` },
          { text: `v${version}`, link: `${repo}/releases/tag/v${version}` },
        ],
        sidebar: { '/guide/': sidebar('', en) },
        outline: { level: [2, 3], label: 'On this page' },
        editLink: {
          pattern: `${repo}/edit/main/docs/:path`,
          text: 'Edit this page on GitHub',
        },
        footer: {
          message: 'Released under the MIT License.',
          copyright: `Maintained by Rafael Augusto and ${cortex}`,
        },
      },
    },
    'pt-BR': {
      label: 'Português',
      lang: 'pt-BR',
      link: '/pt-BR/',
      description:
        'Animações nativas para NativeScript: presets, springs, keyframes e stagger, uma chamada cada.',
      themeConfig: {
        nav: [
          { text: 'Guia', link: '/pt-BR/guide/' },
          { text: 'API', link: '/pt-BR/guide/api' },
          { text: 'Versões', link: `${repo}/releases` },
          { text: `v${version}`, link: `${repo}/releases/tag/v${version}` },
        ],
        sidebar: { '/pt-BR/guide/': sidebar('/pt-BR', pt) },
        outline: { level: [2, 3], label: 'Nesta página' },
        editLink: {
          pattern: `${repo}/edit/main/docs/:path`,
          text: 'Editar esta página no GitHub',
        },
        docFooter: { prev: 'Anterior', next: 'Próxima' },
        lastUpdated: { text: 'Atualizado em' },
        darkModeSwitchLabel: 'Aparência',
        lightModeSwitchTitle: 'Mudar para o tema claro',
        darkModeSwitchTitle: 'Mudar para o tema escuro',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Voltar ao topo',
        langMenuLabel: 'Mudar o idioma',
        notFound: {
          title: 'Página não encontrada',
          quote: 'Esta página não está aqui.',
          linkText: 'Voltar ao início',
        },
        footer: {
          message: 'Publicado sob a licença MIT.',
          copyright: `Mantido por Rafael Augusto e ${cortex}`,
        },
      },
    },
    es: {
      ...spanish,
      label: 'Español',
      link: '/es/',
      themeConfig: {
        ...spanish.themeConfig,
        nav: [
          { text: 'Guía', link: '/es/guide/' },
          { text: 'API', link: '/es/guide/api' },
          { text: 'Versiones', link: `${repo}/releases` },
          { text: `v${version}`, link: `${repo}/releases/tag/v${version}` },
        ],
        sidebar: {
          '/es/guide/': sidebar('/es', es satisfies Record<keyof typeof en, string>),
        },
        editLink: {
          pattern: `${repo}/edit/main/docs/:path`,
          text: 'Editar esta página en GitHub',
        },
        footer: {
          message: 'Publicado bajo la licencia MIT.',
          copyright: `Mantenido por Rafael Augusto y ${cortex}`,
        },
      },
    },
    'zh-Hans': {
      ...chinese,
      label: '简体中文',
      link: '/zh-Hans/',
      themeConfig: {
        ...chinese.themeConfig,
        nav: [
          { text: '指南', link: '/zh-Hans/guide/' },
          { text: 'API', link: '/zh-Hans/guide/api' },
          { text: '版本', link: `${repo}/releases` },
          { text: `v${version}`, link: `${repo}/releases/tag/v${version}` },
        ],
        sidebar: {
          '/zh-Hans/guide/': sidebar(
            '/zh-Hans',
            zh satisfies Record<keyof typeof en, string>,
          ),
        },
        editLink: {
          pattern: `${repo}/edit/main/docs/:path`,
          text: '在 GitHub 上编辑此页',
        },
        footer: {
          message: '基于 MIT 许可证发布。',
          copyright: `由 Rafael Augusto 和 ${cortex} 维护`,
        },
      },
    },
  },
})
