import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const dryRun = process.argv.includes('--dry-run')
const tag = process.env.DIST_TAG
if (!['next', 'latest'].includes(tag)) throw new Error('Set DIST_TAG to next or latest.')

function npm(args, cwd = root) {
  return execFileSync('npm', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
}

function registry(spec, field) {
  const result = spawnSync('npm', ['view', spec, field, '--json'], {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  const data = result.stdout.trim() ? JSON.parse(result.stdout) : undefined
  if (result.status === 0) return data
  if (data?.error?.code === 'E404') return undefined
  throw new Error(`Cannot query ${spec}: ${result.stderr || result.stdout}`)
}

const directories = ['packages/native', '.']
const packages = directories.map((directory) => ({
  directory: join(root, directory),
  ...JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8')),
}))
if (packages[0].version !== packages[1].version)
  throw new Error('Core and native plugin versions must match.')
if (packages[0].peerDependencies[packages[1].name] !== `>=${packages[1].version}`)
  throw new Error('The native plugin must require the matching core release or newer.')

const destination = mkdtempSync(join(tmpdir(), 'jolt-publish-'))
try {
  // Prepare and validate both artifacts before the first registry mutation.
  const artifacts = packages.map((pkg) => {
    const [packed] = JSON.parse(
      npm(
        ['pack', '--json', '--silent', '--pack-destination', destination],
        pkg.directory,
      ),
    )
    const spec = `${pkg.name}@${pkg.version}`
    const published = registry(spec, 'dist.integrity')
    if (published && published !== packed.integrity)
      throw new Error(
        `${spec} already exists with different contents; refusing to reuse it.`,
      )
    return { ...pkg, ...packed, spec, published }
  })

  // The optional runtime goes first so a newly released core never points at a missing plugin.
  for (const artifact of artifacts) {
    const { name, version, spec, filename, published } = artifact
    console.log(
      `${dryRun ? '[dry run] ' : ''}${published ? 'Already published' : 'Publish'} ${spec}`,
    )
    if (dryRun) continue
    if (!published)
      process.stdout.write(
        npm([
          'publish',
          join(destination, filename),
          '--provenance',
          '--access',
          'public',
          '--tag',
          tag,
        ]),
      )
    else npm(['dist-tag', 'add', spec, tag])

    // Preserve a stable latest release; otherwise expose the beta on both tags.
    if (tag === 'next') {
      const latest = registry(name, 'dist-tags.latest')
      if (!latest || (latest.includes('-') && latest !== version))
        npm(['dist-tag', 'add', spec, 'latest'])
    }
  }
} finally {
  rmSync(destination, { recursive: true, force: true })
}
