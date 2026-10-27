import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// These pages describe setup, architecture, navigation or planned work, not a visual feature.
// A new guide requires a real demo clip by default. Do not exempt visual feature pages.
const nonVisual = new Set(['api', 'how-it-works', 'index', 'install', 'not-there-yet'])
const locales = ['docs', 'docs/pt-BR', 'docs/es', 'docs/zh-Hans']
const pages = new Map()
const errors = []
const clips = new Set()
for (const locale of locales) {
  const inventory = new Map()
  const guides = (await readdir(resolve(root, locale, 'guide')))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `guide/${f}`)
  for (const file of ['index.md', ...guides]) {
    const slug = file.replace(/^guide\//, '').slice(0, -3)
    const markdown = (await readFile(resolve(root, locale, file), 'utf8')).replace(
      /```[\s\S]*?```|<!--[\s\S]*?-->/g,
      '',
    )
    const names = []
    for (const match of markdown.matchAll(/<Clip\b([^>]*?)\/?\s*>/gs)) {
      const name = /\bname="([a-z0-9-]+)"/.exec(match[1])?.[1]
      const caption = /\bcaption="([^"]+)"/.exec(match[1])?.[1]
      if (!name || !caption?.trim()) {
        errors.push(
          `${locale}/${file}: clips require a static name and a descriptive caption`,
        )
        continue
      }
      names.push(name)
      clips.add(name)
    }
    if (!nonVisual.has(slug) && names.length === 0)
      errors.push(
        `${locale}/${file}: visual guides require a real app recording (<Clip>)`,
      )
    inventory.set(file, [...new Set(names)].sort().join(','))
  }
  pages.set(locale, inventory)
}
const english = pages.get(locales[0])
for (const locale of locales.slice(1)) {
  const translated = pages.get(locale)
  for (const file of new Set([...english.keys(), ...translated.keys()])) {
    if (!english.has(file) || !translated.has(file))
      errors.push(`${locale}/${file}: page must exist in all four languages`)
    else if (english.get(file) !== translated.get(file))
      errors.push(`${locale}/${file}: all languages must show the same recordings`)
  }
}
for (const name of clips) {
  const path = resolve(root, 'docs/public/media', `${name}.mp4`)
  try {
    const info = await stat(path)
    const data = await readFile(path)
    if (!info.isFile() || info.size < 1024 || data.toString('ascii', 4, 8) !== 'ftyp')
      errors.push(`${name}: expected a nonempty MP4 file`)
  } catch {
    errors.push(`${name}: missing docs/public/media/${name}.mp4`)
  }
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    `Media coverage passed: ${english.size - 1} guides and a homepage in ${locales.length} languages, ${clips.size} recordings.`,
  )
}
