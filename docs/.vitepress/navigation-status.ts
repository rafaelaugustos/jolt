import type { DefaultTheme } from 'vitepress'

type Status = 'new' | 'updated' | 'beta'
type Marker = {
  status: Status
  /** New/updated markers expire when the documented package version changes. */
  edition?: string
  availability: 'published' | 'source'
}

// Curated capability changes, not page edit timestamps. Review at each release.
// Beta describes API maturity and does not expire with a release badge.
const markers: Record<string, Marker> = {
  'values-scroll-lists': { status: 'beta', availability: 'published' },
  'motion-values': {
    status: 'updated',
    edition: '0.1.0-rc.15',
    availability: 'published',
  },
  'scroll-linked': {
    status: 'updated',
    edition: '0.1.0-rc.15',
    availability: 'published',
  },
  layout: { status: 'updated', edition: '0.1.0-rc.15', availability: 'published' },
  lists: { status: 'updated', edition: '0.1.0-rc.15', availability: 'published' },
  'swiftui-motion': { status: 'beta', availability: 'published' },
  'swiftui-advanced': { status: 'beta', availability: 'published' },
  'web-frameworks': { status: 'beta', availability: 'published' },
  'portable-tools': { status: 'beta', availability: 'published' },
  'web-runtime': { status: 'beta', availability: 'published' },
  swiftui: { status: 'beta', availability: 'published' },
  'swiftui-characters': { status: 'beta', availability: 'published' },
  'swiftui-geometry': { status: 'beta', availability: 'published' },
}

const copy = {
  '': {
    new: 'New',
    updated: 'Updated',
    beta: 'Beta',
    experimental: 'Experimental API; the contract may change.',
    source: 'Source candidate; not yet published.',
    published: 'Available in the documented release.',
    edition: 'Changed in this documentation edition',
  },
  '/pt-BR': {
    new: 'Novo',
    updated: 'Atualizado',
    beta: 'Beta',
    experimental: 'API experimental; o contrato pode mudar.',
    source: 'Candidato de código; ainda não publicado.',
    published: 'Disponível na versão documentada.',
    edition: 'Mudança nesta edição da documentação',
  },
  '/es': {
    new: 'Nuevo',
    updated: 'Actualizado',
    beta: 'Beta',
    experimental: 'API experimental; el contrato puede cambiar.',
    source: 'Candidato de código; todavía no publicado.',
    published: 'Disponible en la versión documentada.',
    edition: 'Cambio en esta edición de la documentación',
  },
  '/zh-Hans': {
    new: '新增',
    updated: '已更新',
    beta: '测试版',
    experimental: '实验性 API，接口约定可能变化。',
    source: '源码候选，尚未发布。',
    published: '已包含在文档对应的版本中。',
    edition: '本文档版本中的变化',
  },
} as const

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  )

/** VitePress supports HTML sidebar labels; keep prev/next navigation plain text. */
export function withNavigationStatus(
  items: DefaultTheme.SidebarItem[],
  prefix: string,
  version: string,
): DefaultTheme.SidebarItem[] {
  const words = copy[prefix as keyof typeof copy] ?? copy['']
  return items.map((item) => {
    const next = { ...item }
    if (item.items) next.items = withNavigationStatus(item.items, prefix, version)
    const path = item.link?.replace(`${prefix}/guide/`, '').split(/[?#]/)[0]
    const marker = path && markers[path]
    if (!marker || (marker.edition && marker.edition !== version)) return next
    const label = item.text ?? ''
    const description = [
      words[marker.status],
      marker.status === 'beta'
        ? words.experimental
        : `${words.edition}: ${marker.edition}.`,
      words[marker.availability],
    ].join(' · ')
    next.text = `<span class="jolt-nav-name">${escape(label)}</span><span class="jolt-nav-status ${marker.status}" role="img" title="${escape(description)}" aria-label="${escape(description)}">${words[marker.status]}</span>`
    next.docFooterText = item.docFooterText ?? label
    return next
  })
}
