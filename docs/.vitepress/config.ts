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
      ],
    },
    {
      text: t.motion,
      items: [
        page('transitions', 'transitions'),
        page('decay', 'decay'),
        page('colors', 'colors'),
        page('decorations', 'decorations'),
        page('paths', 'paths'),
        page('presets', 'presets'),
        page('stagger', 'stagger'),
        page('lists', 'lists'),
        page('sequences', 'sequences'),
        page('press', 'press'),
        page('symbols', 'symbol-effects'),
        page('shimmer', 'shimmer'),
        page('liquid', 'liquid'),
        page('loaders', 'loaders'),
        page('reveal', 'reveal'),
        page('text', 'text'),
        page('haptics', 'haptics'),
        page('particles', 'particles'),
        page('interrupting', 'interrupting'),
        page('playback', 'playback'),
        page('scrollLinked', 'scroll-linked'),
        page('androidBusy', 'android-performance'),
      ],
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
  reference: 'Reference',
  introduction: 'What Jolt is',
  install: 'Install',
  animating: 'Animating',
  demo: 'Demo app',
  transitions: 'Springs and tweens',
  decay: 'Decay and snapping',
  colors: 'Colors',
  decorations: 'Corners, borders and shadows',
  paths: 'Motion along a path',
  presets: 'Presets',
  stagger: 'Several views',
  lists: 'List rows',
  sequences: 'Sequences',
  press: 'Press',
  symbols: 'SF Symbol effects',
  shimmer: 'Shimmer',
  liquid: 'Liquid images',
  loaders: 'Loaders',
  reveal: 'Circular reveal',
  text: 'Text',
  haptics: 'Haptics',
  particles: 'Particles and confetti',
  interrupting: 'Interrupting and stopping',
  playback: 'Pause and scrub',
  scrollLinked: 'Scroll-linked animations',
  androidBusy: 'Busy JavaScript on Android',
  api: 'API',
  internals: 'How it works',
  limits: 'Not there yet',
}

const pt = {
  start: 'Começo',
  motion: 'Movimento',
  reference: 'Referência',
  introduction: 'O que é o Jolt',
  install: 'Instalação',
  animating: 'Animando',
  demo: 'Aplicativo de demonstração',
  transitions: 'Springs e tweens',
  decay: 'Desaceleração e encaixe',
  colors: 'Cores',
  decorations: 'Cantos, bordas e sombras',
  paths: 'Movimento em um caminho',
  presets: 'Presets',
  stagger: 'Várias views',
  lists: 'Linhas de lista',
  sequences: 'Sequências',
  press: 'Press',
  symbols: 'Efeitos de SF Symbols',
  shimmer: 'Shimmer',
  liquid: 'Imagens com movimento líquido',
  loaders: 'Indicadores de carregamento',
  reveal: 'Revelação circular',
  text: 'Texto',
  haptics: 'Feedback tátil',
  particles: 'Partículas e confete',
  interrupting: 'Interrompendo e parando',
  playback: 'Pausa e progresso',
  scrollLinked: 'Animações ligadas ao scroll',
  androidBusy: 'JavaScript ocupado no Android',
  api: 'API',
  internals: 'Como funciona',
  limits: 'O que ainda não existe',
}

export default defineConfig({
  title: 'Jolt',
  description:
    'Native animations for NativeScript: presets, springs, keyframes and stagger, one call each.',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: site },
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/icon.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#dcf71d' }],
    ['meta', { property: 'og:image', content: `${site}/logo.png` }],
  ],
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
