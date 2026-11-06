import {
  resolveListTarget,
  type WebInteractiveNavigation,
  type WebNavigationEntry,
  type WebZoomable,
} from '../../../../../src/web/public'
import { type Experiment, element, photo, action, onRun, resetWords } from './types'

export const navigationExperiments: Experiment[] = [
  {
    id: 'sheet',
    family: 'navigation',
    title: ['Bottom sheet', 'Bottom sheet', 'Bottom sheet', '底部面板'],
    hint: [
      'Open, snap, scroll, dismiss. Try the handle with arrow keys.',
      'Abra, encaixe, role, feche. Use também as setas na alça.',
      'Abre, encaja, desplaza, cierra. Prueba las flechas en el asa.',
      '打开、吸附、滚动、关闭，也可用方向键操作把手。',
    ],
    guide: 'web-platforms#sheet',
    apis: ['bottomSheet'],
    manual: true,
    runLabel: ['Open sheet', 'Abrir painel', 'Abrir panel', '打开面板'],
    code: `const sheet = scope.bottomSheet(panel, {\n  host, handle, scrollView, snap: [80, '60%', '90%'],\n  label: 'Sheet height'\n})\nsheet.open('60%')\n// sheet.expand(); sheet.collapse(); sheet.dismiss()`,
    mount(ctx) {
      const host = element(ctx.host, 'div', 'lab-sheet-host')
      element(host, 'span', 'lab-art-word', '♫')
      const backdrop = element(host, 'div', 'lab-sheet-backdrop')
      const panel = element(host, 'div', 'lab-sheet')
      const handle = element(panel, 'button', 'lab-sheet-handle', '——')
      const scroll = element(panel, 'div', 'lab-sheet-scroll')
      element(
        scroll,
        'h3',
        '',
        ctx.t([
          'Your next favorite.',
          'Seu próximo favorito.',
          'Tu próximo favorito.',
          '你的下一个心头好。',
        ]),
      )
      for (let i = 0; i < 6; i++)
        element(
          scroll,
          'p',
          'lab-header-row',
          `${String(i + 1).padStart(2, '0')} — ${ctx.t(['Something to feel', 'Algo para sentir', 'Algo que sentir', '感受此刻'])}`,
        )
      const sheet = ctx.scope.bottomSheet(panel, {
        host,
        handle,
        scrollView: scroll,
        backdrop,
        snap: [80, '60%', '90%'],
        keyboard: 'none',
        label: ctx.t([
          'Sheet height',
          'Altura do painel',
          'Altura del panel',
          '面板高度',
        ]),
      })
      return {
        run: () => sheet.open('60%'),
        actions: [
          action('expand', ['Expand', 'Expandir', 'Expandir', '展开'], () =>
            sheet.expand(),
          ),
          action('collapse', ['Collapse', 'Recolher', 'Recoger', '收起'], () =>
            sheet.collapse(),
          ),
          action('dismiss', ['Dismiss', 'Fechar', 'Cerrar', '关闭'], () =>
            sheet.dismiss(),
          ),
        ],
      }
    },
  },
  {
    id: 'modal',
    family: 'navigation',
    title: ['Interactive modal', 'Modal interativo', 'Modal interactivo', '交互弹窗'],
    hint: [
      'Pull to dismiss, release early to return. Escape works too.',
      'Puxe para fechar, solte antes para voltar. Escape também funciona.',
      'Tira para cerrar, suelta antes para volver. Escape también funciona.',
      '下拉关闭，提前松开返回，也支持 Escape。',
    ],
    guide: 'web-platforms#modal',
    apis: ['interactiveModal'],
    manual: true,
    runLabel: ['Open dialog', 'Abrir diálogo', 'Abrir diálogo', '打开弹窗'],
    code: `const modal = scope.interactiveModal(dialog, { handle })\nmodal.open()\n// Browser dialog semantics own focus and inertness.\n// modal.close(); modal.cancel()`,
    mount(ctx) {
      const preview = element(ctx.host, 'div', 'lab-modal-preview', '↗')
      preview.setAttribute('aria-hidden', 'true')
      const dialog = element(ctx.host, 'dialog', 'lab-dialog')
      const handle = element(dialog, 'div', 'lab-dialog-handle', '——')
      const title = element(
        dialog,
        'h3',
        '',
        ctx.t(['Stay a little.', 'Fique um pouco.', 'Quédate un poco.', '再停留片刻。']),
      )
      title.id = 'lab-dialog-title'
      dialog.setAttribute('aria-labelledby', title.id)
      const label = element(
        dialog,
        'label',
        'lab-dialog-label',
        ctx.t([
          'A note to yourself',
          'Um recado para você',
          'Una nota para ti',
          '给自己的留言',
        ]),
      )
      const input = element(label, 'input', 'lab-dialog-input')
      input.type = 'text'
      input.placeholder = ctx.t([
        'Make something move…',
        'Faça algo se mover…',
        'Haz que algo se mueva…',
        '让什么动起来…',
      ])
      const close = element(
        dialog,
        'button',
        'lab-dialog-close',
        ctx.t(['Close', 'Fechar', 'Cerrar', '关闭']),
      )
      const modal = ctx.scope.interactiveModal(dialog, { handle })
      onRun(ctx, close, () => modal.close())
      ctx.scope.add(() => {
        if (dialog.open) dialog.close()
      })
      return { run: () => modal.open() }
    },
  },
  {
    id: 'navigation',
    family: 'navigation',
    title: [
      'Shared navigation',
      'Navegação compartilhada',
      'Navegación compartida',
      '共享导航',
    ],
    hint: [
      'A local route changes. Its cover keeps the connection.',
      'A rota local muda. A capa mantém a conexão.',
      'La ruta local cambia. La portada mantiene la conexión.',
      '本地页面改变，封面保持连贯。',
    ],
    guide: 'web-platforms#navigation',
    apis: ['sharedNavigation'],
    manual: true,
    runLabel: ['Change scene', 'Mudar de cena', 'Cambiar escena', '切换场景'],
    code: `const navigation = scope.sharedNavigation(region)\nnavigation.attach(cover, 'album')\nnavigation.navigate({ tag: 'album', navigate() {\n  showLocalDetail()\n  navigation.attach(detailCover, 'album')\n} })\n// Your application still owns the route.`,
    mount(ctx) {
      const region = element(ctx.host, 'div', 'lab-route-region')
      const navigation = ctx.scope.sharedNavigation(region, {
        transition: { duration: 750, ease: 'easeInOut' },
      })
      let detail = false
      function render() {
        region.replaceChildren()
        const cover = element(
          region,
          'div',
          `lab-route-cover${detail ? ' is-detail' : ''}`,
          '✳︎',
        )
        element(
          region,
          'p',
          'lab-route-caption',
          ctx.t(
            detail
              ? ['The detail', 'O detalhe', 'El detalle', '详情']
              : ['The collection', 'A coleção', 'La colección', '收藏'],
          ),
        )
        navigation.attach(cover, 'album')
      }
      render()
      return {
        run() {
          return navigation
            .navigate({
              tag: 'album',
              navigate() {
                if (!ctx.alive()) return
                detail = !detail
                render()
              },
            })
            .finished.then((result) => {
              if (ctx.alive() && result.status === 'unavailable')
                ctx.report(result.reason || result.status)
            })
        },
      }
    },
  },
  {
    id: 'interactive-back',
    family: 'navigation',
    title: ['Interactive back', 'Volta interativa', 'Vuelta interactiva', '交互返回'],
    hint: [
      'Drag from the left edge. A short pull returns, a long pull commits.',
      'Arraste da borda esquerda. Um gesto curto volta; um longo conclui.',
      'Arrastra desde la izquierda. Un gesto corto vuelve; uno largo confirma.',
      '从左边缘拖动，短拖回弹，长拖完成返回。',
    ],
    guide: 'web-parity#navigation',
    apis: ['interactiveNavigation'],
    manual: true,
    runLabel: ['Back / reopen', 'Voltar / reabrir', 'Volver / reabrir', '返回 / 重开'],
    code: `const back = scope.interactiveNavigation(page, {\n  axis: 'x', edgeWidth: 32, distance: page.clientWidth,\n  commit: ({ signal }) => commitLocalRoute(signal)\n})\nback.back()\n// back.cancel() rolls an in-flight gesture back.`,
    mount(ctx) {
      const region = element(ctx.host, 'div', 'lab-back-region')
      element(
        region,
        'div',
        'lab-back-under',
        ctx.t(['You’re back.', 'Você voltou.', 'Has vuelto.', '你回来了。']),
      )
      const page = element(region, 'div', 'lab-back-page')
      element(page, 'span', 'lab-back-edge', '›')
      element(
        page,
        'strong',
        '',
        ctx.t(['Pull me home.', 'Me leve de volta.', 'Llévame de vuelta.', '带我回去。']),
      )
      let back: WebInteractiveNavigation
      function attach() {
        back?.dispose()
        page.hidden = false
        back = ctx.scope.interactiveNavigation(page, {
          axis: 'x',
          edgeWidth: 40,
          distance: region.clientWidth,
          commit: ({ signal }) => {
            if (signal.aborted || !ctx.alive()) return false
            page.hidden = true
            return true
          },
        })
      }
      attach()
      return {
        run() {
          if (page.hidden) attach()
          else back.back()
        },
        actions: [
          action(
            'cancel',
            ['Cancel return', 'Cancelar volta', 'Cancelar vuelta', '取消返回'],
            () => back.cancel(),
          ),
        ],
      }
    },
  },
  {
    id: 'gallery',
    family: 'navigation',
    title: ['Gallery return', 'Retorno à galeria', 'Regreso a galería', '返回相册'],
    hint: [
      'Open, zoom, pull down to return. Try removing the thumbnail first.',
      'Abra, amplie, puxe para baixo. Experimente remover a miniatura antes de voltar.',
      'Abre, amplía, tira hacia abajo. Prueba quitar la miniatura antes de volver.',
      '打开、缩放、下拉返回，也可先移除缩略图再返回。',
    ],
    guide: 'web-parity#gallery',
    apis: ['sharedNavigationEntry', 'zoomable'],
    manual: true,
    runLabel: ['Open / return', 'Abrir / voltar', 'Abrir / volver', '打开 / 返回'],
    code: `const entry = scope.sharedNavigationEntry(region, {\n  tag: key, source: () => thumbnail, detail: () => photo,\n  back: commitLocalCollection,\n  returnTarget: { key, resolve: context =>\n    resolveListTarget(context, { container: list, indexOf,\n      scrollToIndex, viewForKey, keyOf }), fallbackFocus: () => heading }\n})\nawait entry.open(commitLocalDetail)\nscope.zoomable(photo, { viewport,\n  onDismiss: intent => void entry.returnFrom(intent) })`,
    mount(ctx) {
      const region = element(ctx.host, 'div', 'lab-gallery')
      const heading = element(
        region,
        'h3',
        'lab-gallery-title',
        ctx.t([
          'A place to return.',
          'Um lugar para voltar.',
          'Un lugar para volver.',
          '一个可以返回的地方。',
        ]),
      )
      heading.tabIndex = -1
      const list = element(region, 'div', 'lab-gallery-list')
      const button = element(list, 'button', 'lab-gallery-thumbnail')
      const thumbnail = photo(ctx, button)
      thumbnail.dataset.key = 'dune'
      button.setAttribute(
        'aria-label',
        ctx.t(['Open landscape', 'Abrir paisagem', 'Abrir paisaje', '打开风景']),
      )
      const viewport = element(region, 'div', 'lab-gallery-viewer')
      const image = photo(ctx, viewport)
      viewport.hidden = true
      let entry: WebNavigationEntry | undefined,
        zoom: WebZoomable | undefined,
        deleted = false
      const backRoute = ({ signal }: { signal: AbortSignal }) => {
        if (signal.aborted || !ctx.alive()) return false
        zoom?.dispose()
        zoom = undefined
        viewport.hidden = true
        list.hidden = false
        return true
      }
      const setup = () => {
        entry?.dispose()
        entry = ctx.scope.sharedNavigationEntry(region, {
          tag: 'dune',
          source: () => (button.isConnected ? thumbnail : undefined),
          detail: () => image,
          back: backRoute,
          returnTarget: {
            key: 'dune',
            resolve: (context) =>
              resolveListTarget(context, {
                container: list,
                indexOf: (key) => (!deleted && key === 'dune' ? 0 : -1),
                scrollToIndex() {},
                viewForKey: (key) => (!deleted && key === 'dune' ? thumbnail : undefined),
                keyOf: (view) => view.dataset.key,
              }),
            fallbackFocus: () => heading,
          },
        })
      }
      const run = async () => {
        if (!viewport.hidden && entry) return entry.back()
        await Promise.all([thumbnail.decode(), image.decode()])
        if (!ctx.alive()) return
        if (deleted) {
          deleted = false
          list.append(button)
        }
        setup()
        return entry!.open(async ({ signal }) => {
          if (signal.aborted || !ctx.alive()) return
          list.hidden = true
          viewport.hidden = false
          zoom = ctx.scope.zoomable(image, {
            viewport,
            scale: [1, 4],
            dismiss: 'vertical',
            onDismiss: (intent) => {
              if (ctx.alive())
                void entry?.returnFrom(intent).catch((error) => ctx.report(String(error)))
            },
          })
        })
      }
      onRun(ctx, button, run)
      return {
        run,
        actions: [
          action('zoom', ['Zoom', 'Ampliar', 'Ampliar', '缩放'], () =>
            zoom?.zoomTo(zoom.state.scale > 1 ? 1 : 2),
          ),
          action(
            'delete-thumbnail',
            ['Remove thumbnail', 'Remover miniatura', 'Quitar miniatura', '移除缩略图'],
            () => {
              if (viewport.hidden) return
              deleted = true
              button.remove()
            },
          ),
          action('back', ['Back', 'Voltar', 'Volver', '返回'], () => entry?.back()),
        ],
      }
    },
  },
]
