import { type Experiment, element, action, resetWords } from './types'

export const layoutExperiments: Experiment[] = [
  {
    id: 'scroll',
    family: 'layout',
    title: [
      'Scroll-linked motion',
      'Movimento com rolagem',
      'Movimiento con scroll',
      '滚动联动',
    ],
    hint: [
      'Scroll inside the window. The page becomes a timeline.',
      'Role dentro da janela. A página vira uma timeline.',
      'Desplázate dentro de la ventana. La página se vuelve una timeline.',
      '在窗口内滚动，让页面成为时间轴。',
    ],
    guide: 'web-support#scroll',
    apis: ['scrollLinked', 'scrollValue'],
    runLabel: ['Scroll', 'Rolar', 'Desplazar', '滚动'],
    code: `scope.scrollLinked(scroller, card,\n  { x: [-70, 70], rotate: [-35, 35] }, { range: [0, 500] })\nconst offset = scope.scrollValue(scroller)\nscope.subscribe(offset, value => output.textContent = Math.round(value))`,
    mount(ctx) {
      const scroller = element(ctx.host, 'div', 'lab-scroll-window')
      scroller.tabIndex = 0
      scroller.setAttribute(
        'aria-label',
        ctx.t([
          'Scroll demo',
          'Demonstração de rolagem',
          'Demostración de scroll',
          '滚动演示',
        ]),
      )
      const content = element(scroller, 'div', 'lab-scroll-content')
      const card = element(content, 'div', 'lab-scroll-orb', '↗')
      const output = element(ctx.host, 'output', 'lab-readout', '0 px')
      ctx.scope.scrollLinked(
        scroller,
        card,
        { x: [-70, 70], rotate: [-35, 35] },
        { range: [0, 500] },
      )
      const offset = ctx.scope.scrollValue(scroller)
      ctx.scope.subscribe(offset, (value) => {
        output.textContent = `${Math.round(value)} px`
      })
      return {
        run: () =>
          scroller.scrollTo({
            top: scroller.scrollTop > 200 ? 0 : 500,
            behavior: 'smooth',
          }),
      }
    },
  },
  {
    id: 'horizontal-scroll',
    family: 'layout',
    title: ['Horizontal & RTL', 'Horizontal e RTL', 'Horizontal y RTL', '横向与 RTL'],
    hint: [
      'The same progress, from either reading direction.',
      'O mesmo progresso, nas duas direções de leitura.',
      'El mismo progreso, en ambas direcciones de lectura.',
      '无论阅读方向如何，进度一致。',
    ],
    guide: 'web-collections#horizontal',
    apis: ['scrollValue', 'bind'],
    runLabel: ['Scroll', 'Rolar', 'Desplazar', '滚动'],
    code: `const offset = scope.scrollValue(scroller, { axis: 'x' })\nscope.bind(progress, {\n  scaleX: scope.map(offset, [0, 600], [0, 1])\n})\n// RTL offsets grow from inline start, like LTR.`,
    mount(ctx) {
      const shell = element(ctx.host, 'div', 'lab-horizontal')
      const scroller = element(shell, 'div', 'lab-horizontal-window')
      scroller.tabIndex = 0
      scroller.setAttribute(
        'aria-label',
        ctx.t([
          'Horizontal scroll',
          'Rolagem horizontal',
          'Scroll horizontal',
          '横向滚动',
        ]),
      )
      for (let i = 0; i < 7; i++)
        element(scroller, 'div', 'lab-horizontal-card', String(i + 1).padStart(2, '0'))
      const bar = element(shell, 'div', 'lab-progress-track')
      const fill = element(bar, 'div', 'lab-progress-fill')
      const offset = ctx.scope.scrollValue(scroller, { axis: 'x' })
      ctx.scope.bind(fill, {
        scaleX: ctx.scope.map(
          offset,
          [0, scroller.scrollWidth - scroller.clientWidth],
          [0, 1],
        ),
      })
      let rtl = false
      return {
        run: () =>
          scroller.scrollTo({
            left:
              Math.abs(scroller.scrollLeft) > 200
                ? 0
                : (rtl ? -1 : 1) * scroller.scrollWidth,
            behavior: 'smooth',
          }),
        actions: [
          action(
            'direction',
            ['LTR / RTL', 'LTR / RTL', 'LTR / RTL', 'LTR / RTL'],
            () => {
              rtl = !rtl
              scroller.dir = rtl ? 'rtl' : 'ltr'
              scroller.scrollLeft = 0
              offset.refresh()
            },
          ),
        ],
      }
    },
  },
  {
    id: 'viewport',
    family: 'layout',
    title: [
      'Viewport entrance',
      'Entrada na área visível',
      'Entrada al área visible',
      '进入视口',
    ],
    hint: [
      'Let each card arrive when it becomes visible.',
      'Deixe cada card chegar quando ficar visível.',
      'Deja que cada tarjeta llegue al hacerse visible.',
      '让每张卡片在可见时入场。',
    ],
    guide: 'web-lifecycle#viewport',
    apis: ['viewportEnter'],
    runLabel: ['Scroll', 'Rolar', 'Desplazar', '滚动'],
    code: `scope.viewportEnter(cards, {\n  root: scroller, once: false, threshold: .3,\n  keyframes: { y: [35, 0], opacity: [0, 1] },\n  transition: { duration: 650, type: 'spring', bounce: .2 }\n})`,
    mount(ctx) {
      const scroller = element(ctx.host, 'div', 'lab-scroll-window lab-entrance-window')
      scroller.tabIndex = 0
      const cards = Array.from({ length: 7 }, (_, i) =>
        element(scroller, 'div', 'lab-entrance-card', String(i + 1).padStart(2, '0')),
      )
      ctx.scope.viewportEnter(cards, {
        root: scroller,
        once: false,
        threshold: 0.3,
        keyframes: { y: [35, 0], opacity: [0, 1] },
        transition: { duration: 650, type: 'spring', bounce: 0.2 },
      })
      return {
        run: () =>
          scroller.scrollTo({
            top: scroller.scrollTop > 200 ? 0 : scroller.scrollHeight,
            behavior: 'smooth',
          }),
      }
    },
  },
  {
    id: 'items',
    family: 'layout',
    title: [
      'Keyed entrances',
      'Entradas por identidade',
      'Entradas por identidad',
      '按标识入场',
    ],
    hint: [
      'New identities arrive, even when the same rows are reused.',
      'Novas identidades chegam, mesmo reutilizando as linhas.',
      'Llegan nuevas identidades, incluso al reutilizar las filas.',
      '即使复用行，新标识仍会重新入场。',
    ],
    guide: 'web-collections#items',
    apis: ['animateItems'],
    runLabel: ['Next collection', 'Próxima coleção', 'Siguiente colección', '下一组'],
    code: `const entrance = scope.animateItems(items, 'fadeInUp',\n  { once: true, root: scroller, duration: 600 })\n// After your renderer reuses the rows with new stable keys:\nentrance.update(nextItems)`,
    mount(ctx) {
      const scroller = element(ctx.host, 'div', 'lab-scroll-window lab-entrance-window')
      const rows = Array.from({ length: 4 }, (_, i) =>
        element(scroller, 'div', 'lab-entrance-card', `0${i + 1}`),
      )
      let generation = 0
      const items = () => rows.map((target, i) => ({ key: generation * 4 + i, target }))
      const entrance = ctx.scope.animateItems(items(), 'fadeInUp', {
        once: true,
        root: scroller,
        duration: 600,
      })
      return {
        run() {
          generation++
          scroller.scrollTop = 0
          rows.forEach((row, i) => {
            row.textContent = String(generation * 4 + i + 1).padStart(2, '0')
          })
          entrance.update(items())
        },
      }
    },
  },
  {
    id: 'layout',
    family: 'layout',
    title: [
      'Layout transitions',
      'Transições de layout',
      'Transiciones de layout',
      '布局转场',
    ],
    hint: [
      'The layout changes. Every card finds its new place.',
      'O layout muda. Cada card encontra seu novo lugar.',
      'El layout cambia. Cada tarjeta encuentra su nuevo lugar.',
      '布局改变，每张卡片找到新位置。',
    ],
    guide: 'web-visual#layout',
    apis: ['animateLayout'],
    code: `scope.animateLayout(grid, () => {\n  grid.classList.toggle('single-column')\n}, { type: 'spring', bounce: .15, duration: 750 })`,
    mount(ctx) {
      const grid = element(ctx.host, 'div', 'lab-layout-grid')
      for (let i = 0; i < 4; i++)
        element(grid, 'div', 'lab-layout-card', String(i + 1).padStart(2, '0'))
      return {
        run: () =>
          ctx.scope.animateLayout(grid, () => grid.classList.toggle('single-column'), {
            type: 'spring',
            bounce: 0.15,
            duration: 750,
          }),
      }
    },
  },
  {
    id: 'size',
    family: 'layout',
    title: ['Auto size', 'Tamanho automático', 'Tamaño automático', '自动尺寸'],
    hint: [
      'Open a little space. Let the content set the height.',
      'Abra um espaço. Deixe o conteúdo definir a altura.',
      'Abre un espacio. Deja que el contenido defina la altura.',
      '展开空间，让内容决定高度。',
    ],
    guide: 'web-visual#layout',
    apis: ['animateSize'],
    code: `scope.animateSize(panel, { height: 'auto' }, 'smooth')\n// Reverse with scope.animateSize(panel, { height: 76 }, 'smooth').`,
    mount(ctx) {
      const card = element(ctx.host, 'div', 'lab-size-card')
      element(
        card,
        'strong',
        '',
        ctx.t([
          'Room to breathe.',
          'Espaço para respirar.',
          'Espacio para respirar.',
          '留出呼吸的空间。',
        ]),
      )
      element(
        card,
        'p',
        '',
        ctx.t([
          'A layout that gives your content exactly the space it needs. Open, close, and interrupt it on the way.',
          'Um layout que dá ao conteúdo o espaço de que ele precisa. Abra, feche e interrompa pelo caminho.',
          'Un layout que da al contenido el espacio que necesita. Abre, cierra e interrumpe por el camino.',
          '布局为内容提供恰好的空间。展开、收起，也可以在途中打断。',
        ]),
      )
      let expanded = false
      return {
        run() {
          expanded = !expanded
          return ctx.scope.animateSize(card, { height: expanded ? 'auto' : 76 }, 'smooth')
        },
      }
    },
  },
  {
    id: 'shared-layout',
    family: 'layout',
    title: ['Shared layout', 'Layout compartilhado', 'Layout compartido', '共享布局'],
    hint: [
      'One identity, from thumbnail to centerpiece.',
      'Uma identidade, da miniatura ao centro da cena.',
      'Una identidad, de miniatura a protagonista.',
      '同一标识，从缩略图走到舞台中心。',
    ],
    guide: 'web-interactions#shared',
    apis: ['sharedLayout'],
    code: `const shared = scope.sharedLayout(container, { transition: 'smooth' })\nshared.attach(card, 'cover')\nshared.transition(() => card.classList.toggle('expanded'))`,
    mount(ctx) {
      const container = element(ctx.host, 'div', 'lab-shared-wrap')
      const card = element(container, 'div', 'lab-shared-card', '✳︎')
      const shared = ctx.scope.sharedLayout(container, { transition: 'smooth' })
      shared.attach(card, 'cover')
      return {
        run() {
          const flight = shared.transition(() => card.classList.toggle('expanded'))
          return flight.finished.then((result) => {
            if (ctx.alive() && result.status === 'unavailable')
              ctx.report(result.reason || result.status)
          })
        },
      }
    },
  },
  {
    id: 'scroll-header',
    family: 'layout',
    title: [
      'Header & refresh',
      'Cabeçalho e atualização',
      'Cabecera y actualización',
      '页头与刷新',
    ],
    hint: [
      'Collapse the cover. Pull from the top to refresh locally.',
      'Recolha a capa. Puxe do topo para atualizar a lista local.',
      'Recoge la portada. Tira desde arriba para actualizar la lista local.',
      '收起封面，从顶部下拉以刷新本地列表。',
    ],
    guide: 'web-gestures#header',
    apis: ['scrollHeader'],
    runLabel: ['Scroll', 'Rolar', 'Desplazar', '滚动'],
    code: `const header = scope.scrollHeader(scroller, {\n  header: cover, title, toolbarTitle, minimum: 44,\n  items: () => rows,\n  onRefresh: context => context.commit(updateLocalRows)\n})\nheader.scrollToItem('5')`,
    mount(ctx) {
      const shell = element(ctx.host, 'div', 'lab-header-shell')
      const scroller = element(shell, 'div', 'lab-header-scroll')
      const rowsHost = element(scroller, 'div', 'lab-header-rows')
      const rows = Array.from({ length: 9 }, (_, i) => ({
        key: String(i),
        target: element(
          rowsHost,
          'div',
          'lab-header-row',
          `${String(i + 1).padStart(2, '0')} — ${ctx.t(['New frequencies', 'Novas frequências', 'Nuevas frecuencias', '新的频率'])}`,
        ),
      }))
      const cover = element(shell, 'header', 'lab-header-cover')
      const title = element(
        cover,
        'div',
        'lab-header-title',
        ctx.t(['Your collection', 'Sua coleção', 'Tu colección', '你的收藏']),
      )
      const toolbarTitle = element(shell, 'div', 'lab-header-compact', title.textContent!)
      let refreshed = 0
      const header = ctx.scope.scrollHeader(scroller, {
        header: cover,
        title,
        toolbarTitle,
        minimum: 44,
        items: () => rows,
        onRefresh: async (context) => {
          await context.commit(() => {
            refreshed++
            rows[0]!.target.textContent =
              ctx.t([
                'Updated locally ',
                'Atualizado localmente ',
                'Actualizado localmente ',
                '本地更新 ',
              ]) + refreshed
          })
        },
      })
      return {
        run() {
          if (scroller.scrollTop > 100) header.scrollToTop()
          else header.scrollToItem('5')
        },
        actions: [action('top', resetWords, () => header.scrollToTop())],
      }
    },
  },
  {
    id: 'nested-scroll',
    family: 'layout',
    title: [
      'Nested scroll handoff',
      'Rolagem coordenada',
      'Scroll coordinado',
      '嵌套滚动交接',
    ],
    hint: [
      'Scroll the list. At its edge, the panel takes the gesture.',
      'Role a lista. Na borda, o painel assume o gesto.',
      'Desplaza la lista. En el borde, el panel recibe el gesto.',
      '滚动列表，到达边缘时由面板接手手势。',
    ],
    guide: 'web-gestures#scroll',
    apis: ['gestures', 'bind'],
    runLabel: resetWords,
    code: `const gesture = scope.gestures(panel, {\n  pan: { axis: 'y', bounds: { top: -40, bottom: 50 } },\n  scroll: { element: scroller, axis: 'y' }\n})\nscope.bind(panel, { y: gesture.y })`,
    mount(ctx) {
      const panel = element(ctx.host, 'div', 'lab-nested-panel')
      const scroller = element(panel, 'div', 'lab-nested-scroll')
      for (let i = 0; i < 10; i++)
        element(
          scroller,
          'div',
          'lab-header-row',
          `${String(i + 1).padStart(2, '0')} — Jolt`,
        )
      const gesture = ctx.scope.gestures(panel, {
        pan: { axis: 'y', bounds: { top: -40, bottom: 50 } },
        scroll: { element: scroller, axis: 'y' },
      })
      ctx.scope.bind(panel, { y: gesture.y })
      return {
        run() {
          scroller.scrollTop = 0
          gesture.settleTo({ y: 0 })
        },
      }
    },
  },
]
