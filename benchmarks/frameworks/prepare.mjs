import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const name = process.argv[2]
if (!['react', 'svelte', 'solid', 'angular'].includes(name))
  throw new Error('Choose react, svelte, solid or angular.')
const destination = join(root, '.local/framework-native', name)
const artifactDir = join(root, '.local/framework-artifacts', name)
mkdirSync(artifactDir, { recursive: true })
const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: 300000 })
const [packed] = JSON.parse(
  run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', artifactDir]),
)
const artifact = join(artifactDir, packed.filename)
rmSync(join(destination, 'app'), { recursive: true, force: true })
cpSync(join(root, 'benchmarks/frameworks', name), destination, { recursive: true })
const manifestPath = join(destination, 'package.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.devDependencies = {
  ...manifest.devDependencies,
  '@nativescript/android': '9.1.1',
  '@nativescript/ios': '9.1.0',
  '@nativescript/webpack': '5.0.38',
  nativescript: '9.1.2',
  typescript: '6.0.3',
  webpack: '5.101.3',
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Installing packed ${name} consumer in ${destination}`)
try {
  run('npm', ['install', artifact, '--no-audit', '--no-fund'], destination)
} catch (error) {
  console.error(error.stdout?.toString(), error.stderr?.toString())
  throw error
}
const resources = join(destination, 'App_Resources')
if (!existsSync(resources))
  cpSync(
    join(
      root,
      'benchmarks/native-app/node_modules/@nativescript/template-blank/App_Resources',
    ),
    resources,
    { recursive: true },
  )
const config = name === 'solid' || name === 'angular' ? 'javascript' : name
writeFileSync(
  join(destination, 'webpack.config.js'),
  `const webpack = require('@nativescript/webpack')
module.exports = (env) => {
  if (env.production) process.env.NODE_ENV = 'production'
  webpack.init(env)
  webpack.useConfig('${config}')
  webpack.chainWebpack((config) => {
    ${name === 'solid' ? "config.resolve.set('conditionNames', ['nativescript', 'browser', 'import', 'require', 'default'])" : ''}
    ${
      name === 'solid'
        ? `config.resolve.alias.set('@jolt-fixture/solid-renderer', require('path').resolve(__dirname, 'app/renderer.js'))
    config.module.rule('bundle-source').use('babel-loader').tap((options) => ({
      ...options, presets: [['babel-preset-solid', { moduleName: '@jolt-fixture/solid-renderer', generate: 'universal' }]],
    }))`
        : ''
    }
  }, { order: 100 })
  return webpack.resolveConfig()
}
`,
)
writeFileSync(
  join(destination, 'candidate.json'),
  JSON.stringify(
    {
      name,
      artifact: packed.filename,
      integrity: packed.integrity,
      packedFiles: packed.files.map((f) => f.path),
      acceptance: 'prepared; native run pending',
    },
    null,
    2,
  ) + '\n',
)
console.log(destination)
