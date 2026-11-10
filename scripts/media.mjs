import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const manifestPath = resolve(root, 'docs/.vitepress/media.json')
const localDir = resolve(root, '.local/media')
const wrangler = process.env.JOLT_WRANGLER ?? 'wrangler@4.86.0'
const cacheControl = 'public, max-age=86400'
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const url = (file) => `${manifest.origin}/${manifest.prefix}${file}`

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

function checkVideo(name, data) {
  if (!/^[a-z0-9-]+\.mp4$/.test(name))
    throw new Error(`${name}: use a lowercase kebab-case .mp4 file name`)
  if (data.length < 1024 || data.toString('ascii', 4, 8) !== 'ftyp')
    throw new Error(`${name}: expected a nonempty MP4 file`)
}

async function pool(items, size, task) {
  const failures = []
  let next = 0
  async function worker() {
    while (next < items.length) {
      const item = items[next++]
      try {
        await task(item)
      } catch (error) {
        failures.push(error.message)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  return failures
}

function run(args) {
  return new Promise((done, fail) => {
    const child = spawn('npx', ['--yes', wrangler, ...args], {
      cwd: tmpdir(),
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', fail)
    child.on('close', (code) =>
      code === 0
        ? done()
        : fail(new Error(stderr.trim().split('\n').slice(-3).join('\n'))),
    )
  })
}

async function save() {
  const files = Object.fromEntries(
    Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)),
  )
  await writeFile(manifestPath, `${JSON.stringify({ ...manifest, files }, null, 2)}\n`)
}

async function upload(paths, replace) {
  if (!paths.length) throw new Error('Pass the reviewed MP4 files to upload.')
  let uploaded = 0
  const failures = await pool(paths, 6, async (path) => {
    const name = basename(path)
    const data = await readFile(resolve(path))
    checkVideo(name, data)
    const entry = { bytes: data.length, sha256: sha256(data) }
    const current = manifest.files[name]
    if (current?.sha256 === entry.sha256) return
    if (current && !replace)
      throw new Error(
        `${name}: differs from the published recording; pass --replace to overwrite it`,
      )
    await run([
      'r2',
      'object',
      'put',
      `${manifest.bucket}/${manifest.prefix}${name}`,
      '--file',
      resolve(path),
      '--content-type',
      'video/mp4',
      '--cache-control',
      cacheControl,
      '--remote',
    ]).catch((error) => {
      throw new Error(`${name}: ${error.message}`)
    })
    manifest.files[name] = entry
    uploaded++
    console.log(`uploaded ${url(name)}`)
  })
  await save()
  console.log(
    `${uploaded} uploaded, ${paths.length - uploaded - failures.length} unchanged`,
  )
  if (replace && uploaded)
    console.log('Replaced recordings may stay cached for up to a day.')
  return failures
}

async function pull(names) {
  if (!names.length) throw new Error('Pass the recording names to download.')
  await mkdir(localDir, { recursive: true })
  return pool(names, 6, async (value) => {
    const name = value.endsWith('.mp4') ? value : `${value}.mp4`
    const entry = manifest.files[name]
    if (!entry) throw new Error(`${name}: not in docs/.vitepress/media.json`)
    const response = await fetch(url(name))
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
    const data = Buffer.from(await response.arrayBuffer())
    if (sha256(data) !== entry.sha256)
      throw new Error(`${name}: downloaded file differs from the manifest`)
    await writeFile(resolve(localDir, name), data)
    console.log(`.local/media/${name}`)
  })
}

async function verify() {
  const names = Object.keys(manifest.files)
  const failures = await pool(names, 16, async (name) => {
    const response = await fetch(url(name), { method: 'HEAD' })
    const bytes = Number(response.headers.get('content-length'))
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
    if (bytes !== manifest.files[name].bytes)
      throw new Error(
        `${name}: ${bytes} bytes published, ${manifest.files[name].bytes} expected`,
      )
    if (response.headers.get('content-type') !== 'video/mp4')
      throw new Error(`${name}: served as ${response.headers.get('content-type')}`)
  })
  if (!failures.length) console.log(`${names.length} recordings published at ${url('')}`)
  return failures
}

const [command, ...rest] = process.argv.slice(2)
const commands = {
  upload: () =>
    upload(
      rest.filter((arg) => arg !== '--replace'),
      rest.includes('--replace'),
    ),
  pull: () => pull(rest),
  verify,
}
if (!commands[command]) {
  console.error('Usage: node scripts/media.mjs upload|pull|verify')
  process.exit(1)
}
const failures = await commands[command]()
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
}
