import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../../', import.meta.url))
const result = await build({
  absWorkingDir: root,
  entryPoints: ['benchmarks/web-attachment/fixture.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  metafile: true,
  define: {
    'process.env.NODE_ENV': '"production"',
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  write: false,
})
for (const [name, input] of Object.entries(result.metafile.inputs)) {
  assert(
    name.startsWith('src/core/') ||
      name.startsWith('src/web/') ||
      name.startsWith('benchmarks/web-attachment/') ||
      name.startsWith('node_modules/@vue/') ||
      name.startsWith('node_modules/vue/'),
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
const port = Number(process.env.JOLT_ATTACHMENT_PORT ?? 4293)
server.listen(port, '127.0.0.1', () =>
  console.log(`Web lifecycle fixture: http://127.0.0.1:${port}`),
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)))
