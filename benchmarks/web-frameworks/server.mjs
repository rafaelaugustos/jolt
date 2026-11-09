import { createServer } from 'node:http'
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { prepareFrameworks } from '../package-consumers/frameworks.mjs'
const root = fileURLToPath(new URL('../../', import.meta.url))
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'jolt-web-frameworks-')))
const run = (command, args, cwd) => {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 240000,
    })
  } catch (error) {
    console.error(error.stdout?.toString(), error.stderr?.toString())
    throw error
  }
}
const [packed] = JSON.parse(
  run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], root),
)
const prepared = await prepareFrameworks({
  root,
  scratch,
  artifact: join(scratch, packed.filename),
  run,
})
mkdirSync(join(root, 'benchmarks/web-frameworks/results'), { recursive: true })
writeFileSync(
  join(root, 'benchmarks/web-frameworks/results/consumer.json'),
  JSON.stringify(prepared, null, 2),
)
console.log('Packed framework consumers:', prepared.consumer)
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  if (
    !/^\/(react|angular|svelte|solid|tools)(\.js)?$/.test(path) &&
    path !== '/styles.css'
  ) {
    response.writeHead(404).end()
    return
  }
  const name = path.slice(1) + (path.includes('.') ? '' : '.html')
  response.setHeader(
    'Content-Type',
    name.endsWith('.js')
      ? 'text/javascript'
      : name.endsWith('.css')
        ? 'text/css'
        : 'text/html',
  )
  response.end(readFileSync(join(prepared.output, name)))
})
server.listen(Number(process.env.JOLT_FRAMEWORK_PORT ?? 4341), '127.0.0.1')
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)))
