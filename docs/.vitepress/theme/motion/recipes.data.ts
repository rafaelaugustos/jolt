import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { recipes } from './recipes'
import { version } from '../../../../package.json'

export interface RecipeCode {
  slug: string
  code: string
  version: string
  language: 'vue' | 'ts'
  fileName?: string
}
declare const data: RecipeCode[]
export { data }

export default {
  watch: ['../../../guide/*.md', '../../../recipes/sources/**/*.txt'],
  load(): RecipeCode[] {
    return recipes.map((recipe) => {
      if (recipe.project) {
        const code = readFileSync(
          resolve(
            import.meta.dirname,
            '../../../recipes/sources',
            recipe.project.repository,
            `${recipe.source}.txt`,
          ),
          'utf8',
        )
        return {
          slug: recipe.slug,
          code,
          version: recipe.project.joltVersion,
          language: recipe.source.endsWith('.vue') ? 'vue' : 'ts',
          fileName: recipe.source.split('/').pop(),
        }
      }
      const file = readFileSync(
        resolve(import.meta.dirname, '../../../guide', `${recipe.guide}.md`),
        'utf8',
      )
      const code = /```ts\n([\s\S]*?)\n```/.exec(file)?.[1]
      if (!code) throw new Error(`No TypeScript example for ${recipe.slug}`)
      return { slug: recipe.slug, code, version, language: 'ts' }
    })
  },
}
