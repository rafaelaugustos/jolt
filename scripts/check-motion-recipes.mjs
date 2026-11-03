import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { transformWithOxc } from 'vite'

const root = resolve(import.meta.dirname, '..')
const source = await readFile(
  resolve(root, 'docs/.vitepress/theme/motion/recipes.ts'),
  'utf8',
)
const { code: compiled } = await transformWithOxc(source, 'recipes.ts', {
  lang: 'ts',
})
const { recipes } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
)
const locales = ['', 'pt-BR', 'es', 'zh-Hans']
const slugs = new Set()
const errors = []
for (const recipe of recipes) {
  if (slugs.has(recipe.slug)) errors.push(`Duplicate recipe: ${recipe.slug}`)
  slugs.add(recipe.slug)
  for (const field of ['title', 'description', 'caption']) {
    if (recipe[field]?.length !== 4 || recipe[field].some((value) => !value.trim()))
      errors.push(`${recipe.slug}: ${field} needs four translations`)
  }
  for (const [path, kind] of [
    [`docs/public/media/${recipe.video}.mp4`, 'mp4'],
    [`docs/public/recipes/${recipe.video}.jpg`, 'jpg'],
    [`demo/src/${recipe.source}`, 'source'],
  ]) {
    try {
      const data = await readFile(resolve(root, path))
      if (
        kind === 'mp4' &&
        (data.length < 1024 || data.toString('ascii', 4, 8) !== 'ftyp')
      )
        throw new Error('Invalid MP4')
      if (kind === 'jpg' && (data.length < 1024 || data[0] !== 0xff || data[1] !== 0xd8))
        throw new Error('Invalid JPEG')
    } catch (error) {
      errors.push(`${recipe.slug}: ${path}: ${error.message}`)
    }
  }
  for (const locale of locales) {
    try {
      await stat(resolve(root, 'docs', locale, 'guide', `${recipe.guide}.md`))
      const page = await readFile(
        resolve(root, 'docs', locale, 'recipes', `${recipe.slug}.md`),
        'utf8',
      )
      if (!page.includes(`recipe: ${recipe.slug}`) || !page.includes('<RecipeDetail />'))
        throw new Error('Missing recipe component or metadata')
    } catch (error) {
      errors.push(`${recipe.slug} (${locale || 'en'}): ${error.message}`)
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else
  console.log(
    `Recipe coverage passed: ${recipes.length} native recordings, posters, source links and detail pages in all four languages.`,
  )
