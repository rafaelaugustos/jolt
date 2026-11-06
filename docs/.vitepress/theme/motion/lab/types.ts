import type { Words } from '../copy'
import { withBase } from 'vitepress'
import type { WebMotionScope, WebRuntime } from '../../../../../src/web/public'

export type Family =
  'motion' | 'touch' | 'layout' | 'effects' | 'type' | 'navigation' | 'device'
export interface LabAction {
  id: string
  label: Words
  run(): unknown
}
export interface LabControls {
  run(): unknown
  adjust?(value: number): unknown
  actions?: LabAction[]
}
export interface LabContext {
  host: HTMLElement
  scope: WebMotionScope
  motion: WebRuntime
  t(words: Words): string
  report(message: string): void
  alive(): boolean
  parameter: number
}
export interface Experiment {
  id: string
  family: Family
  title: Words
  hint: Words
  guide: string
  apis: readonly (keyof WebRuntime)[]
  code: string
  runLabel?: Words
  parameter?: { label: Words; min: number; max: number; step: number; value: number }
  /** Permission requests and modal/route changes always require an explicit action. */
  manual?: boolean
  mount(context: LabContext): LabControls
}
export const familyNames: Record<Family, Words> = {
  motion: ['Motion & physics', 'Movimento e física', 'Movimiento y física', '动效与物理'],
  touch: ['Touch & gestures', 'Toque e gestos', 'Toque y gestos', '触控与手势'],
  layout: ['Scroll & layout', 'Rolagem e layout', 'Scroll y layout', '滚动与布局'],
  effects: ['Visual effects', 'Efeitos visuais', 'Efectos visuales', '视觉效果'],
  type: ['Type & symbols', 'Texto e símbolos', 'Texto y símbolos', '文字与符号'],
  navigation: [
    'Surfaces & navigation',
    'Superfícies e navegação',
    'Superficies y navegación',
    '面板与导航',
  ],
  device: [
    'Device & browser',
    'Dispositivo e navegador',
    'Dispositivo y navegador',
    '设备与浏览器',
  ],
}
export const playWords: Words = ['Play', 'Reproduzir', 'Reproducir', '播放']
export const resetWords: Words = ['Reset', 'Reiniciar', 'Reiniciar', '重置']
export const toggleWords: Words = ['Change', 'Mudar', 'Cambiar', '切换']

export function element<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = parent.ownerDocument.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  parent.append(node)
  return node
}
export function tile(context: LabContext, text = '↗') {
  const node = element(context.host, 'button', 'lab-tile lab-object', text)
  node.type = 'button'
  node.setAttribute(
    'aria-label',
    context.t(['Animate the tile', 'Animar o bloco', 'Animar el bloque', '让方块动起来']),
  )
  return node
}
export function listen(
  context: LabContext,
  node: EventTarget,
  name: string,
  handler: EventListener,
) {
  node.addEventListener(name, handler)
  context.scope.add(() => node.removeEventListener(name, handler))
}
export function onRun(context: LabContext, node: HTMLElement, run: () => unknown) {
  listen(context, node, 'click', () => {
    try {
      Promise.resolve(run()).catch((error) => {
        if (context.alive()) {
          context.report(String(error))
          console.error('[Jolt playground]', error)
        }
      })
    } catch (error) {
      context.report(String(error))
      console.error('[Jolt playground]', error)
    }
  })
}
export function travel(context: LabContext, size = 100) {
  return Math.max(20, Math.min(115, (context.host.clientWidth - size - 48) / 2))
}
export function blocks(context: LabContext, count = 5) {
  const row = element(context.host, 'div', 'lab-blocks')
  return Array.from({ length: count }, (_, index) =>
    element(row, 'div', 'stagger-block', String(index + 1).padStart(2, '0')),
  )
}
export function action(id: string, label: Words, run: () => unknown): LabAction {
  return { id, label, run }
}
export function photo(context: LabContext, parent = context.host, alternate = false) {
  const image = element(parent, 'img', 'lab-photo')
  image.src = withBase(`/playground/${alternate ? 'night' : 'dune'}.svg`)
  image.width = 640
  image.height = 480
  image.alt = context.t([
    'Abstract desert landscape',
    'Paisagem abstrata do deserto',
    'Paisaje abstracto del desierto',
    '抽象沙漠风景',
  ])
  return image
}
