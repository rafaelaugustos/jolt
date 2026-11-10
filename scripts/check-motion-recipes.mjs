import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
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
const media = JSON.parse(
  await readFile(resolve(root, 'docs/.vitepress/media.json'), 'utf8'),
)
const locales = ['', 'pt-BR', 'es', 'zh-Hans']
const slugs = new Set()
const errors = []
for (const recipe of recipes) {
  if (slugs.has(recipe.slug)) errors.push(`Duplicate recipe: ${recipe.slug}`)
  slugs.add(recipe.slug)
  if (!media.files[`${recipe.video}.mp4`])
    errors.push(`${recipe.slug}: ${recipe.video}.mp4 is not published`)
  for (const field of ['title', 'description', 'caption']) {
    if (recipe[field]?.length !== 4 || recipe[field].some((value) => !value.trim()))
      errors.push(`${recipe.slug}: ${field} needs four translations`)
  }
  for (const [path, kind] of [
    [`docs/public/recipes/${recipe.video}.jpg`, 'jpg'],
    [
      recipe.project
        ? `docs/recipes/sources/${recipe.project.repository}/${recipe.source}.txt`
        : `demo/src/${recipe.source}`,
      'source',
    ],
  ]) {
    try {
      const data = await readFile(resolve(root, path))
      if (kind === 'source' && recipe.project) {
        if (
          !/^[\w-]+\/[\w-]+$/.test(recipe.project.repository) ||
          !/^[a-f0-9]{40}$/.test(recipe.project.revision)
        )
          throw new Error('Project source must name a repository and pinned commit')
        if (createHash('sha256').update(data).digest('hex') !== recipe.project.sha256)
          throw new Error('Project snapshot differs from reviewed source')
        if (recipe.requirements?.length !== 4)
          throw new Error('Project recipes require context in all four languages')
      }
      if (kind === 'jpg' && (data.length < 1024 || data[0] !== 0xff || data[1] !== 0xd8))
        throw new Error('Invalid JPEG')
    } catch (error) {
      errors.push(`${recipe.slug}: ${path}: ${error.message}`)
    }
  }
  for (const locale of locales) {
    try {
      const guide = await readFile(
        resolve(root, 'docs', locale, 'guide', `${recipe.guide}.md`),
        'utf8',
      )
      if (recipe.guideAnchor && !guide.includes(`{#${recipe.guideAnchor}}`))
        throw new Error('Missing guide anchor')
      if (recipe.project && !guide.includes(`name="${recipe.video}"`))
        throw new Error('Missing native recording in project guide')
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
