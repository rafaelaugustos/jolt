import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { recipes } from './recipes'
import { version } from '../../../../package.json'

export interface RecipeCode {
  slug: string
  code: string
  version: string
}
declare const data: RecipeCode[]
export { data }

export default {
  watch: ['../../../guide/*.md'],
  load(): RecipeCode[] {
    return recipes.map((recipe) => {
      const file = readFileSync(
        resolve(import.meta.dirname, '../../../guide', `${recipe.guide}.md`),
        'utf8',
      )
      const code = /```ts\n([\s\S]*?)\n```/.exec(file)?.[1]
      if (!code) throw new Error(`No TypeScript example for ${recipe.slug}`)
      return { slug: recipe.slug, code, version }
    })
  },
}
