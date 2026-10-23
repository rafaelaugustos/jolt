import { existsSync } from 'node:fs'
import { defineConfig, type DefaultTheme } from 'vitepress'

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
        page('colors', 'colors'),
        page('gradients', 'gradients'),
        page('decorations', 'decorations'),
        page('paths', 'paths'),
        page('presets', 'presets'),
        page('stagger', 'stagger'),
        page('lists', 'lists'),
        page('layout', 'layout'),
        page('sequences', 'sequences'),
        page('motionValues', 'motion-values'),
        page('nativeProperties', 'native-properties'),
        page('sceneLighting', 'scene-lighting'),
        page('layers', 'layers'),
        page('motionControllers', 'motion-controllers'),
        page('press', 'press'),
        page('drag', 'drag'),
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
        page('internals', 'how-it-works'),
        page('limits', 'not-there-yet'),
      ],
    },
  ]
}

const en = {
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
  colors: 'Colors',
  gradients: 'Gradients',
  decorations: 'Corners, borders and shadows',
  paths: 'Motion along a path',
  presets: 'Presets',
  stagger: 'Several views',
  lists: 'List rows',
  nativeProperties: 'Native properties',
  sceneLighting: 'SceneKit lighting',
  sequences: 'Sequences',
  motionValues: 'Motion values',
  layers: 'Layered motion',
  motionControllers: 'Scopes and states',
  press: 'Press',
  drag: 'Drag, fling & snap',
  layout: 'Layout changes',
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
  keyboard: 'Follow the keyboard',
  androidBusy: 'Busy JavaScript on Android',
  vue: 'Vue',
  api: 'API',
  internals: 'How it works',
  limits: 'Not there yet',
}

const pt = {
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
  colors: 'Cores',
  gradients: 'Gradientes',
  decorations: 'Cantos, bordas e sombras',
  paths: 'Movimento em um caminho',
  presets: 'Presets',
  stagger: 'Várias views',
  lists: 'Linhas de lista',
  motionValues: 'Valores de movimento',
  layers: 'Movimento em camadas',
  motionControllers: 'Escopos e estados',
  nativeProperties: 'Propriedades nativas',
  sceneLighting: 'Iluminação SceneKit',
  sequences: 'Sequências',
  press: 'Press',
  drag: 'Arrastar e encaixar',
  layout: 'Mudanças de layout',
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
  api: 'API',
  internals: 'Como funciona',
  limits: 'O que ainda não existe',
}

const analytics = 'G-P4W61P3EV0'
const tagManager = 'GTM-T586LWZD'

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
    ['meta', { property: 'og:image', content: `${site}/logo.png` }],
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
        locales: {
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
  },
})
