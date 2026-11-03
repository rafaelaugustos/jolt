import { createServer } from 'node:http'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../../', import.meta.url))
const output = resolve(process.env.JOLT_MOBILE_OUTPUT ?? `${root}.local/web-mobile`)
mkdirSync(output, { recursive: true })
const result = await build({
  absWorkingDir: root,
  entryPoints: ['benchmarks/web-mobile/fixture.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  write: false,
})
const html = readFileSync(new URL('./index.html', import.meta.url))
const lengths = new Map()
const server = createServer(async (req, res) => {
  if (req.url === '/report' && req.method === 'POST') {
    const chunks = []
    let bytes = 0
    for await (const chunk of req) {
      bytes += chunk.length
      if (bytes > 2_000_000) {
        res.writeHead(413).end()
        return
      }
      chunks.push(chunk)
    }
    try {
      const report = JSON.parse(Buffer.concat(chunks).toString())
      if (!/^[a-z0-9-]+$/.test(report.session)) throw new Error('Invalid session')
      if (report.events.length >= (lengths.get(report.session) ?? 0)) {
        lengths.set(report.session, report.events.length)
        writeFileSync(
          resolve(output, `${report.session}.json`),
          JSON.stringify(report, null, 2) + '\n',
        )
      }
      res.writeHead(204).end()
    } catch {
      res.writeHead(400).end()
    }
    return
  }
  if (req.url !== '/' && req.url !== '/fixture.js') {
    res.writeHead(404).end()
    return
  }
  res.setHeader(
    'Content-Type',
    req.url === '/' ? 'text/html; charset=utf-8' : 'text/javascript',
  )
  res.end(req.url === '/' ? html : result.outputFiles[0].contents)
})
server.listen(4318, '127.0.0.1', () =>
  console.log(`Mobile browser acceptance: http://127.0.0.1:4318; reports ${output}`),
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)))
