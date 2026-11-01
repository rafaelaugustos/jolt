import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../../', import.meta.url))
const result = await build({
  absWorkingDir: root,
  entryPoints: ['benchmarks/web-press/fixture.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  metafile: true,
  write: false,
})
for (const [name, input] of Object.entries(result.metafile.inputs)) {
  assert(
    name.startsWith('src/core/') ||
      name.startsWith('src/web/') ||
      name.startsWith('benchmarks/web-press/'),
    `Unexpected runtime module: ${name}`,
  )
  assert(
    input.imports.every((dependency) => !dependency.external),
    'Fixture must be dependency-free',
  )
}
assert(
  Object.values(result.metafile.outputs).every((output) => output.imports.length === 0),
)
const html = readFileSync(new URL('./index.html', import.meta.url))
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname
  if (pathname !== '/' && pathname !== '/fixture.js') {
    response.writeHead(404).end()
    return
  }
  response.setHeader(
    'Content-Type',
    pathname === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8',
  )
  response.end(pathname === '/' ? html : result.outputFiles[0].contents)
})
server.listen(4283, '127.0.0.1', () =>
  console.log('Web press fixture: http://127.0.0.1:4283'),
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)))
