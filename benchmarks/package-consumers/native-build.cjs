const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const { resolve, join } = require('node:path')
const { writeFileSync } = require('node:fs')

const [tooling, consumer, platform] = process.argv.slice(2)
assert(['ios', 'android'].includes(platform))
process.chdir(consumer)
// Use the project's pinned NativeScript/Webpack toolchain. Library resolution
// is entirely from the clean consumer's installed tarball and actual peers.
const requireTool = createRequire(join(tooling, 'package.json'))
const ns = requireTool('@nativescript/webpack')
ns.init({ [platform]: true, production: true, hmr: false, nativescriptLibPath: false })
ns.useConfig('vue')
ns.chainWebpack((config) => {
  config.output.path(join(consumer, `bundle-${platform}`))
  config.resolveLoader.modules.prepend(join(tooling, 'node_modules'))
})
const config = ns.resolveConfig()
assert.equal(config.mode, 'production')
assert.equal(config.experiments.outputModule, true)
assert(!Object.keys(config.resolve.alias).some((name) => name.includes('jolt')))
const webpack = requireTool('webpack')
const compiler = webpack(config)
compiler.run((error, stats) => {
  const finish = () =>
    compiler.close((closeError) => {
      if (closeError) {
        console.error(closeError)
        process.exitCode = 1
      }
    })
  try {
    if (error) throw error
    if (stats.hasErrors())
      throw new Error(stats.toString({ all: false, errors: true, errorDetails: true }))
    const resources = []
    const visit = (modules) => {
      for (const m of modules) {
        if (m.resource) resources.push(m.resource)
        if (m.modules) visit(m.modules)
      }
    }
    visit(stats.compilation.modules)
    const prefix = resolve(consumer, 'node_modules/@rafaelaugusto/jolt') + '/'
    const jolt = resources.filter((path) => path.includes('/@rafaelaugusto/jolt/'))
    assert(jolt.length > 0)
    assert(
      jolt.every((path) => path.startsWith(prefix)),
      jolt.join('\n'),
    )
    for (const entry of ['dist/index.js', 'dist/native/index.js', 'dist/vue/index.js'])
      assert(jolt.includes(prefix + entry), `Missing packed entry ${entry}`)
    assert(!jolt.some((path) => path.includes('/dist/web/')))
    const core = resources.filter((path) => path.includes('/@nativescript/core/'))
    assert(
      core.length > 0 &&
        core.every((path) =>
          path.startsWith(join(consumer, 'node_modules/@nativescript/core') + '/'),
        ),
    )
    const result = {
      platform,
      mode: config.mode,
      webpack: requireTool('webpack/package.json').version,
      nativeScriptWebpack: requireTool('@nativescript/webpack/package.json').version,
      joltModules: jolt.map((path) => path.slice(prefix.length)).sort(),
      warnings: stats.toJson({ all: false, warnings: true }).warnings,
    }
    writeFileSync(
      join(consumer, `native-${platform}.json`),
      JSON.stringify(result, null, 2) + '\n',
    )
    console.log(
      `PASS: NativeScript ${platform} production bundle resolves packed root, /vue and /native without aliases`,
    )
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    finish()
  }
})
