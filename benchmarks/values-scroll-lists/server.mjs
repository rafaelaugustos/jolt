import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
const bundle = await build({
  entryPoints: ['benchmarks/values-scroll-lists/web.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  write: false,
  define: {
    'process.env.NODE_ENV': '"production"',
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
})
const html = readFileSync(new URL('./index.html', import.meta.url))
const server = createServer((request, response) => {
  if (!['/', '/fixture.js'].includes(request.url)) {
    response.writeHead(404).end()
    return
  }
  response.setHeader(
    'Content-Type',
    request.url === '/' ? 'text/html' : 'text/javascript',
  )
  response.end(request.url === '/' ? html : bundle.outputFiles[0].contents)
})
server.listen(4341, '127.0.0.1')
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)))
