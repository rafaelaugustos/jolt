import { parse } from '@babel/parser'
import { readFile, readdir } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const directory = new URL('docs/.vitepress/theme/motion/lab/', root)
const read = async (url) =>
  parse(await readFile(url, 'utf8'), { sourceType: 'module', plugins: ['typescript'] })
const publicFile = await read(new URL('src/web/public.ts', root))
const runtime = publicFile.program.body
  .map((node) => node.declaration ?? node)
  .find((node) => node.type === 'TSInterfaceDeclaration' && node.id.name === 'WebRuntime')
const methods = new Set(
  runtime.body.body
    .filter((node) => node.type === 'TSMethodSignature')
    .map((node) => node.key.name),
)
const covered = new Set(),
  invoked = new Set()
for (const name of await readdir(directory)) {
  if (!name.endsWith('.ts')) continue
  const source = await read(new URL(name, directory))
  const visit = (node) => {
    if (
      node.type === 'ObjectProperty' &&
      node.key.name === 'apis' &&
      node.value.type === 'ArrayExpression'
    )
      for (const value of node.value.elements) {
        if (value.type !== 'StringLiteral')
          throw new Error('API coverage must use literal method names')
        covered.add(value.value)
      }
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression')
      invoked.add(node.callee.property.name)
    if (node.type === 'VariableDeclarator' && node.id.name === 'hostAPIs') {
      const object = node.init.expression
      for (const property of object.properties) covered.add(property.key.name)
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child?.type) visit(child)
      } else if (value?.type) visit(value)
    }
  }
  visit(source)
}
const missing = [...methods].filter((name) => !covered.has(name))
const invalid = [...covered].filter((name) => !methods.has(name))
const uncalled = [...covered].filter(
  (name) => !invoked.has(name) && !['configure', 'release', 'dispose'].includes(name),
)
if (missing.length || invalid.length || uncalled.length)
  throw new Error(JSON.stringify({ missing, invalid, uncalled }))
console.log(
  `Playground coverage: all ${methods.size} public Web runtime methods accounted for.`,
)
