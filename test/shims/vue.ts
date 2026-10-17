/** Stands in for nativescript-vue: the adapter only needs these three names at runtime. */
export const BaseTransition = { name: 'BaseTransition' }

export interface Rendered {
  type: unknown
  props: Record<string, unknown> | null
  children: unknown
}

export const rendered: Rendered[] = []

export function h(
  type: unknown,
  props: Record<string, unknown> | null,
  children: unknown,
) {
  const vnode = { type, props, children }
  rendered.push(vnode)
  return vnode
}

export function defineComponent<T>(options: T) {
  return options
}
