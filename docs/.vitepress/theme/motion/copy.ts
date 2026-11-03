import { computed } from 'vue'
import { useData } from 'vitepress'

export const languages = ['en', 'pt-BR', 'es', 'zh-Hans'] as const
export type Language = (typeof languages)[number]
export type Words = readonly [string, string, string, string]
export const words = (value: Words, language: string) =>
  value[Math.max(0, languages.indexOf(language as Language))]

export function useWords() {
  const { lang } = useData()
  const locale = computed(() =>
    languages.includes(lang.value as Language) ? (lang.value as Language) : 'en',
  )
  const prefix = computed(() => (locale.value === 'en' ? '' : `/${locale.value}`))
  const t = (value: Words) => words(value, locale.value)
  const link = (path: string) => `${prefix.value}${path}`
  return { locale, prefix, t, link }
}

export const labels = {
  recipes: ['Recipes', 'Receitas', 'Recetas', '动效配方'],
  playground: ['Playground', 'Playground', 'Playground', '互动体验'],
  docs: ['Docs', 'Docs', 'Guías', '文档'],
  explore: [
    'Explore the recipes',
    'Explore as receitas',
    'Explora las recetas',
    '探索动效配方',
  ],
  all: ['All motion', 'Todos os movimentos', 'Todo el movimiento', '全部动效'],
  native: ['Native recording', 'Gravação nativa', 'Grabación nativa', '原生录屏'],
  copy: ['Copy code', 'Copiar código', 'Copiar código', '复制代码'],
  prompt: [
    'Copy AI prompt',
    'Copiar prompt para IA',
    'Copiar prompt para IA',
    '复制 AI 提示词',
  ],
  copied: ['Copied!', 'Copiado!', '¡Copiado!', '已复制！'],
  copyFailed: [
    'Select and copy the text below.',
    'Selecione e copie o texto abaixo.',
    'Selecciona y copia el texto de abajo.',
    '请选择并复制下方文本。',
  ],
  source: ['View full demo', 'Ver demo completa', 'Ver demo completa', '查看完整示例'],
  reduced: ['Reduce motion', 'Reduzir movimento', 'Reducir movimiento', '减少动态效果'],
  menu: ['Open navigation', 'Abrir navegação', 'Abrir navegación', '打开导航'],
  close: ['Close', 'Fechar', 'Cerrar', '关闭'],
  start: ['Start building', 'Comece a criar', 'Empieza a crear', '开始构建'],
} satisfies Record<string, Words>
